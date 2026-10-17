import { cache } from 'react';
import { db } from '@/lib/db';
import { billingCycles } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { verifyProjectAccess } from '@/lib/auth/project-access';
import { capitalize, MONTHS_LONG } from '@/lib/dates';
import { cachedQuery, CACHE_TAGS } from '@/lib/cache';
import { getToday, daysBetween } from '@/lib/formatting';
import { getCycleBalances, type ClosingSnapshot } from './lib/cycle-balance';
import type { BillingCycleWithTotals, BillingCycleSummary } from './types';

type BillingCycleRow = typeof billingCycles.$inferSelect;

/**
 * Calcula el saldo de todos los ciclos del proyecto con una sola consulta
 * y les agrega los días transcurridos/restantes.
 */
async function enrichCyclesWithTotals(
  cycles: BillingCycleRow[],
  projectId: string
): Promise<BillingCycleWithTotals[]> {
  const balances = await getCycleBalances(
    projectId,
    cycles.map((c) => ({
      id: c.id,
      startDate: new Date(c.startDate),
      endDate: new Date(c.endDate),
      status: c.status,
    }))
  );

  const today = getToday();

  return cycles.map((cycle) => {
    const startDate = new Date(cycle.startDate);
    const endDate = new Date(cycle.endDate);
    const daysTotal = daysBetween(startDate, endDate) + 1; // +1: endDate es inclusivo
    const daysElapsed =
      cycle.status === 'closed'
        ? daysTotal
        : Math.min(daysTotal, Math.max(0, daysBetween(startDate, today) + 1));

    const balance = balances.get(cycle.id)!;

    // Aviso si los movimientos del ciclo cambiaron después del cierre
    const snapshot = cycle.closingSnapshot as ClosingSnapshot | null;
    if (cycle.status === 'closed' && snapshot?.version === 1) {
      const current = balance.finalBalance.real;
      if (Math.abs(current - snapshot.finalBalance) >= 1) {
        balance.warnings = [
          ...balance.warnings,
          { kind: 'changed_since_close', closedAt: snapshot.finalBalance, current },
        ];
      }
    }

    return {
      ...cycle,
      balance,
      daysTotal,
      daysElapsed,
      daysRemaining: Math.max(0, daysTotal - daysElapsed),
    };
  });
}

/**
 * Obtiene todos los ciclos de un proyecto (más reciente primero) con su saldo.
 * `cache`: el ciclo actual y el historial del inicio comparten el cálculo en el mismo request.
 */
export const getBillingCycles = cache(async function getBillingCycles(
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

  return enrichCyclesWithTotals(cycles, projectId);
});

export type BillingCycleOption = {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  status: BillingCycleRow['status'];
};

/**
 * Ciclos del proyecto sin saldos (más reciente primero): para selectores y
 * filtros, que no necesitan el cálculo de la cascada.
 */
export async function getBillingCycleOptions(projectId: string, userId: string): Promise<BillingCycleOption[]> {
  const [hasAccess, cycles] = await Promise.all([
    verifyProjectAccess(projectId, userId),
    db
      .select({
        id: billingCycles.id,
        name: billingCycles.name,
        startDate: billingCycles.startDate,
        endDate: billingCycles.endDate,
        status: billingCycles.status,
      })
      .from(billingCycles)
      .where(eq(billingCycles.projectId, projectId))
      .orderBy(desc(billingCycles.startDate)),
  ]);
  if (!hasAccess) return [];
  const iso = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
  return cycles.map((c) => ({ ...c, startDate: iso(c.startDate), endDate: iso(c.endDate) }));
}

/**
 * Query interna para obtener ciclo actual.
 * Carga todos los ciclos porque el pago TC pendiente depende del ciclo anterior.
 */
async function _getCurrentCycle(
  projectId: string,
  userId: string
): Promise<BillingCycleWithTotals | null> {
  const cycles = await getBillingCycles(projectId, userId);
  return cycles.find((c) => c.status === 'open') ?? null;
}

/**
 * Obtiene el ciclo actual (abierto) de un proyecto
 * Cacheada por 60 segundos - se invalida con transacciones y savings
 */
export const getCurrentCycle = cachedQuery(
  _getCurrentCycle,
  ['billing-cycles', 'current'],
  { tags: [CACHE_TAGS.billingCycles, CACHE_TAGS.transactions, CACHE_TAGS.savings] }
);

export type CycleHistoryPoint = { id: string; name: string; finalBalance: number; isOpen: boolean };

/**
 * Saldo final de los últimos ciclos (el más antiguo primero), para el historial del inicio.
 * Cacheada igual que el ciclo actual.
 */
export const getCycleHistory = cachedQuery(
  async (projectId: string, userId: string, limit: number = 8): Promise<CycleHistoryPoint[]> => {
    const cycles = await getBillingCycles(projectId, userId);
    return cycles
      .slice(0, limit)
      .reverse()
      .map((c) => ({
        id: c.id,
        name: c.name,
        finalBalance: c.status === 'open' ? c.balance.finalBalance.projected : c.balance.finalBalance.real,
        isOpen: c.status === 'open',
      }));
  },
  ['billing-cycles', 'history'],
  { tags: [CACHE_TAGS.billingCycles, CACHE_TAGS.transactions, CACHE_TAGS.savings] }
);

/**
 * Resume una lista de ciclos ya cargada (evita volver a consultar)
 */
export function summarizeBillingCycles(cycles: BillingCycleWithTotals[]): BillingCycleSummary {
  return {
    totalCycles: cycles.length,
    openCycles: cycles.filter((c) => c.status === 'open').length,
    closedCycles: cycles.filter((c) => c.status === 'closed').length,
    currentCycle: cycles.find((c) => c.status === 'open') ?? null,
  };
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


  if (!lastCycle[0]) {
    // No hay ciclos previos, sugerir desde hoy hasta día 25 del mes siguiente
    const today = getToday();
    const nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 25));
    const monthName = capitalize(MONTHS_LONG[nextMonth.getUTCMonth()]);

    return {
      startDate: today,
      endDate: nextMonth,
      name: `Ciclo ${monthName} ${nextMonth.getUTCFullYear()}`,
    };
  }

  // Sugerir basándose en el último ciclo
  const lastEndDate = new Date(lastCycle[0].endDate);
  const startDate = new Date(lastEndDate);
  startDate.setUTCDate(startDate.getUTCDate() + 1); // Día siguiente al último

  // Calcular duración del último ciclo para mantener consistencia
  const lastStartDate = new Date(lastCycle[0].startDate);
  const lastDuration = daysBetween(lastStartDate, lastEndDate);

  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + lastDuration);

  const monthName = capitalize(MONTHS_LONG[endDate.getUTCMonth()]);

  return {
    startDate,
    endDate,
    name: `Ciclo ${monthName} ${endDate.getUTCFullYear()}`,
  };
}
