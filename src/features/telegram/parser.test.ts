import { describe, expect, it } from 'vitest';
import { normalize, parseExpenseMessage, type ParseContext } from './parser';

const ctx = (over: Partial<ParseContext> = {}): ParseContext => ({
  today: new Date('2026-10-16T00:00:00Z'),
  categories: [],
  budgets: [
    { id: 'b-casa', name: 'Compras casa', categoryId: 'c-super', defaultAccountId: null },
    { id: 'b-mov', name: 'Movilización', categoryId: 'c-mov', defaultAccountId: 'tc' },
    { id: 'b-cc', name: 'Comida calle', categoryId: 'c-comida', defaultAccountId: null },
  ],
  accounts: [
    { id: 'cc', name: 'Santander Corriente #6114', type: 'checking', isDefault: true, usage: 50 },
    { id: 'tc', name: 'WorldMember VISA #1669', type: 'credit_card', isDefault: false, usage: 80 },
    { id: 'rut', name: 'Cuenta RUT', type: 'checking', isDefault: false, usage: 1 },
    { id: 'cash', name: 'Efectivo', type: 'cash', isDefault: false, usage: 2 },
    { id: 'ahorro', name: 'Fondo Huevito', type: 'savings', isDefault: false, usage: 0 },
  ],
  entities: [
    { id: 'e-lider', name: 'Lider' },
    { id: 'e-copec', name: 'Copec' },
    { id: 'e-lider-express', name: 'Lider Express' },
  ],
  previous: [{ description: 'Aporte Anais', budgetId: null, categoryId: 'c-aporte', accountId: 'cc' }],
  ...over,
});

const parse = (text: string, over?: Partial<ParseContext>) => {
  const r = parseExpenseMessage(text, ctx(over));
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

describe('normalize', () => {
  it('quita tildes, mayúsculas y símbolos raros', () => {
    expect(normalize('  Débito   ÑANDÚ!! ')).toBe('debito nandu');
  });
});

describe('parseExpenseMessage', () => {
  it('lee monto, tienda y presupuesto', () => {
    const d = parse('15990 lider compras casa');
    expect(d).toMatchObject({
      type: 'expense',
      amount: 15990,
      description: 'Lider',
      entityId: 'e-lider',
      budgetId: 'b-casa',
      categoryId: 'c-super',
      accountId: 'cc',
      date: '2026-10-16',
      hasDetail: true,
    });
  });

  it('prefiere la tienda con el nombre más largo', () => {
    expect(parse('5000 lider express').entityId).toBe('e-lider-express');
  });

  it('entiende montos con puntos, $, k y lucas', () => {
    expect(parse('$8.500 copec').amount).toBe(8500);
    expect(parse('12k almuerzo').amount).toBe(12000);
    expect(parse('12 lucas almuerzo').amount).toBe(12000);
    expect(parse('3mil pan').amount).toBe(3000);
  });

  it('reconoce la cuenta por tipo o por nombre', () => {
    expect(parse('8500 copec tc').accountId).toBe('tc');
    expect(parse('8500 copec debito').accountId).toBe('cc');
    expect(parse('8500 copec efectivo').accountId).toBe('cash');
    expect(parse('8500 copec rut').accountId).toBe('rut');
    expect(parse('8500 copec wm').accountId).toBe('tc');
  });

  it('nunca usa una cuenta de ahorro para gastar', () => {
    expect(parse('8500 huevito').accountId).not.toBe('ahorro');
  });

  it('usa la cuenta por defecto del presupuesto', () => {
    expect(parse('2500 movilizacion')).toMatchObject({ budgetId: 'b-mov', accountId: 'tc' });
  });

  it('acepta iniciales del presupuesto, salvo que dos compartan iniciales', () => {
    // "Compras casa" y "Comida calle" son ambos "cc": ambiguo
    expect(parse('4000 completo cc').budgetId).toBeNull();
    const budgets = ctx().budgets.filter((b) => b.id !== 'b-casa');
    expect(parse('4000 completo cc', { budgets }).budgetId).toBe('b-cc');
  });

  it('lee fechas relativas y dd/mm (del año pasado si es futura)', () => {
    expect(parse('5000 pan ayer').date).toBe('2026-10-15');
    expect(parse('5000 pan anteayer').date).toBe('2026-10-14');
    expect(parse('5000 pan 3/10').date).toBe('2026-10-03');
    expect(parse('5000 pan 28/12').date).toBe('2025-12-28');
  });

  it('marca ingresos con + o la palabra ingreso y reutiliza la ortografía previa', () => {
    const d = parse('+150000 aporte anais');
    expect(d).toMatchObject({ type: 'income', description: 'Aporte Anais', categoryId: 'c-aporte', budgetId: null });
    expect(parse('ingreso 20000 venta').type).toBe('income');
  });

  it('sin detalle usa el presupuesto o "Gasto" como descripción', () => {
    expect(parse('5000')).toMatchObject({ description: 'Gasto', hasDetail: false });
  });

  it('un empate entre presupuestos no elige ninguno', () => {
    const d = parse('5000 compras', {
      budgets: [
        { id: 'a', name: 'Compras casa', categoryId: null, defaultAccountId: null },
        { id: 'b', name: 'Compras ropa', categoryId: null, defaultAccountId: null },
      ],
    });
    expect(d.budgetId).toBeNull();
  });

  it('falla sin monto o sin cuentas', () => {
    expect(parseExpenseMessage('lider compras', ctx())).toEqual({ ok: false, error: expect.stringMatching(/monto/) });
    expect(parseExpenseMessage('5000 pan', ctx({ accounts: [] }))).toEqual({ ok: false, error: expect.stringMatching(/cuentas/) });
  });
});
