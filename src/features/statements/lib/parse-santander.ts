/**
 * Lee el estado de cuenta de tarjeta de crédito de Santander (texto por líneas,
 * ver pdf-lines.ts): datos del encabezado y cada operación del período.
 */

export type StatementLineKind = 'purchase' | 'installment' | 'credit' | 'payment';

export type StatementLine = {
  /** Posición en el estado de cuenta (identifica la línea en la revisión) */
  index: number;
  /** Últimos 4 dígitos de la tarjeta (titular o adicional) */
  card: string;
  /** YYYY-MM-DD: fecha de operación (en cuotas, la de la compra original) */
  date: string;
  description: string;
  /** Cargo del mes; negativo en abonos y pagos */
  amount: number;
  kind: StatementLineKind;
  /** Solo cuotas: número de cuota y total */
  installment: { number: number; total: number } | null;
};

export type ParsedStatement = {
  /** Últimos 4 dígitos de la tarjeta titular */
  card: string;
  product: string | null;
  statementDate: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
  totalBilled: number;
  minimumPayment: number | null;
  lines: StatementLine[];
  /** La suma de las líneas cuadra con el total facturado */
  balanced: boolean;
};

export type ParseStatementResult = { ok: true; data: ParsedStatement } | { ok: false; error: string };

const money = (s: string) => parseInt(s.replace(/[$\s.]/g, ''), 10);
const dmy = (s: string) => {
  const [d, m, y] = s.split('/');
  return `${y.length === 2 ? `20${y}` : y}-${m}-${d}`;
};

/** Columnas que siguen a la descripción y no son parte del comercio */
const COLUMN = /^(CUOTA COMERCIO|N\/CUOTAS PRECIO|COMPRAS P\.A\.T\.|[\d.,]+ ?%|\$.*|-?[\d.,]+|\d{2}\/\d{2})$/;
const CURRENCY = /^[A-Z]{2}$/;

export function parseSantanderStatement(lines: string[]): ParseStatementResult {
  const text = lines.join(' ');
  const find = (re: RegExp) => text.match(re);

  const card = find(/N[º°] DE TARJETA DE CR[EÉ]DITO\s+X{4}\s?X{4}\s?X{4}\s?(\d{4})(?:\s+([A-Z][A-Z ]+?))?\s+FECHA/);
  const statementDate = find(/FECHA ESTADO DE CUENTA\s+(\d{2}\/\d{2}\/\d{4})/);
  const period = find(/PER[IÍ]ODO FACTURADO\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/);
  const due = find(/PAGAR HASTA\s+(\d{2}\/\d{2}\/\d{4})/);
  const total = find(/MONTO TOTAL FACTURADO A PAGAR\s+\$\s?([\d.]+)/);
  const minimum = find(/MONTO M[IÍ]NIMO A PAGAR\s+\$\s?([\d.]+)/);

  if (!card || !statementDate || !period || !total) {
    return {
      ok: false,
      error: 'No reconozco este PDF como un estado de cuenta de tarjeta de crédito Santander.',
    };
  }

  const result: StatementLine[] = [];
  let inDetail = false;
  let currentCard = card[1];
  for (const line of lines) {
    if (/^2\.\s?PER[IÍ]ODO ACTUAL/.test(line)) {
      inDetail = true;
      continue;
    }
    if (/^III\.\s/.test(line)) break;
    if (!inDetail) continue;

    const cardHeader = line.match(/MOVIMIENTOS TARJETA X{4}-(\d{4})/);
    if (cardHeader) {
      currentCard = cardHeader[1];
      continue;
    }

    const dateMatch = line.match(/(?<![\d/])(\d{2}\/\d{2}\/\d{2})(?![\d/])/);
    const amountMatch = line.match(/\$\s?(-?[\d.]+)\s*$/);
    if (!dateMatch || !amountMatch || dateMatch.index == null) continue;

    const after = line.slice(dateMatch.index + dateMatch[0].length).trim();
    const segments = after.split(/\s{2,}/);
    const descParts: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const next = segments[i + 1] ?? '';
      if (i > 0 && (COLUMN.test(seg) || (CURRENCY.test(seg) && /^[\d.,]+$/.test(next)))) break;
      descParts.push(seg);
    }
    const description = descParts.join(' ').replace(/\s+/g, ' ').trim();
    const amount = money(amountMatch[1]);
    const inst = line.match(/(\d{2})\/(\d{2})\s+\$\s?[\d.]+\s*$/);

    const kind: StatementLineKind = /MONTO CANCELADO|PAGO TARJETA/i.test(description)
      ? 'payment'
      : amount < 0
        ? 'credit'
        : inst
          ? 'installment'
          : 'purchase';

    result.push({
      index: result.length,
      card: currentCard,
      date: dmy(dateMatch[1]),
      description,
      amount,
      kind,
      installment: inst ? { number: parseInt(inst[1], 10), total: parseInt(inst[2], 10) } : null,
    });
  }

  const totalBilled = money(total[1]);
  const sum = result.filter((l) => l.kind !== 'payment').reduce((acc, l) => acc + l.amount, 0);

  return {
    ok: true,
    data: {
      card: card[1],
      product: card[2]?.trim() ?? null,
      statementDate: dmy(statementDate[1]),
      periodStart: dmy(period[1]),
      periodEnd: dmy(period[2]),
      dueDate: due ? dmy(due[1]) : null,
      totalBilled,
      minimumPayment: minimum ? money(minimum[1]) : null,
      lines: result,
      balanced: sum === totalBilled,
    },
  };
}
