import { describe, expect, it } from 'vitest';
import { matchStatement, merchantKey, type AppTransaction } from './match';
import { parseSantanderStatement, type ParsedStatement } from './parse-santander';

// Texto como lo arma pdfToLines: columnas separadas por doble espacio
const LINES = [
  'Nº DE TARJETA DE CRÉDITO  XXXX XXXX XXXX 1669  WORLDMEMBER VISA  FECHA ESTADO DE CUENTA  25/09/2026',
  'PERÍODO FACTURADO  26/08/2026  25/09/2026  PAGAR HASTA  05/10/2026',
  'MONTO TOTAL FACTURADO A PAGAR  $ 125.990  MONTO MÍNIMO A PAGAR  $ 12.000',
  '2. PERÍODO ACTUAL',
  'SANTIAGO  28/08/26  MONTO CANCELADO  $ -500.000',
  'SANTIAGO  02/09/26  COPEC 20215  $ 30.000',
  'SANTIAGO  10/09/26  LIDER EXPRESS  CL  45.000  $ 45.000',
  'SANTIAGO  15/03/26  IPHONE  CUOTA COMERCIO  09/36  $ 60.990',
  'MOVIMIENTOS TARJETA XXXX-2222',
  'SANTIAGO  20/09/26  DEVOLUCION COPEC  $ -10.000',
  'III. INFORMACIÓN DE PAGO',
  'SANTIAGO  21/09/26  NO DEBE LEERSE  $ 999',
];

const parsed = (): ParsedStatement => {
  const r = parseSantanderStatement(LINES);
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

describe('parseSantanderStatement', () => {
  it('lee el encabezado', () => {
    expect(parsed()).toMatchObject({
      card: '1669',
      product: 'WORLDMEMBER VISA',
      statementDate: '2026-09-25',
      periodStart: '2026-08-26',
      periodEnd: '2026-09-25',
      dueDate: '2026-10-05',
      totalBilled: 125_990,
      minimumPayment: 12_000,
    });
  });

  it('clasifica pagos, compras, cuotas y abonos, y separa por tarjeta adicional', () => {
    const lines = parsed().lines;
    expect(lines.map((l) => [l.kind, l.card, l.description, l.amount])).toEqual([
      ['payment', '1669', 'MONTO CANCELADO', -500_000],
      ['purchase', '1669', 'COPEC 20215', 30_000],
      ['purchase', '1669', 'LIDER EXPRESS', 45_000],
      ['installment', '1669', 'IPHONE', 60_990],
      ['credit', '2222', 'DEVOLUCION COPEC', -10_000],
    ]);
    expect(lines[3].installment).toEqual({ number: 9, total: 36 });
    expect(lines[3].date).toBe('2026-03-15');
  });

  it('cuadra el total facturado sin contar los pagos', () => {
    expect(parsed().balanced).toBe(true);
  });

  it('rechaza un PDF que no es estado de cuenta', () => {
    expect(parseSantanderStatement(['Cartola cuenta corriente'])).toEqual({ ok: false, error: expect.any(String) });
  });
});

describe('merchantKey', () => {
  it('normaliza el comercio', () => {
    expect(merchantKey('COPEC 20215')).toBe('copec');
    expect(merchantKey('DROPBOX*N9P7Q6VC')).toBe('dropbox');
    expect(merchantKey('MP *MELIMAS')).toBe('melimas');
  });
});

describe('matchStatement', () => {
  const tx = (over: Partial<AppTransaction>): AppTransaction => ({
    id: over.id ?? Math.random().toString(),
    date: '2026-09-02',
    description: 'x',
    amount: 0,
    type: 'expense',
    isInstallment: false,
    isReconciled: false,
    budgetId: null,
    categoryId: null,
    entityId: null,
    nature: 'own',
    ...over,
  });

  it('cruza compras, cuotas y abonos; detecta monto distinto, faltantes y sobrantes', () => {
    const txs = [
      tx({ id: 'copec', description: 'Copec', amount: 30_000, date: '2026-09-04' }),
      tx({ id: 'lider', description: 'Lider Express', amount: 44_000, date: '2026-09-10' }),
      // Cuota 8 (anterior) y 9 (de este estado, fechada después del cierre)
      tx({ id: 'cuota8', description: 'iPhone - Cuota 8/36', amount: 60_990, date: '2026-09-05', isInstallment: true }),
      tx({ id: 'cuota9', description: 'iPhone - Cuota 9/36', amount: 60_990, date: '2026-10-05', isInstallment: true }),
      tx({ id: 'dev', description: 'Devolución', amount: 10_000, type: 'income', date: '2026-09-21' }),
      tx({ id: 'extra', description: 'Netflix', amount: 9_990, date: '2026-09-12' }),
      tx({ id: 'dif', description: 'Diferencia positiva TC', amount: 1, date: '2026-09-12' }),
    ];
    const r = matchStatement(parsed(), txs, [], [{ id: 't1', description: 'Copec', amount: 25_000 }]);

    expect(Object.fromEntries(r.matched.map((m) => [m.line.description, m.tx.id]))).toEqual({
      'COPEC 20215': 'copec',
      IPHONE: 'cuota9',
      'DEVOLUCION COPEC': 'dev',
    });
    expect(r.matched.find((m) => m.tx.id === 'copec')!.dateGap).toBe(2);
    expect(r.amountDiffs.map((d) => d.tx.id)).toEqual(['lider']);
    expect(r.missing).toEqual([]);
    expect(r.extra.map((t) => t.id)).toEqual(['extra']);
    expect(r.templateDrift).toEqual([{ item: { id: 't1', description: 'Copec', amount: 25_000 }, amount: 30_000, line: expect.anything() }]);
  });

  it('sugiere datos de un alias conocido para lo que falta en la app', () => {
    const r = matchStatement(parsed(), [], [
      { key: 'copec', description: 'Bencina', budgetId: 'b', categoryId: 'c', entityId: 'e', nature: 'own' },
    ], []);
    const copec = r.missing.find((m) => m.line.description === 'COPEC 20215')!;
    expect(copec.suggestion).toEqual({ description: 'Bencina', budgetId: 'b', categoryId: 'c', entityId: 'e', nature: 'own' });
    expect(r.missing.find((m) => m.line.description === 'LIDER EXPRESS')!.suggestion!.description).toBe('Lider Express');
  });
});
