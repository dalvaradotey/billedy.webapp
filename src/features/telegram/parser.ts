/**
 * Interpreta un mensaje del bot como gasto (o ingreso) con un formato libre:
 *
 *   "15990 lider compras casa"        → monto, comercio, presupuesto
 *   "8.500 copec movilización débito" → además la cuenta
 *   "12 lucas almuerzo ayer"          → montos en lucas o k, fecha relativa
 *   "+150000 aporte anais"            → ingreso
 *
 * Solo reglas: el número es el monto; el resto se compara con tus tiendas,
 * presupuestos y cuentas; lo que sobra queda como descripción.
 */

export type ParseBudget = { id: string; name: string; categoryId: string | null; defaultAccountId: string | null };
export type ParseAccount = { id: string; name: string; type: string; isDefault: boolean; usage: number };
export type ParseEntity = { id: string; name: string };
/** Último uso de una descripción: completa presupuesto, categoría y cuenta como el formulario */
export type ParsePrevious = { description: string; budgetId: string | null; categoryId: string | null; accountId: string | null };

export type ParseContext = {
  budgets: ParseBudget[];
  accounts: ParseAccount[];
  entities: ParseEntity[];
  previous: ParsePrevious[];
  /** Hoy en Chile, a medianoche UTC */
  today: Date;
};

export type ParsedExpense = {
  type: 'expense' | 'income';
  amount: number;
  description: string;
  entityId: string | null;
  budgetId: string | null;
  categoryId: string | null;
  accountId: string;
  /** YYYY-MM-DD */
  date: string;
  /** El mensaje traía detalle (comercio o descripción), no solo el monto */
  hasDetail: boolean;
};

export type ParseResult = { ok: true; data: ParsedExpense } | { ok: false; error: string };

const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'para', 'por', 'con', 'a', 'al', 'un', 'una']);
/** Palabras de nombres de cuenta que no sirven para distinguirlas */
const ACCOUNT_NOISE = new Set(['cuenta', 'corriente', 'visa', 'mastercard', 'gold', 'banco', 'fondo', 'ahorro', 'tarjeta', 'credito']);
const CARD_WORDS = new Set(['tc', 'tarjeta', 'credito']);
const DEBIT_WORDS = new Set(['debito', 'corriente', 'cuentacorriente']);
const CASH_WORDS = new Set(['efectivo', 'cash']);

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9$+.,/#\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const words = (s: string) =>
  normalize(s)
    .split(' ')
    .map((w) => w.replace(/[#.,]/g, ''))
    .filter((w) => w && !STOPWORDS.has(w));

/** "15990", "15.990", "$15.990", "12k", "12mil" → número; null si no es monto */
function readAmount(token: string, next: string | undefined): { value: number; consumedNext: boolean } | null {
  const m = token.match(/^\+?\$?(\d{1,3}(?:[.,]\d{3})+|\d+)(k|mil|lucas?)?$/);
  if (!m) return null;
  let value = parseInt(m[1].replace(/[.,]/g, ''), 10);
  let consumedNext = false;
  if (m[2]) value *= 1000;
  else if (next && /^(k|mil|lucas?)$/.test(next)) {
    value *= 1000;
    consumedNext = true;
  }
  return value > 0 ? { value, consumedNext } : null;
}

function readDate(token: string, today: Date): Date | null {
  const day = (offset: number) => new Date(today.getTime() - offset * 86_400_000);
  if (token === 'hoy') return day(0);
  if (token === 'ayer') return day(1);
  if (token === 'anteayer' || token === 'antier') return day(2);
  const m = token.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (m) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), parseInt(m[2], 10) - 1, parseInt(m[1], 10)));
    if (isNaN(d.getTime())) return null;
    // Una fecha "futura" sin año es del año pasado (p. ej. 28/12 escrito en enero)
    if (d > today) d.setUTCFullYear(d.getUTCFullYear() - 1);
    return d;
  }
  return null;
}

/** Busca una frase (lista de palabras) contigua dentro de los tokens; devuelve el índice o -1 */
function findPhrase(tokens: string[], phrase: string[]): number {
  if (!phrase.length) return -1;
  for (let i = 0; i + phrase.length <= tokens.length; i++) {
    if (phrase.every((w, j) => tokens[i + j] === w)) return i;
  }
  return -1;
}

const prefixMatch = (token: string, word: string) => token === word || (token.length >= 4 && word.startsWith(token));

export function parseExpenseMessage(text: string, ctx: ParseContext): ParseResult {
  const raw = normalize(text).split(' ').filter(Boolean);
  let type: 'expense' | 'income' = 'expense';
  let amount: number | null = null;
  let date = ctx.today;
  const rest: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    const token = raw[i];
    if (amount == null) {
      const a = readAmount(token, raw[i + 1]);
      if (a) {
        amount = a.value;
        if (token.startsWith('+')) type = 'income';
        if (a.consumedNext) i++;
        continue;
      }
    }
    const d = readDate(token, ctx.today);
    if (d) {
      date = d;
      continue;
    }
    if (token === 'ingreso') {
      type = 'income';
      continue;
    }
    if (token === 'gasto' && rest.length === 0) continue;
    rest.push(token.replace(/[#.,]/g, ''));
  }

  if (amount == null) {
    return { ok: false, error: 'No encontré el monto. Escribe por ejemplo: 15990 lider compras casa' };
  }

  let tokens = rest.filter((t) => t && !STOPWORDS.has(t));
  const take = (start: number, length: number) => {
    tokens = [...tokens.slice(0, start), ...tokens.slice(start + length)];
  };

  // Cuenta: por nombre ("santander", "worldmember", "rut") o por tipo ("débito", "tc", "efectivo")
  const spendable = ctx.accounts.filter((a) => a.type === 'checking' || a.type === 'cash' || a.type === 'credit_card');
  const byPreference = (list: ParseAccount[]) =>
    [...list].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.usage - a.usage)[0] ?? null;
  let account: ParseAccount | null = null;
  for (let i = 0; i < tokens.length && !account; i++) {
    const t = tokens[i];
    let candidates: ParseAccount[] = [];
    if (CARD_WORDS.has(t)) candidates = spendable.filter((a) => a.type === 'credit_card');
    else if (DEBIT_WORDS.has(t)) candidates = spendable.filter((a) => a.type === 'checking');
    else if (CASH_WORDS.has(t)) candidates = spendable.filter((a) => a.type === 'cash');
    else if (t.length >= 2) {
      candidates = spendable.filter((a) =>
        words(a.name).some((w) => !ACCOUNT_NOISE.has(w) && !/^\d+$/.test(w) && (w === t || (t.length >= 4 && w.startsWith(t))))
      );
      if (t === 'wm') candidates = spendable.filter((a) => /world ?member/.test(normalize(a.name)));
    }
    if (candidates.length) {
      account = byPreference(candidates);
      take(i, 1);
    }
  }

  // Tienda: el nombre completo (todas sus palabras, seguidas) dentro del mensaje; gana el más largo
  let entity: ParseEntity | null = null;
  let entityAt = -1;
  let entityLength = 0;
  for (const e of ctx.entities) {
    const phrase = words(e.name);
    if (!phrase.length || (phrase.length === 1 && phrase[0].length < 3)) continue;
    const at = findPhrase(tokens, phrase);
    if (at >= 0 && phrase.length > entityLength) {
      entity = e;
      entityAt = at;
      entityLength = phrase.length;
    }
  }
  if (entity) take(entityAt, entityLength);

  // Presupuesto: el que tenga más palabras de su nombre en el mensaje (o sus iniciales, p. ej. "cc")
  let budget: ParseBudget | null = null;
  if (type === 'expense') {
    let best: { budget: ParseBudget; score: number; used: number[] } | null = null;
    let tie = false;
    for (const b of ctx.budgets) {
      const name = words(b.name).filter((w) => !/^\d+$/.test(w));
      if (!name.length) continue;
      const used: number[] = [];
      for (const w of name) {
        const idx = tokens.findIndex((t, i) => !used.includes(i) && prefixMatch(t, w));
        if (idx >= 0) used.push(idx);
      }
      const initials = name.length >= 2 ? name.map((w) => w[0]).join('') : null;
      const initialsAt = initials ? tokens.indexOf(initials) : -1;
      const score = initialsAt >= 0 ? 1 : used.length / name.length;
      if (score === 0) continue;
      const candidateUsed = initialsAt >= 0 ? [initialsAt] : used;
      if (!best || score > best.score) {
        best = { budget: b, score, used: candidateUsed };
        tie = false;
      } else if (score === best.score) {
        tie = true;
      }
    }
    if (best && !tie) {
      budget = best.budget;
      tokens = tokens.filter((_, i) => !best!.used.includes(i));
    }
  }

  const leftover = tokens.join(' ').trim();
  const description = entity
    ? entity.name
    : leftover
      ? leftover.charAt(0).toUpperCase() + leftover.slice(1)
      : budget?.name ?? (type === 'income' ? 'Ingreso' : 'Gasto');

  // Lo que ya usaste con esa descripción completa lo que falte (como las sugerencias del formulario)
  const prev = ctx.previous.find((p) => normalize(p.description) === normalize(description)) ?? null;
  if (!budget && type === 'expense' && prev?.budgetId) budget = ctx.budgets.find((b) => b.id === prev.budgetId) ?? null;

  const fallbackAccount =
    (budget?.defaultAccountId && spendable.find((a) => a.id === budget!.defaultAccountId)) ||
    (prev?.accountId && spendable.find((a) => a.id === prev.accountId)) ||
    byPreference(spendable.filter((a) => a.type === 'checking')) ||
    byPreference(spendable);
  const finalAccount = account ?? fallbackAccount ?? null;
  if (!finalAccount) return { ok: false, error: 'No tienes cuentas para registrar el movimiento.' };

  return {
    ok: true,
    data: {
      type,
      amount,
      // Con la misma ortografía que ya usaste ("Aporte Anais", no "Aporte anais")
      description: prev?.description ?? description,
      entityId: entity?.id ?? null,
      budgetId: budget?.id ?? null,
      categoryId: budget?.categoryId ?? prev?.categoryId ?? null,
      accountId: finalAccount.id,
      date: date.toISOString().slice(0, 10),
      hasDetail: Boolean(entity || leftover),
    },
  };
}
