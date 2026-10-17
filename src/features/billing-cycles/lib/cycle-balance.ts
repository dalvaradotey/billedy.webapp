import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { getToday } from '@/lib/formatting';
import {
  bucketAggregationQuery,
  parseBucketRows,
  type Bucket,
  type BucketRow,
  type DateRange,
} from './cycle-buckets';
import { parseReserveRows, reserveRowsQuery, reservesForRange, type ReserveRow } from './cycle-reserves';

/**
 * Saldo de caja de un ciclo (cascada única).
 * Ver docs/PLAN_SALDOS_CICLOS_Y_TECHO_TC.md §3.
 *
 *   Ingresos + Abonos − Gastos débito − Pago TC = Saldo antes de ahorro
 *   − Aportes a ahorro + Retiros de ahorro
 *   − Abonos reservados + Reservas liberadas    = Saldo final
 */

/**
 * Diferencia tolerada entre el pago TC y la vista estado de cuenta.
 * Bajo este monto no se avisa (ajustes, intereses, compras pagadas en el mismo ciclo).
 */
const CARD_PAYMENT_MISMATCH_THRESHOLD = 10_000;

export type Amounts = {
  /** Solo lo pagado (en TC, además con fecha <= hoy) */
  real: number;
  /** Real + pendientes registrados del ciclo */
  committed: number;
  /** Comprometido + pago TC pendiente (solo ciclo abierto) */
  projected: number;
};

export type CycleWarning =
  | { kind: 'overdue_pending'; count: number; amount: number }
  | { kind: 'card_payment_missing'; cardName: string; expected: number }
  | { kind: 'card_payment_mismatch'; cardName: string; expected: number; paid: number }
  | { kind: 'gap_before'; days: number }
  | { kind: 'changed_since_close'; closedAt: number; current: number };

/** Vista estado de cuenta separada por naturaleza (montos reales) */
export type StatementBreakdown = {
  own: number;
  external: number;
  reimbursable: number;
  fund: number;
  /** Devoluciones / abonos / ajustes en TC (restan) */
  credits: number;
  total: number;
};

export type CycleBalance = {
  income: Amounts;
  reimbursements: Amounts;
  debitExpenses: Amounts;
  cardPayment: Amounts;
  balanceBeforeSavings: Amounts;
  savingsIn: Amounts;
  savingsOut: Amounts;
  /** Apartado a provisiones (gastos que vienen): baja lo libre, no es ahorro */
  provisionsIn: Amounts;
  /** Liberado de provisiones o gastado con ellas */
  provisionsOut: Amounts;
  /** Aportes a inversiones: salen de la caja, pero no son gasto */
  investmentsIn: Amounts;
  /** Abonos que llegaron por gastos que aún no salen de la caja (p. ej. TC sin pagar) */
  reservedIn: Amounts;
  /** Reservas de ciclos anteriores cuyo gasto se pagó en este */
  reservedOut: Amounts;
  finalBalance: Amounts;
  card: {
    /** Gasto en TC del ciclo, ya cargado (se paga el próximo ciclo) */
    spent: number;
    /** Devoluciones y abonos en TC del ciclo */
    credits: number;
    /** Lo que se pagará el próximo ciclo según la vista estado de cuenta */
    upcomingStatement: number;
    /** Igual que el anterior, incluyendo ítems de plantilla aún no confirmados */
    upcomingStatementCommitted: number;
    /** Pago TC que falta hacer en este ciclo (factura del ciclo anterior) */
    pendingPayment: number;
    /** Factura que viene (vista estado de cuenta de este ciclo) por naturaleza */
    upcomingBreakdown: StatementBreakdown;
    /** De qué se compone el pago TC de este ciclo (factura del ciclo anterior) */
    paymentBreakdown: StatementBreakdown | null;
    /** Gasto propio en TC del ciclo (base del techo) */
    own: {
      /** Ya cargado */
      real: number;
      /** Incluye ítems de plantilla aún no confirmados */
      committed: number;
      /** Parte que corresponde a cuotas */
      installments: number;
    };
  };
  warnings: CycleWarning[];
};

/** Cascada guardada al cerrar el ciclo (billing_cycles.closing_snapshot) */
export type ClosingSnapshot = {
  version: 1;
  income: number;
  reimbursements: number;
  debitExpenses: number;
  cardPayment: number;
  balanceBeforeSavings: number;
  savingsIn: number;
  savingsOut: number;
  finalBalance: number;
};

export function toClosingSnapshot(balance: CycleBalance): ClosingSnapshot {
  return {
    version: 1,
    income: balance.income.real,
    reimbursements: balance.reimbursements.real,
    debitExpenses: balance.debitExpenses.real,
    cardPayment: balance.cardPayment.real,
    balanceBeforeSavings: balance.balanceBeforeSavings.real,
    savingsIn: balance.savingsIn.real,
    savingsOut: balance.savingsOut.real,
    finalBalance: balance.finalBalance.real,
  };
}

export type BalanceRange = DateRange & {
  status: 'open' | 'closed';
};

const ZERO: Amounts = { real: 0, committed: 0, projected: 0 };

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBetweenStrings(start: string, end: string): number {
  return Math.round(
    (new Date(end + 'T00:00:00Z').getTime() - new Date(start + 'T00:00:00Z').getTime()) /
      86_400_000
  );
}

function sum(rows: BucketRow[], predicate: (row: BucketRow) => boolean): number {
  return rows.reduce((acc, row) => (predicate(row) ? acc + row.total : acc), 0);
}

function count(rows: BucketRow[], predicate: (row: BucketRow) => boolean): number {
  return rows.reduce((acc, row) => (predicate(row) ? acc + row.count : acc), 0);
}

function cashLine(rows: BucketRow[], bucket: Bucket, isOpen: boolean): Amounts {
  const real = sum(rows, (r) => r.bucket === bucket && r.inRange && r.isReal);
  const committed = isOpen ? sum(rows, (r) => r.bucket === bucket && r.inRange) : real;
  return { real, committed, projected: committed };
}

function combine(...parts: Array<[Amounts, 1 | -1]>): Amounts {
  return parts.reduce<Amounts>(
    (acc, [amounts, sign]) => ({
      real: acc.real + sign * amounts.real,
      committed: acc.committed + sign * amounts.committed,
      projected: acc.projected + sign * amounts.projected,
    }),
    ZERO
  );
}

/**
 * Vista estado de cuenta por tarjeta: lo que se pagará en el ciclo siguiente.
 * Compras sin cuota cargadas en el ciclo + cuotas fechadas en la ventana
 * posterior al fin del ciclo − devoluciones/abonos en TC del ciclo.
 */
function statementByCard(rows: BucketRow[]): Map<string, { real: number; committed: number }> {
  const result = new Map<string, { real: number; committed: number }>();
  for (const row of rows) {
    if (!row.cardAccountId) continue;
    let real = 0;
    let pendingTemplate = 0;
    if (row.bucket === 'card_spend' && row.inRange && !row.isInstallment) {
      if (row.isReal) real = row.total;
      else if (!row.isPaid) pendingTemplate = row.total;
    } else if (row.bucket === 'card_spend' && !row.inRange && row.isInstallment) {
      real = row.total;
    } else if (row.bucket === 'card_credit' && row.inRange) {
      real = -row.total;
    } else {
      continue;
    }
    const current = result.get(row.cardAccountId) ?? { real: 0, committed: 0 };
    result.set(row.cardAccountId, {
      real: current.real + real,
      committed: current.committed + real + pendingTemplate,
    });
  }
  return result;
}

/**
 * Vista estado de cuenta del ciclo (todas las tarjetas) separada por naturaleza.
 */
function statementBreakdown(rows: BucketRow[]): {
  breakdown: StatementBreakdown;
  own: { real: number; committed: number; installments: number };
} {
  const breakdown: StatementBreakdown = { own: 0, external: 0, reimbursable: 0, fund: 0, credits: 0, total: 0 };
  const own = { real: 0, committed: 0, installments: 0 };

  for (const row of rows) {
    const isPurchase = row.bucket === 'card_spend' && row.inRange && !row.isInstallment;
    const isWindowInstallment = row.bucket === 'card_spend' && !row.inRange && row.isInstallment;

    if (row.bucket === 'card_credit' && row.inRange) {
      breakdown.credits += row.total;
      continue;
    }
    if (!isPurchase && !isWindowInstallment) continue;

    const isReal = isWindowInstallment || row.isReal;
    const isPendingTemplate = isPurchase && !row.isPaid;
    const nature = row.nature === 'reimbursement' ? 'own' : row.nature;

    if (isReal) breakdown[nature] += row.total;
    if (nature === 'own') {
      if (isReal) own.real += row.total;
      if (isReal || isPendingTemplate) own.committed += row.total;
      if (isWindowInstallment) own.installments += row.total;
    }
  }

  breakdown.total =
    breakdown.own + breakdown.external + breakdown.reimbursable + breakdown.fund - breakdown.credits;
  return { breakdown, own };
}

/** Total pagado por tarjeta en el ciclo (un pago puede venir en varias partes) */
function paymentsByCard(rows: BucketRow[]): Map<string, { amount: number }> {
  const result = new Map<string, { amount: number }>();
  for (const row of rows) {
    if (row.bucket !== 'card_payment' || !row.inRange || !row.isReal || !row.cardAccountId) continue;
    const current = result.get(row.cardAccountId) ?? { amount: 0 };
    result.set(row.cardAccountId, { amount: current.amount + row.total });
  }
  return result;
}

/**
 * Arma la cascada de cada rango a partir de las filas agregadas.
 * Los rangos deben venir ordenados por fecha de inicio: el anterior a cada
 * uno se usa para el pago TC pendiente y las validaciones.
 */
export function buildBalances(
  ranges: BalanceRange[],
  rows: BucketRow[],
  cardNames: Map<string, string>,
  reserves: ReserveRow[] = []
): Map<string, CycleBalance> {
  const rowsByKey = new Map<string, BucketRow[]>();
  for (const row of rows) {
    const list = rowsByKey.get(row.key) ?? [];
    list.push(row);
    rowsByKey.set(row.key, list);
  }

  const cardName = (id: string) => cardNames.get(id) ?? 'Tarjeta';
  const result = new Map<string, CycleBalance>();

  ranges.forEach((range, index) => {
    const rangeRows = rowsByKey.get(range.key) ?? [];
    const previous = index > 0 ? ranges[index - 1] : null;
    const previousStatement = previous
      ? statementByCard(rowsByKey.get(previous.key) ?? [])
      : new Map<string, { real: number; committed: number }>();
    const isOpen = range.status === 'open';

    const income = cashLine(rangeRows, 'income', isOpen);
    const reimbursements = cashLine(rangeRows, 'reimbursement', isOpen);
    const debitExpenses = cashLine(rangeRows, 'debit_expense', isOpen);
    const savingsIn = cashLine(rangeRows, 'savings_in', isOpen);
    const savingsOut = cashLine(rangeRows, 'savings_out', isOpen);
    const provisionsIn = cashLine(rangeRows, 'provision_in', isOpen);
    const provisionsOut = cashLine(rangeRows, 'provision_out', isOpen);
    const investmentsIn = cashLine(rangeRows, 'investment_in', isOpen);
    const paidCardPayment = cashLine(rangeRows, 'card_payment', isOpen);
    const reserve = reservesForRange(reserves, range.start, range.end);
    const reservedIn: Amounts = { real: reserve.reserved, committed: reserve.reserved, projected: reserve.reserved };
    const reservedOut: Amounts = { real: reserve.released, committed: reserve.released, projected: reserve.released };

    const payments = paymentsByCard(rangeRows);
    const warnings: CycleWarning[] = [];

    let pendingPayment = 0;
    for (const [cardId, statement] of previousStatement) {
      const payment = payments.get(cardId);
      if (!payment) {
        if (statement.real <= 0) continue;
        if (isOpen) {
          pendingPayment += statement.real;
        } else if (statement.real > CARD_PAYMENT_MISMATCH_THRESHOLD) {
          warnings.push({
            kind: 'card_payment_missing',
            cardName: cardName(cardId),
            expected: statement.real,
          });
        }
      } else if (Math.abs(payment.amount - statement.real) > CARD_PAYMENT_MISMATCH_THRESHOLD) {
        warnings.push({
          kind: 'card_payment_mismatch',
          cardName: cardName(cardId),
          expected: statement.real,
          paid: payment.amount,
        });
      }
    }
    const cardPayment: Amounts = {
      ...paidCardPayment,
      projected: paidCardPayment.projected + pendingPayment,
    };

    const balanceBeforeSavings = combine(
      [income, 1],
      [reimbursements, 1],
      [debitExpenses, -1],
      [cardPayment, -1]
    );
    const finalBalance = combine(
      [balanceBeforeSavings, 1],
      [savingsIn, -1],
      [savingsOut, 1],
      [provisionsIn, -1],
      [provisionsOut, 1],
      [investmentsIn, -1],
      [reservedIn, -1],
      [reservedOut, 1]
    );

    if (!isOpen) {
      const overdue = (r: BucketRow) =>
        r.inRange &&
        !r.isPaid &&
        (r.bucket === 'income' ||
          r.bucket === 'reimbursement' ||
          r.bucket === 'debit_expense' ||
          (r.bucket === 'card_spend' && !r.isInstallment));
      const overdueCount = count(rangeRows, overdue);
      if (overdueCount > 0) {
        warnings.push({
          kind: 'overdue_pending',
          count: overdueCount,
          amount: sum(rangeRows, overdue),
        });
      }
    }

    if (previous) {
      const gap = daysBetweenStrings(previous.end, range.start) - 1;
      if (gap > 0) warnings.push({ kind: 'gap_before', days: gap });
    }

    const upcoming = [...statementByCard(rangeRows).values()];
    const current = statementBreakdown(rangeRows);
    const previousBreakdown = previous
      ? statementBreakdown(rowsByKey.get(previous.key) ?? []).breakdown
      : null;

    result.set(range.key, {
      income,
      reimbursements,
      debitExpenses,
      cardPayment,
      balanceBeforeSavings,
      savingsIn,
      savingsOut,
      provisionsIn,
      provisionsOut,
      investmentsIn,
      reservedIn,
      reservedOut,
      finalBalance,
      card: {
        spent: sum(rangeRows, (r) => r.bucket === 'card_spend' && r.inRange && r.isReal),
        credits: sum(rangeRows, (r) => r.bucket === 'card_credit' && r.inRange),
        upcomingStatement: upcoming.reduce((acc, s) => acc + s.real, 0),
        upcomingStatementCommitted: upcoming.reduce((acc, s) => acc + s.committed, 0),
        pendingPayment,
        upcomingBreakdown: current.breakdown,
        paymentBreakdown: previousBreakdown,
        own: current.own,
      },
      warnings,
    });
  });

  return result;
}

async function getCardNames(projectId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(and(eq(accounts.projectId, projectId), inArray(accounts.type, ['credit_card'])));
  return new Map(rows.map((r) => [r.id, r.name]));
}

async function fetchBucketRows(projectId: string, ranges: DateRange[]): Promise<BucketRow[]> {
  if (ranges.length === 0) return [];
  const today = toDateString(getToday());
  const rows = await db.execute(bucketAggregationQuery(projectId, ranges, today));
  return parseBucketRows(rows as unknown as Parameters<typeof parseBucketRows>[0]);
}

async function fetchReserves(projectId: string): Promise<ReserveRow[]> {
  const rows = await db.execute(reserveRowsQuery(projectId, toDateString(getToday())));
  return parseReserveRows(rows as unknown as Record<string, unknown>[]);
}

/**
 * Saldo de varios ciclos con una sola consulta.
 * Recibe los ciclos del proyecto (en cualquier orden); el anterior de cada
 * ciclo se usa para el pago TC pendiente y las validaciones.
 */
export async function getCycleBalances(
  projectId: string,
  cycles: Array<{ id: string; startDate: Date; endDate: Date; status: 'open' | 'closed' }>
): Promise<Map<string, CycleBalance>> {
  const ranges: BalanceRange[] = [...cycles]
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .map((c) => ({
      key: c.id,
      start: toDateString(c.startDate),
      end: toDateString(c.endDate),
      status: c.status,
    }));

  const [rows, cardNames, reserves] = await Promise.all([
    fetchBucketRows(projectId, ranges),
    getCardNames(projectId),
    fetchReserves(projectId),
  ]);
  return buildBalances(ranges, rows, cardNames, reserves);
}

/**
 * Saldo de caja (real) de un rango arbitrario de fechas.
 * Sin pago TC pendiente: no hay "ciclo anterior" del cual tomarlo.
 */
export async function getRangeBalance(
  projectId: string,
  startDate: Date,
  endDate: Date
): Promise<CycleBalance> {
  const range: BalanceRange = {
    key: 'range',
    start: toDateString(startDate),
    end: toDateString(endDate),
    status: 'closed',
  };
  const [rows, reserves] = await Promise.all([fetchBucketRows(projectId, [range]), fetchReserves(projectId)]);
  return buildBalances([range], rows, new Map(), reserves).get('range')!;
}
