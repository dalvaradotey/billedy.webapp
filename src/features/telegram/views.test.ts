import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ParseContext } from './parser';
import { categoryKeyboard, confirmKeyboard, nextStep, shortDate, stepView, summary, type DraftPayload } from './views';

const ctx: ParseContext = {
  today: new Date('2026-10-16T00:00:00Z'),
  budgets: [
    { id: 'b1', name: 'Compras casa', categoryId: 'c1', defaultAccountId: null },
    { id: 'b2', name: 'Movilización', categoryId: null, defaultAccountId: null },
  ],
  categories: [
    { id: 'c1', name: 'Supermercado', frequent: true },
    { id: 'c2', name: 'Salud', frequent: false },
  ],
  accounts: [{ id: 'cc', name: 'Santander <Corriente>', type: 'checking', isDefault: true, usage: 1 }],
  entities: [],
  previous: [],
};

const draft = (over: Partial<DraftPayload> = {}): DraftPayload => ({
  type: 'expense',
  amount: 15990,
  description: 'Lider',
  entityId: null,
  budgetId: null,
  categoryId: null,
  accountId: 'cc',
  date: '2026-10-16',
  hasDetail: true,
  ...over,
});

describe('nextStep', () => {
  it('pregunta el detalle si solo vino el monto', () => {
    expect(nextStep(draft({ hasDetail: false }))).toBe('detail');
  });

  it('después el presupuesto, luego la categoría y al final confirma', () => {
    expect(nextStep(draft())).toBe('budget');
    expect(nextStep(draft({ budgetAsked: true }))).toBe('category');
    expect(nextStep(draft({ budgetAsked: true, categoryAsked: true }))).toBe('confirm');
    expect(nextStep(draft({ budgetId: 'b1' }))).toBe('confirm');
  });

  it('los ingresos no piden presupuesto ni categoría', () => {
    expect(nextStep(draft({ type: 'income' }))).toBe('confirm');
  });
});

describe('vistas', () => {
  afterEach(() => vi.useRealTimers());

  it('summary escapa HTML y muestra presupuesto o categoría', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T15:00:00Z'));
    const text = summary(draft({ budgetId: 'b1' }), ctx);
    expect(text).toContain('<b>−$15.990</b> · Lider');
    expect(text).toContain('Compras casa · Santander &lt;Corriente&gt; · hoy');
    expect(summary(draft({ categoryId: 'c2', type: 'income' }), ctx)).toContain('🏷️ Salud');
  });

  it('shortDate muestra "hoy" o d/m', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T15:00:00Z'));
    expect(shortDate('2026-10-16')).toBe('hoy');
    expect(shortDate('2026-09-05')).toBe('5/9');
  });

  it('el teclado de categorías muestra primero las frecuentes, con índice de la lista completa', () => {
    const kb = categoryKeyboard('d1', ctx, []);
    expect(kb.flat().map((b) => b.callback_data)).toEqual(['sc:d1:0', 'sc:d1:-1', 'ka:d1']);
    expect(categoryKeyboard('d1', ctx, [], true).flat().map((b) => b.callback_data)).toEqual(['sc:d1:0', 'sc:d1:1', 'sc:d1:-1']);
  });

  it('confirmar ofrece presupuesto solo en gastos', () => {
    expect(confirmKeyboard('d1', 'income').flat().some((b) => b.callback_data === 'b:d1')).toBe(false);
    expect(confirmKeyboard('d1', 'expense').flat().some((b) => b.callback_data === 'b:d1')).toBe(true);
  });

  it('stepView arma la pregunta de cada paso', () => {
    expect(stepView('d1', draft({ hasDetail: false }), ctx).text).toContain('¿Qué fue?');
    const budget = stepView('d1', draft(), ctx);
    expect(budget.text).toContain('¿Lo asocio a un presupuesto?');
    expect(budget.keyboard.flat().map((b) => b.callback_data)).toContain('sb:d1:1');
    expect(stepView('d1', draft({ budgetAsked: true }), ctx).text).toContain('¿Le pongo una categoría?');
    expect(stepView('d1', draft({ budgetId: 'b1' }), ctx).keyboard[0][0].callback_data).toBe('s:d1');
  });
});
