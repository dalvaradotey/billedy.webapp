import { describe, expect, it, vi } from 'vitest';

// buildBalances es puro; el módulo importa la conexión solo para las consultas
vi.mock('@/lib/db', () => ({ db: {} }));

import { buildBalances, toClosingSnapshot, type BalanceRange } from './cycle-balance';
import { parseBucketRows, type BucketRow } from './cycle-buckets';
import { reservesForRange, parseReserveRows } from './cycle-reserves';

const row = (over: Partial<BucketRow>): BucketRow => ({
  key: 'oct',
  bucket: 'income',
  nature: 'own',
  cardAccountId: null,
  inRange: true,
  isInstallment: false,
  isPaid: true,
  isReal: true,
  total: 0,
  count: 1,
  ...over,
});

const sep: BalanceRange = { key: 'sep', start: '2026-08-25', end: '2026-09-24', status: 'closed' };
const oct: BalanceRange = { key: 'oct', start: '2026-09-25', end: '2026-10-25', status: 'open' };
const cards = new Map([['tc', 'WorldMember']]);

describe('buildBalances', () => {
  it('arma la cascada: ingresos + abonos − débito − pago TC − ahorro', () => {
    const rows = [
      row({ bucket: 'income', total: 4_000_000 }),
      row({ bucket: 'reimbursement', nature: 'reimbursement', total: 50_000 }),
      row({ bucket: 'debit_expense', total: 2_000_000 }),
      row({ bucket: 'card_payment', cardAccountId: 'tc', total: 1_200_000 }),
      row({ bucket: 'savings_in', total: 300_000 }),
      row({ bucket: 'savings_out', total: 100_000 }),
      row({ bucket: 'provision_in', total: 80_000 }),
      row({ bucket: 'provision_out', total: 30_000 }),
      row({ bucket: 'investment_in', total: 20_000 }),
    ];
    const b = buildBalances([oct], rows, cards).get('oct')!;
    expect(b.balanceBeforeSavings.real).toBe(4_000_000 + 50_000 - 2_000_000 - 1_200_000);
    expect(b.finalBalance.real).toBe(850_000 - 300_000 + 100_000 - 80_000 + 30_000 - 20_000);
    expect(toClosingSnapshot(b)).toMatchObject({ version: 1, finalBalance: b.finalBalance.real, savingsIn: 300_000 });
  });

  it('separa lo real de lo comprometido en el ciclo abierto', () => {
    const rows = [
      row({ bucket: 'income', total: 1_000 }),
      row({ bucket: 'debit_expense', total: 300, isPaid: false, isReal: false }),
    ];
    const b = buildBalances([oct], rows, cards).get('oct')!;
    expect(b.finalBalance).toEqual({ real: 1_000, committed: 700, projected: 700 });
  });

  it('en un ciclo cerrado lo comprometido es igual a lo real y avisa pendientes vencidos', () => {
    const rows = [
      row({ key: 'sep', bucket: 'income', total: 1_000 }),
      row({ key: 'sep', bucket: 'debit_expense', total: 300, isPaid: false, isReal: false }),
    ];
    const b = buildBalances([sep], rows, cards).get('sep')!;
    expect(b.finalBalance.committed).toBe(1_000);
    expect(b.warnings).toContainEqual({ kind: 'overdue_pending', count: 1, amount: 300 });
  });

  it('el estado de cuenta del ciclo anterior es el pago pendiente del abierto', () => {
    const rows = [
      // Compra en septiembre y cuota fechada en la ventana posterior al cierre
      row({ key: 'sep', bucket: 'card_spend', cardAccountId: 'tc', total: 500_000 }),
      row({ key: 'sep', bucket: 'card_spend', cardAccountId: 'tc', inRange: false, isInstallment: true, total: 40_000 }),
      row({ key: 'sep', bucket: 'card_credit', cardAccountId: 'tc', nature: 'reimbursement', total: 10_000 }),
    ];
    const b = buildBalances([sep, oct], rows, cards);
    expect(b.get('sep')!.card.upcomingStatement).toBe(530_000);
    expect(b.get('oct')!.card.pendingPayment).toBe(530_000);
    expect(b.get('oct')!.finalBalance.projected).toBe(-530_000);
    expect(b.get('oct')!.card.paymentBreakdown).toMatchObject({ own: 540_000, credits: 10_000, total: 530_000 });
  });

  it('avisa si el pago TC no calza con el estado de cuenta (ciclo cerrado)', () => {
    const nov: BalanceRange = { key: 'nov', start: '2026-10-26', end: '2026-11-25', status: 'closed' };
    const closedOct = { ...oct, status: 'closed' as const };
    const rows = [
      row({ key: 'oct', bucket: 'card_spend', cardAccountId: 'tc', total: 500_000 }),
      row({ key: 'nov', bucket: 'card_payment', cardAccountId: 'tc', total: 450_000 }),
    ];
    const b = buildBalances([closedOct, nov], rows, cards).get('nov')!;
    expect(b.warnings).toContainEqual({ kind: 'card_payment_mismatch', cardName: 'WorldMember', expected: 500_000, paid: 450_000 });
  });

  it('avisa si falta el pago TC en un ciclo cerrado y si hay días sin ciclo', () => {
    const nov: BalanceRange = { key: 'nov', start: '2026-10-28', end: '2026-11-25', status: 'closed' };
    const closedOct = { ...oct, status: 'closed' as const };
    const rows = [row({ key: 'oct', bucket: 'card_spend', cardAccountId: 'tc', total: 500_000 })];
    const b = buildBalances([closedOct, nov], rows, cards).get('nov')!;
    expect(b.warnings).toContainEqual({ kind: 'card_payment_missing', cardName: 'WorldMember', expected: 500_000 });
    expect(b.warnings).toContainEqual({ kind: 'gap_before', days: 2 });
  });

  it('separa el gasto propio en TC (techo) de lo de otros y reembolsable', () => {
    const rows = [
      row({ bucket: 'card_spend', cardAccountId: 'tc', nature: 'own', total: 100_000 }),
      row({ bucket: 'card_spend', cardAccountId: 'tc', nature: 'external', total: 50_000 }),
      row({ bucket: 'card_spend', cardAccountId: 'tc', nature: 'reimbursable', total: 259_500 }),
      row({ bucket: 'card_spend', cardAccountId: 'tc', nature: 'own', isPaid: false, isReal: false, total: 9_000 }),
      row({ bucket: 'card_spend', cardAccountId: 'tc', inRange: false, isInstallment: true, total: 41_000 }),
    ];
    const c = buildBalances([oct], rows, cards).get('oct')!.card;
    expect(c.own).toEqual({ real: 141_000, committed: 150_000, installments: 41_000 });
    expect(c.upcomingBreakdown).toMatchObject({ own: 141_000, external: 50_000, reimbursable: 259_500 });
    expect(c.upcomingStatementCommitted - c.upcomingStatement).toBe(9_000);
  });

  it('descuenta los abonos reservados y los libera en el ciclo del pago', () => {
    const reserves = [{ reservedOn: '2026-10-15', releasedOn: '2026-10-30', amount: 259_500 }];
    const nov: BalanceRange = { key: 'nov', start: '2026-10-26', end: '2026-11-25', status: 'open' };
    const b = buildBalances([{ ...oct, status: 'closed' }, nov], [row({ bucket: 'income', total: 1_000_000 })], cards, reserves);
    expect(b.get('oct')!.reservedIn.real).toBe(259_500);
    expect(b.get('oct')!.finalBalance.real).toBe(740_500);
    expect(b.get('nov')!.reservedOut.real).toBe(259_500);
    expect(b.get('nov')!.finalBalance.real).toBe(259_500);
  });
});

describe('reservesForRange', () => {
  it('no reserva si el gasto se paga dentro del mismo rango', () => {
    expect(reservesForRange([{ reservedOn: '2026-10-01', releasedOn: '2026-10-10', amount: 5 }], '2026-09-25', '2026-10-25')).toEqual({
      reserved: 0,
      released: 0,
    });
  });

  it('mantiene la reserva mientras el gasto no se paga', () => {
    expect(reservesForRange([{ reservedOn: '2026-10-01', releasedOn: null, amount: 5 }], '2026-09-25', '2026-10-25')).toEqual({
      reserved: 5,
      released: 0,
    });
  });

  it('parseReserveRows convierte montos y nulos', () => {
    expect(parseReserveRows([{ reserved_on: '2026-10-15', released_on: null, amount: '259500.00' }])).toEqual([
      { reservedOn: '2026-10-15', releasedOn: null, amount: 259_500 },
    ]);
  });
});

describe('parseBucketRows', () => {
  it('convierte la fila cruda de SQL', () => {
    expect(
      parseBucketRows([
        {
          key: 'oct',
          bucket: 'income',
          nature: 'own',
          card_account_id: null,
          in_range: true,
          is_installment: false,
          is_paid: true,
          is_real: true,
          total: '1500.40',
          n: 2,
        },
      ])
    ).toEqual([row({ total: 1500, count: 2 })]);
  });
});
