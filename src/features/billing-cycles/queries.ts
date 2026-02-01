import { db } from '@/lib/db';
import { billingCycles, transactions, projectMembers, savingsMovements, savingsFunds } from '@/lib/db/schema';
import { eq, and, sql, isNotNull, desc, gte, lte, asc } from 'drizzle-orm';
import type { BillingCycleWithTotals, BillingCycleSummary } from './types';

/**
 * Calcula los días entre dos fechas
 */
function daysBetween(start: Date, end: Date): number {
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calcula totales de transacciones para un rango de fechas
 */
async function calculateTotalsForRange(
  projectId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  income: number;
  expenses: number;
  savings: number;
  balance: number;
}> {
  // Obtener totales de transacciones
  const transactionTotals = await db
    .select({
      totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.baseAmount} ELSE 0 END), 0)`,
      totalExpenses: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.baseAmount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.projectId, projectId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    );

  // Obtener depósitos de ahorro en el período
  // (los fondos de ahorro están asociados al usuario, no al proyecto directamente,
  // pero podemos filtrar por projectId si existe)
  const savingsTotals = await db
    .select({
      totalSavings: sql<string>`COALESCE(SUM(CASE WHEN ${savingsMovements.type} = 'deposit' THEN ${savingsMovements.amount} ELSE 0 END), 0)`,
    })
    .from(savingsMovements)
    .innerJoin(savingsFunds, eq(savingsMovements.savingsFundId, savingsFunds.id))
    .where(
      and(
        eq(savingsFunds.projectId, projectId),
        gte(savingsMovements.date, startDate),
        lte(savingsMovements.date, endDate)
      )
    );

  const income = parseFloat(transactionTotals[0]?.totalIncome ?? '0');
  const expenses = parseFloat(transactionTotals[0]?.totalExpenses ?? '0');
  const savings = parseFloat(savingsTotals[0]?.totalSavings ?? '0');
  const balance = income - expenses - savings;

  return { income, expenses, savings, balance };
}

/**
 * Obtiene un ciclo con sus totales calculados
 */
async function enrichCycleWithTotals(
  cycle: typeof billingCycles.$inferSelect,
  projectId: string
): Promise<BillingCycleWithTotals> {
  const today = new Date();
  const startDate = new Date(cycle.startDate);
  const endDate = new Date(cycle.endDate);

  const daysTotal = daysBetween(startDate, endDate);
  const daysElapsed = Math.min(daysTotal, Math.max(0, daysBetween(startDate, today)));
  const daysRemaining = Math.max(0, daysTotal - daysElapsed);

  // Si está cerrado, usar snapshot
  if (cycle.status === 'closed') {
    return {
      ...cycle,
      currentIncome: parseFloat(cycle.snapshotIncome ?? '0'),
      currentExpenses: parseFloat(cycle.snapshotExpenses ?? '0'),
      currentSavings: parseFloat(cycle.snapshotSavings ?? '0'),
      currentBalance: parseFloat(cycle.snapshotBalance ?? '0'),
      daysTotal,
      daysElapsed: daysTotal,
      daysRemaining: 0,
    };
  }

  // Si está abierto, calcular en tiempo real
  const totals = await calculateTotalsForRange(projectId, startDate, endDate);

  return {
    ...cycle,
    currentIncome: totals.income,
    currentExpenses: totals.expenses,
    currentSavings: totals.savings,
    currentBalance: totals.balance,
    daysTotal,
    daysElapsed,
    daysRemaining,
  };
}

/**
 * Verifica acceso al proyecto
 */
async function verifyProjectAccess(projectId: string, userId: string): Promise<boolean> {
  const member = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  return member.length > 0;
}

/**
 * Obtiene todos los ciclos de un proyecto
 */
export async function getBillingCycles(
  projectId: string,
  userId: string
): Promise<BillingCycleWithTotals[]> {
  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) {
    return [];
  }

  const cycles = await db
    .select()
    .from(billingCycles)
    .where(eq(billingCycles.projectId, projectId))
    .orderBy(desc(billingCycles.startDate));

  const enrichedCycles = await Promise.all(
    cycles.map((cycle) => enrichCycleWithTotals(cycle, projectId))
  );

  return enrichedCycles;
}

/**
 * Obtiene el ciclo actual (abierto) de un proyecto
 */
export async function getCurrentCycle(
  projectId: string,
  userId: string
): Promise<BillingCycleWithTotals | null> {
  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) {
    return null;
  }

  const cycle = await db
    .select()
    .from(billingCycles)
    .where(
      and(
        eq(billingCycles.projectId, projectId),
        eq(billingCycles.status, 'open')
      )
    )
    .orderBy(desc(billingCycles.startDate))
    .limit(1);

  if (!cycle[0]) {
    return null;
  }

  return enrichCycleWithTotals(cycle[0], projectId);
}

/**
 * Obtiene un ciclo por ID
 */
export async function getBillingCycleById(
  cycleId: string,
  userId: string
): Promise<BillingCycleWithTotals | null> {
  const result = await db
    .select()
    .from(billingCycles)
    .innerJoin(projectMembers, eq(billingCycles.projectId, projectMembers.projectId))
    .where(
      and(
        eq(billingCycles.id, cycleId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!result[0]) {
    return null;
  }

  const cycle = result[0].n1n4_billing_cycles;
  return enrichCycleWithTotals(cycle, cycle.projectId);
}

/**
 * Obtiene resumen de ciclos de un proyecto
 */
export async function getBillingCyclesSummary(
  projectId: string,
  userId: string
): Promise<BillingCycleSummary> {
  const cycles = await getBillingCycles(projectId, userId);
  const currentCycle = cycles.find((c) => c.status === 'open') ?? null;

  return {
    totalCycles: cycles.length,
    openCycles: cycles.filter((c) => c.status === 'open').length,
    closedCycles: cycles.filter((c) => c.status === 'closed').length,
    currentCycle,
  };
}

/**
 * Calcula totales para un rango de fechas personalizado
 * (útil para el dashboard con filtros)
 */
export async function getTransactionsSummaryByRange(
  projectId: string,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  income: number;
  expenses: number;
  savings: number;
  balance: number;
  daysTotal: number;
}> {
  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) {
    return { income: 0, expenses: 0, savings: 0, balance: 0, daysTotal: 0 };
  }

  const totals = await calculateTotalsForRange(projectId, startDate, endDate);
  const daysTotal = daysBetween(startDate, endDate);

  return { ...totals, daysTotal };
}

/**
 * Sugiere fechas para el próximo ciclo basándose en el último cerrado
 */
export async function suggestNextCycleDates(
  projectId: string,
  userId: string
): Promise<{ startDate: Date; endDate: Date; name: string } | null> {
  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) {
    return null;
  }

  // Buscar el último ciclo (cerrado o abierto)
  const lastCycle = await db
    .select()
    .from(billingCycles)
    .where(eq(billingCycles.projectId, projectId))
    .orderBy(desc(billingCycles.endDate))
    .limit(1);

  const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  if (!lastCycle[0]) {
    // No hay ciclos previos, sugerir desde hoy hasta día 25 del mes siguiente
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 25);
    const monthName = MONTH_NAMES[nextMonth.getMonth()];

    return {
      startDate: today,
      endDate: nextMonth,
      name: `Ciclo ${monthName} ${nextMonth.getFullYear()}`,
    };
  }

  // Sugerir basándose en el último ciclo
  const lastEndDate = new Date(lastCycle[0].endDate);
  const startDate = new Date(lastEndDate);
  startDate.setDate(startDate.getDate() + 1); // Día siguiente al último

  // Calcular duración del último ciclo para mantener consistencia
  const lastStartDate = new Date(lastCycle[0].startDate);
  const lastDuration = daysBetween(lastStartDate, lastEndDate);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + lastDuration);

  const monthName = MONTH_NAMES[endDate.getMonth()];

  return {
    startDate,
    endDate,
    name: `Ciclo ${monthName} ${endDate.getFullYear()}`,
  };
}
