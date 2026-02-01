import { db } from '@/lib/db';
import { savingsFunds, savingsMovements, currencies, projectMembers } from '@/lib/db/schema';
import { eq, and, sql, isNotNull, desc, gte, lte } from 'drizzle-orm';
import type { SavingsFundWithProgress, SavingsSummary, SavingsMovement } from './types';

/**
 * Obtiene el primer y último día del mes actual
 */
function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
}

/**
 * Obtiene todos los fondos de ahorro del usuario con su progreso
 */
export async function getSavingsFundsWithProgress(
  userId: string,
  projectId?: string,
  includeArchived: boolean = false
): Promise<SavingsFundWithProgress[]> {
  // Construir condiciones base
  const conditions = [eq(savingsFunds.userId, userId)];

  if (projectId) {
    // Verificar acceso al proyecto
    const hasAccess = await db
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

    if (hasAccess.length === 0) {
      return [];
    }

    conditions.push(eq(savingsFunds.projectId, projectId));
  }

  if (!includeArchived) {
    conditions.push(eq(savingsFunds.isArchived, false));
  }

  // Obtener fondos con moneda
  const funds = await db
    .select({
      id: savingsFunds.id,
      userId: savingsFunds.userId,
      projectId: savingsFunds.projectId,
      name: savingsFunds.name,
      type: savingsFunds.type,
      accountType: savingsFunds.accountType,
      currencyId: savingsFunds.currencyId,
      targetAmount: savingsFunds.targetAmount,
      monthlyTarget: savingsFunds.monthlyTarget,
      currentBalance: savingsFunds.currentBalance,
      isArchived: savingsFunds.isArchived,
      createdAt: savingsFunds.createdAt,
      updatedAt: savingsFunds.updatedAt,
      currencyCode: currencies.code,
    })
    .from(savingsFunds)
    .innerJoin(currencies, eq(savingsFunds.currencyId, currencies.id))
    .where(and(...conditions))
    .orderBy(desc(savingsFunds.createdAt));

  if (funds.length === 0) {
    return [];
  }

  // Obtener rango del mes actual
  const { start, end } = getCurrentMonthRange();

  // Calcular depósitos del mes por fondo
  const monthlyDeposits = await db
    .select({
      savingsFundId: savingsMovements.savingsFundId,
      totalDeposits: sql<string>`SUM(CASE WHEN ${savingsMovements.type} = 'deposit' THEN ${savingsMovements.amount} ELSE 0 END)`,
    })
    .from(savingsMovements)
    .where(
      and(
        gte(savingsMovements.date, start),
        lte(savingsMovements.date, end)
      )
    )
    .groupBy(savingsMovements.savingsFundId);

  // Crear mapa de depósitos mensuales
  const depositsMap = new Map<string, number>();
  for (const row of monthlyDeposits) {
    depositsMap.set(row.savingsFundId, parseFloat(row.totalDeposits ?? '0'));
  }

  // Obtener últimos 5 movimientos por fondo
  const recentMovementsResult = await db
    .select()
    .from(savingsMovements)
    .where(
      sql`${savingsMovements.savingsFundId} IN ${funds.map((f) => f.id)}`
    )
    .orderBy(desc(savingsMovements.date), desc(savingsMovements.createdAt))
    .limit(50); // Limitamos a 50 en total, luego agrupamos

  // Agrupar movimientos por fondo (máximo 5 por fondo)
  const movementsByFund = new Map<string, SavingsMovement[]>();
  for (const movement of recentMovementsResult) {
    const existing = movementsByFund.get(movement.savingsFundId) ?? [];
    if (existing.length < 5) {
      existing.push(movement);
      movementsByFund.set(movement.savingsFundId, existing);
    }
  }

  // Combinar datos
  return funds.map((fund) => {
    const currentBalance = parseFloat(fund.currentBalance);
    const targetAmount = fund.targetAmount ? parseFloat(fund.targetAmount) : null;
    const monthlyTarget = parseFloat(fund.monthlyTarget);
    const monthlyDeposited = depositsMap.get(fund.id) ?? 0;

    const progressPercentage =
      targetAmount && targetAmount > 0
        ? Math.min(100, Math.round((currentBalance / targetAmount) * 100))
        : 0;

    const monthlyPercentage =
      monthlyTarget > 0
        ? Math.min(100, Math.round((monthlyDeposited / monthlyTarget) * 100))
        : 0;

    return {
      ...fund,
      progressPercentage,
      monthlyDeposited,
      monthlyPercentage,
      recentMovements: movementsByFund.get(fund.id) ?? [],
    };
  });
}

/**
 * Obtiene un fondo por ID con progreso
 */
export async function getSavingsFundById(
  fundId: string,
  userId: string
): Promise<SavingsFundWithProgress | null> {
  const result = await db
    .select({
      id: savingsFunds.id,
      userId: savingsFunds.userId,
      projectId: savingsFunds.projectId,
      name: savingsFunds.name,
      type: savingsFunds.type,
      accountType: savingsFunds.accountType,
      currencyId: savingsFunds.currencyId,
      targetAmount: savingsFunds.targetAmount,
      monthlyTarget: savingsFunds.monthlyTarget,
      currentBalance: savingsFunds.currentBalance,
      isArchived: savingsFunds.isArchived,
      createdAt: savingsFunds.createdAt,
      updatedAt: savingsFunds.updatedAt,
      currencyCode: currencies.code,
    })
    .from(savingsFunds)
    .innerJoin(currencies, eq(savingsFunds.currencyId, currencies.id))
    .where(and(eq(savingsFunds.id, fundId), eq(savingsFunds.userId, userId)))
    .limit(1);

  if (!result[0]) {
    return null;
  }

  const fund = result[0];

  // Obtener depósitos del mes
  const { start, end } = getCurrentMonthRange();
  const monthlyResult = await db
    .select({
      totalDeposits: sql<string>`SUM(CASE WHEN ${savingsMovements.type} = 'deposit' THEN ${savingsMovements.amount} ELSE 0 END)`,
    })
    .from(savingsMovements)
    .where(
      and(
        eq(savingsMovements.savingsFundId, fundId),
        gte(savingsMovements.date, start),
        lte(savingsMovements.date, end)
      )
    );

  // Obtener últimos 10 movimientos
  const recentMovements = await db
    .select()
    .from(savingsMovements)
    .where(eq(savingsMovements.savingsFundId, fundId))
    .orderBy(desc(savingsMovements.date), desc(savingsMovements.createdAt))
    .limit(10);

  const currentBalance = parseFloat(fund.currentBalance);
  const targetAmount = fund.targetAmount ? parseFloat(fund.targetAmount) : null;
  const monthlyTarget = parseFloat(fund.monthlyTarget);
  const monthlyDeposited = parseFloat(monthlyResult[0]?.totalDeposits ?? '0');

  const progressPercentage =
    targetAmount && targetAmount > 0
      ? Math.min(100, Math.round((currentBalance / targetAmount) * 100))
      : 0;

  const monthlyPercentage =
    monthlyTarget > 0
      ? Math.min(100, Math.round((monthlyDeposited / monthlyTarget) * 100))
      : 0;

  return {
    ...fund,
    progressPercentage,
    monthlyDeposited,
    monthlyPercentage,
    recentMovements,
  };
}

/**
 * Obtiene todos los movimientos de un fondo
 */
export async function getMovementsByFund(
  fundId: string,
  userId: string,
  limit: number = 50
): Promise<SavingsMovement[]> {
  // Verificar que el fondo pertenece al usuario
  const fund = await db
    .select({ id: savingsFunds.id })
    .from(savingsFunds)
    .where(and(eq(savingsFunds.id, fundId), eq(savingsFunds.userId, userId)))
    .limit(1);

  if (fund.length === 0) {
    return [];
  }

  return await db
    .select()
    .from(savingsMovements)
    .where(eq(savingsMovements.savingsFundId, fundId))
    .orderBy(desc(savingsMovements.date), desc(savingsMovements.createdAt))
    .limit(limit);
}

/**
 * Obtiene todas las monedas disponibles
 */
export async function getAllCurrencies(): Promise<{ id: string; code: string; name: string }[]> {
  return await db
    .select({
      id: currencies.id,
      code: currencies.code,
      name: currencies.name,
    })
    .from(currencies)
    .orderBy(currencies.code);
}

/**
 * Obtiene resumen de fondos de ahorro
 */
export async function getSavingsSummary(
  userId: string,
  projectId?: string
): Promise<SavingsSummary> {
  const fundsWithProgress = await getSavingsFundsWithProgress(userId, projectId, false);

  let totalBalance = 0;
  let totalTargetAmount = 0;
  let monthlyTargetTotal = 0;
  let monthlyDepositedTotal = 0;

  for (const fund of fundsWithProgress) {
    totalBalance += parseFloat(fund.currentBalance);
    if (fund.targetAmount) {
      totalTargetAmount += parseFloat(fund.targetAmount);
    }
    monthlyTargetTotal += parseFloat(fund.monthlyTarget);
    monthlyDepositedTotal += fund.monthlyDeposited;
  }

  const overallProgress =
    totalTargetAmount > 0
      ? Math.min(100, Math.round((totalBalance / totalTargetAmount) * 100))
      : 0;

  return {
    totalFunds: fundsWithProgress.length,
    activeFunds: fundsWithProgress.filter((f) => !f.isArchived).length,
    totalBalance,
    totalTargetAmount,
    monthlyTargetTotal,
    monthlyDepositedTotal,
    overallProgress,
  };
}
