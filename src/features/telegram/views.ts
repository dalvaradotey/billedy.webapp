import { formatCurrency, getToday } from '@/lib/formatting';
import { esc, type InlineKeyboard } from './api';
import type { ParseContext, ParsedExpense } from './parser';

/**
 * Vistas del bot (texto y botones de cada paso). Puras: no leen la BD ni llaman
 * a Telegram, así se pueden probar solas.
 */

/**
 * Borrador con el paso de la conversación:
 * - detail: solo vino el monto, se pregunta "¿qué fue?"
 * - budget: vino el detalle pero no el presupuesto, se ofrece elegirlo
 * - category: sin presupuesto ni categoría, se ofrece elegir una categoría
 * - confirm: resumen con Guardar
 */
export type DraftPayload = ParsedExpense & {
  step?: 'detail' | 'budget' | 'category' | 'confirm';
  /** Ya se preguntó el presupuesto (aunque se haya elegido "Sin presupuesto") */
  budgetAsked?: boolean;
  /** Ya se preguntó la categoría (aunque se haya elegido "Sin categoría") */
  categoryAsked?: boolean;
  /** Mensaje con la pregunta del detalle, para quitarle los botones al responder */
  promptMessageId?: number;
};

export const nextStep = (d: DraftPayload): NonNullable<DraftPayload['step']> =>
  !d.hasDetail && !d.budgetId && d.step !== 'budget' && !d.budgetAsked
    ? 'detail'
    : d.type === 'expense' && !d.budgetId && !d.budgetAsked
      ? 'budget'
      : d.type === 'expense' && !d.budgetId && !d.categoryId && !d.categoryAsked
        ? 'category'
        : 'confirm';

/** Categorías como botones: primero las que usas en gastos; "Ver todas" muestra el resto */
export const categoryKeyboard = (draftId: string, ctx: ParseContext, extra: InlineKeyboard, showAll = false): InlineKeyboard => {
  const listed = ctx.categories.map((c, i) => ({ c, i })).filter(({ c }) => showAll || c.frequent);
  const options = [
    // La posición es la de la lista completa, para que el botón apunte a la categoría correcta
    ...listed.map(({ c, i }) => ({ text: c.name, callback_data: `sc:${draftId}:${i}` })),
    { text: 'Sin categoría', callback_data: `sc:${draftId}:-1` },
  ];
  const rows: InlineKeyboard = [];
  for (let i = 0; i < options.length; i += 2) rows.push(options.slice(i, i + 2));
  if (!showAll && listed.length < ctx.categories.length) rows.push([{ text: 'Ver todas', callback_data: `ka:${draftId}` }]);
  return [...rows, ...extra];
};

export const budgetKeyboard = (draftId: string, ctx: ParseContext, extra: InlineKeyboard): InlineKeyboard => {
  const options = [
    ...ctx.budgets.map((b, i) => ({ text: b.name, callback_data: `sb:${draftId}:${i}` })),
    { text: 'Sin presupuesto', callback_data: `sb:${draftId}:-1` },
  ];
  const rows: InlineKeyboard = [];
  for (let i = 0; i < options.length; i += 2) rows.push(options.slice(i, i + 2));
  return [...rows, ...extra];
};

/** Texto y botones del paso actual del borrador */
export function stepView(draftId: string, d: DraftPayload, ctx: ParseContext): { text: string; keyboard: InlineKeyboard } {
  const step = nextStep(d);
  if (step === 'detail') {
    return {
      text: `<b>${d.type === 'income' ? '+' : '−'}${formatCurrency(d.amount)}</b> · ¿Qué fue?\nEscríbeme el detalle, por ejemplo <code>lider</code> o <code>almuerzo</code>. También puedes agregar el presupuesto.`,
      keyboard: [[
        { text: 'Sin detalle', callback_data: `nd:${draftId}` },
        { text: '✖️ Cancelar', callback_data: `c:${draftId}` },
      ]],
    };
  }
  if (step === 'budget') {
    return {
      text: `${summary(d, ctx)}\n\n¿Lo asocio a un presupuesto?`,
      keyboard: budgetKeyboard(draftId, ctx, [[{ text: '✖️ Cancelar', callback_data: `c:${draftId}` }]]),
    };
  }
  if (step === 'category') {
    return {
      text: `${summary(d, ctx)}\n\n¿Le pongo una categoría?`,
      keyboard: categoryKeyboard(draftId, ctx, [[{ text: '✖️ Cancelar', callback_data: `c:${draftId}` }]]),
    };
  }
  return { text: summary(d, ctx), keyboard: confirmKeyboard(draftId, d.type) };
}

export const shortDate = (iso: string) => {
  const today = getToday().toISOString().slice(0, 10);
  if (iso === today) return 'hoy';
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
};

export function summary(data: ParsedExpense, ctx: ParseContext): string {
  const account = ctx.accounts.find((a) => a.id === data.accountId);
  const budget = ctx.budgets.find((b) => b.id === data.budgetId);
  const category = ctx.categories.find((c) => c.id === data.categoryId);
  const sign = data.type === 'income' ? '+' : '−';
  // Con presupuesto se muestra el presupuesto; sin él, la categoría si la tiene
  const group = budget ? esc(budget.name) : category ? `🏷️ ${esc(category.name)}` : data.type === 'income' ? 'Ingreso' : 'Sin presupuesto';
  return [
    `<b>${sign}${formatCurrency(data.amount)}</b> · ${esc(data.description)}`,
    `${group} · ${esc(account?.name ?? '—')} · ${shortDate(data.date)}`,
  ].join('\n');
}

export const confirmKeyboard = (draftId: string, type: ParsedExpense['type']): InlineKeyboard => [
  [{ text: '✅ Guardar', callback_data: `s:${draftId}` }],
  [
    { text: '💳 Cuenta', callback_data: `a:${draftId}` },
    ...(type === 'expense' ? [{ text: '📂 Presupuesto', callback_data: `b:${draftId}` }] : []),
  ],
  [
    { text: '🏷️ Categoría', callback_data: `k:${draftId}` },
    { text: '✖️ Cancelar', callback_data: `c:${draftId}` },
  ],
];
