import type { ParsedStatement, StatementLine } from './parse-santander';

/**
 * Cruce del estado de cuenta con los movimientos de la tarjeta en la app.
 *
 * - Compras: monto exacto y fecha de operación a 4 días o menos (gana la más cercana).
 * - Cuotas: monto exacto y mismo número de cuota, entre las cuotas fechadas después
 *   del cierre (la app las fecha el día 5 del mes siguiente al estado que las cobra).
 * - Abonos: monto exacto contra los ingresos de la tarjeta del período.
 * - Lo que queda: "monto distinto" si hay un movimiento cercano del mismo comercio,
 *   "falta en la app" o "no está en el estado de cuenta".
 */

export type AppTransaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  isInstallment: boolean;
  isReconciled: boolean;
  budgetId: string | null;
  categoryId: string | null;
  entityId: string | null;
  nature: string;
};

export type Alias = {
  key: string;
  description: string;
  budgetId: string | null;
  categoryId: string | null;
  entityId: string | null;
  nature: string;
};

export type TemplateItemRef = { id: string; description: string; amount: number };

export type MatchedLine = { line: StatementLine; tx: AppTransaction; dateGap: number };
export type AmountDiff = { line: StatementLine; tx: AppTransaction };
export type MissingLine = { line: StatementLine; suggestion: Omit<Alias, 'key'> | null };
export type TemplateDrift = { item: TemplateItemRef; amount: number; line: StatementLine };

export type MatchResult = {
  matched: MatchedLine[];
  amountDiffs: AmountDiff[];
  missing: MissingLine[];
  /** Movimientos del período en la app que no aparecen en el estado de cuenta */
  extra: AppTransaction[];
  templateDrift: TemplateDrift[];
};

const MAX_DATE_GAP = 4;
const days = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);

/** "COPEC 20215" → "copec"; "DROPBOX*N9P7Q6VC" → "dropbox"; "MP *MELIMAS" → "melimas" */
export function merchantKey(description: string): string {
  const words = description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[*/.\-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/\d/.test(w) && !['mp', 'dl', 'tuu', 'merpago', 'spa', 'ltda', 'webpay', 'com', 'bill'].includes(w));
  return words.slice(0, 3).join(' ');
}

/** Número de cuota desde la descripción de la app ("iPhone Yoha - Cuota 9/36") */
const installmentNumber = (description: string) => {
  const m = description.match(/cuota\s+(\d+)\s*\/\s*(\d+)/i);
  return m ? { number: parseInt(m[1], 10), total: parseInt(m[2], 10) } : null;
};

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());

export function matchStatement(
  statement: ParsedStatement,
  txs: AppTransaction[],
  aliases: Alias[],
  templateItems: TemplateItemRef[]
): MatchResult {
  const used = new Set<string>();
  const matched: MatchedLine[] = [];
  const pending: StatementLine[] = [];
  const lines = statement.lines.filter((l) => l.kind !== 'payment');

  const take = (line: StatementLine, candidates: AppTransaction[], maxGap: number, byDate = true) => {
    let best: { tx: AppTransaction; gap: number } | null = null;
    for (const tx of candidates) {
      if (used.has(tx.id)) continue;
      const gap = byDate ? Math.abs(days(tx.date, line.date)) : 0;
      if (gap > maxGap) continue;
      if (!best || gap < best.gap) best = { tx, gap };
    }
    if (!best) return false;
    used.add(best.tx.id);
    matched.push({ line, tx: best.tx, dateGap: best.gap });
    return true;
  };

  const afterClose = (tx: AppTransaction) => tx.date > statement.statementDate;

  for (const line of lines) {
    if (line.kind === 'installment') {
      const candidates = txs.filter((tx) => {
        if (!tx.isInstallment || tx.type !== 'expense' || tx.amount !== line.amount || !afterClose(tx)) return false;
        const n = installmentNumber(tx.description);
        return !n || !line.installment || (n.number === line.installment.number && n.total === line.installment.total);
      });
      if (!take(line, candidates, Infinity, false)) pending.push(line);
    } else if (line.kind === 'credit') {
      const candidates = txs.filter((tx) => tx.type === 'income' && tx.amount === -line.amount);
      if (!take(line, candidates, MAX_DATE_GAP)) pending.push(line);
    } else {
      const candidates = txs.filter((tx) => tx.type === 'expense' && !tx.isInstallment && tx.amount === line.amount);
      if (!take(line, candidates, MAX_DATE_GAP)) pending.push(line);
    }
  }

  // Monto distinto: mismo comercio (o un único candidato el mismo día) con otro monto
  const aliasByKey = new Map(aliases.map((a) => [a.key, a]));
  const amountDiffs: AmountDiff[] = [];
  const missing: MissingLine[] = [];
  for (const line of pending) {
    const key = merchantKey(line.description);
    const alias = aliasByKey.get(key);
    const near = txs.filter(
      (tx) =>
        !used.has(tx.id) &&
        tx.type === (line.amount < 0 ? 'income' : 'expense') &&
        tx.isInstallment === (line.kind === 'installment') &&
        (line.kind === 'installment' ? afterClose(tx) : Math.abs(days(tx.date, line.date)) <= 2) &&
        Math.abs(tx.amount - Math.abs(line.amount)) <= Math.max(2000, Math.abs(line.amount) * 0.15)
    );
    const sameMerchant = near.filter(
      (tx) =>
        (alias && tx.description.toLowerCase() === alias.description.toLowerCase()) ||
        merchantKey(tx.description).split(' ').some((w) => w.length >= 4 && key.includes(w))
    );
    const pick = sameMerchant[0] ?? (near.length === 1 ? near[0] : null);
    if (pick) {
      used.add(pick.id);
      amountDiffs.push({ line, tx: pick });
      continue;
    }
    missing.push({
      line,
      suggestion: alias
        ? { description: alias.description, budgetId: alias.budgetId, categoryId: alias.categoryId, entityId: alias.entityId, nature: alias.nature }
        : { description: titleCase(line.description), budgetId: null, categoryId: null, entityId: null, nature: 'own' },
    });
  }

  // En la app pero no en el estado de cuenta: solo lo que cae en el período (las
  // cuotas de este estado se fechan después del cierre y se revisan arriba)
  const extra = txs.filter(
    (tx) =>
      !used.has(tx.id) &&
      !tx.isInstallment &&
      // Los ajustes de diferencia al pagar la tarjeta solo existen en la app
      !/^diferencia/i.test(tx.description) &&
      tx.date >= statement.periodStart &&
      tx.date <= statement.periodEnd
  );

  // Plantilla desactualizada: un cargo de plantilla cobrado por otro monto
  const templateByDesc = new Map(templateItems.map((t) => [t.description.toLowerCase(), t]));
  const templateDrift: TemplateDrift[] = [];
  for (const { line, tx } of [...matched, ...amountDiffs]) {
    const item = templateByDesc.get(tx.description.toLowerCase());
    if (item && item.amount !== line.amount && line.amount > 0) {
      templateDrift.push({ item, amount: line.amount, line });
    }
  }

  return { matched, amountDiffs, missing, extra, templateDrift };
}
