import { db } from '@/lib/db';
import { savingsGoals, transactions, currencies, projectMembers, categories, accounts, budgets, entities } from '@/lib/db/schema';
import { eq, and, sql, isNotNull, desc } from 'drizzle-orm';
import { cachedQuery, CACHE_TAGS } from '@/lib/cache';
import type { SavingsGoalWithProgress, SavingsSummary, SavingsFilter } from './types';
import type { TransactionWithCategory } from '@/features/transactions/types';

/**
 * Query interna para obtener metas de ahorro con progreso
 * El progreso se calcula desde initialBalance + SUM(transacciones con savingsGoalId)
 */
async function _getSavingsGoalsWithProgress(
  userId: string,
  projectId?: string,
  filter: SavingsFilter = 'active'
): Promise<SavingsGoalWithProgress[]> {
  const conditions = [eq(savingsGoals.userId, userId)];

  if (projectId) {
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

    conditions.push(eq(savingsGoals.projectId, projectId));
  }

  // Filtrar según el estado
  switch (filter) {
    case 'active':
      conditions.push(eq(savingsGoals.isArchived, false));
      conditions.push(eq(savingsGoals.isCompleted, false));
      break;
    case 'completed':
      conditions.push(eq(savingsGoals.isCompleted, true));
      conditions.push(eq(savingsGoals.isArchived, false));
      break;
    case 'archived':
      conditions.push(eq(savingsGoals.isArchived, true));
      break;
  }

  // Obtener metas con moneda
  const goals = await db
    .select({
      id: savingsGoals.id,
      userId: savingsGoals.userId,
      projectId: savingsGoals.projectId,
      name: savingsGoals.name,
      type: savingsGoals.type,
      currencyId: savingsGoals.currencyId,
      targetAmount: savingsGoals.targetAmount,
      initialBalance: savingsGoals.initialBalance,
      isCompleted: savingsGoals.isCompleted,
      isArchived: savingsGoals.isArchived,
      createdAt: savingsGoals.createdAt,
      updatedAt: savingsGoals.updatedAt,
      currencyCode: currencies.code,
    })
    .from(savingsGoals)
    .innerJoin(currencies, eq(savingsGoals.currencyId, currencies.id))
    .where(and(...conditions))
    .orderBy(desc(savingsGoals.createdAt));

  if (goals.length === 0) {
    return [];
  }

  // Calcular balance total por meta (SUM de transacciones con savingsGoalId)
  const goalIds = goals.map((g) => g.id);
  const balances = await db
    .select({
      savingsGoalId: transactions.savingsGoalId,
      totalDeposited: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ABS(${transactions.originalAmount}) ELSE -ABS(${transactions.originalAmount}) END), 0)`,
    })
    .from(transactions)
    .where(sql`${transactions.savingsGoalId} IN ${goalIds}`)
    .groupBy(transactions.savingsGoalId);

  const balanceMap = new Map<string, number>();
  for (const row of balances) {
    if (row.savingsGoalId) {
      balanceMap.set(row.savingsGoalId, parseFloat(row.totalDeposited ?? '0'));
    }
  }

  // Combinar datos
  return goals.map((goal) => {
    const initialBalance = parseFloat(goal.initialBalance);
    const transactionsBalance = balanceMap.get(goal.id) ?? 0;
    const currentBalance = initialBalance + transactionsBalance;
    const targetAmount = parseFloat(goal.targetAmount);

    const progressPercentage =
      targetAmount > 0
        ? Math.min(100, Math.round((currentBalance / targetAmount) * 100))
        : 0;

    return {
      ...goal,
      currentBalance,
      progressPercentage,
    };
  });
}

/**
 * Obtiene todas las metas de ahorro del usuario con su progreso
 * Cacheada por 30 segundos
 */
export const getSavingsGoalsWithProgress = cachedQuery(
  _getSavingsGoalsWithProgress,
  ['savings', 'goals-with-progress'],
  { tags: [CACHE_TAGS.savings], revalidate: 30 }
);

/**
 * Obtiene una meta por ID con progreso
 */
export async function getSavingsGoalById(
  goalId: string,
  userId: string
): Promise<SavingsGoalWithProgress | null> {
  const result = await db
    .select({
      id: savingsGoals.id,
      userId: savingsGoals.userId,
      projectId: savingsGoals.projectId,
      name: savingsGoals.name,
      type: savingsGoals.type,
      currencyId: savingsGoals.currencyId,
      targetAmount: savingsGoals.targetAmount,
      initialBalance: savingsGoals.initialBalance,
      isCompleted: savingsGoals.isCompleted,
      isArchived: savingsGoals.isArchived,
      createdAt: savingsGoals.createdAt,
      updatedAt: savingsGoals.updatedAt,
      currencyCode: currencies.code,
    })
    .from(savingsGoals)
    .innerJoin(currencies, eq(savingsGoals.currencyId, currencies.id))
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, userId)))
    .limit(1);

  if (!result[0]) {
    return null;
  }

  const goal = result[0];

  // Calcular balance desde transacciones
  const balanceResult = await db
    .select({
      totalDeposited: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ABS(${transactions.originalAmount}) ELSE -ABS(${transactions.originalAmount}) END), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.savingsGoalId, goalId));

  const initialBalance = parseFloat(goal.initialBalance);
  const transactionsBalance = parseFloat(balanceResult[0]?.totalDeposited ?? '0');
  const currentBalance = initialBalance + transactionsBalance;
  const targetAmount = parseFloat(goal.targetAmount);

  const progressPercentage =
    targetAmount > 0
      ? Math.min(100, Math.round((currentBalance / targetAmount) * 100))
      : 0;

  return {
    ...goal,
    currentBalance,
    progressPercentage,
  };
}

/**
 * Query interna para obtener monedas
 */
async function _getAllCurrencies(): Promise<{ id: string; code: string; name: string }[]> {
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
 * Obtiene todas las monedas disponibles
 * Cacheada por 5 minutos
 */
export const getAllCurrencies = cachedQuery(
  _getAllCurrencies,
  ['currencies', 'all'],
  { tags: [CACHE_TAGS.savings], revalidate: 300 }
);

/**
 * Query interna para resumen de metas de ahorro
 */
async function _getSavingsSummary(
  userId: string,
  projectId?: string
): Promise<SavingsSummary> {
  // Obtener activas + completadas (no archivadas) para calcular el resumen
  const activeGoals = await _getSavingsGoalsWithProgress(userId, projectId, 'active');
  const completedGoals = await _getSavingsGoalsWithProgress(userId, projectId, 'completed');
  const allNonArchived = [...activeGoals, ...completedGoals];

  let totalBalance = 0;
  let totalTargetAmount = 0;

  for (const goal of allNonArchived) {
    totalBalance += goal.currentBalance;
    totalTargetAmount += parseFloat(goal.targetAmount);
  }

  const overallProgress =
    totalTargetAmount > 0
      ? Math.min(100, Math.round((totalBalance / totalTargetAmount) * 100))
      : 0;

  return {
    totalGoals: allNonArchived.length,
    activeGoals: activeGoals.length,
    completedGoals: completedGoals.length,
    totalBalance,
    totalTargetAmount,
    overallProgress,
  };
}

/**
 * Obtiene resumen de metas de ahorro
 * Cacheada por 30 segundos
 */
export const getSavingsSummary = cachedQuery(
  _getSavingsSummary,
  ['savings', 'summary'],
  { tags: [CACHE_TAGS.savings, CACHE_TAGS.summary], revalidate: 30 }
);

/**
 * Query interna para obtener metas activas (solo id y nombre, para selectores)
 */
async function _getActiveSavingsGoals(
  userId: string,
  projectId?: string
): Promise<{ id: string; name: string }[]> {
  const conditions = [
    eq(savingsGoals.userId, userId),
    eq(savingsGoals.isArchived, false),
  ];

  if (projectId) {
    conditions.push(eq(savingsGoals.projectId, projectId));
  }

  return await db
    .select({
      id: savingsGoals.id,
      name: savingsGoals.name,
    })
    .from(savingsGoals)
    .where(and(...conditions))
    .orderBy(savingsGoals.name);
}

/**
 * Obtiene metas de ahorro activas (para selectores en formularios)
 */
export const getActiveSavingsGoals = cachedQuery(
  _getActiveSavingsGoals,
  ['savings', 'active-goals'],
  { tags: [CACHE_TAGS.savings], revalidate: 30 }
);

/**
 * Obtiene las transacciones vinculadas a una meta de ahorro
 */
export async function getTransactionsBySavingsGoalId(
  goalId: string,
  userId: string
): Promise<TransactionWithCategory[]> {
  return await db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      projectId: transactions.projectId,
      categoryId: transactions.categoryId,
      accountId: transactions.accountId,
      entityId: transactions.entityId,
      type: transactions.type,
      originalAmount: transactions.originalAmount,
      originalCurrency: transactions.originalCurrency,
      baseAmount: transactions.baseAmount,
      baseCurrency: transactions.baseCurrency,
      exchangeRate: transactions.exchangeRate,
      date: transactions.date,
      description: transactions.description,
      notes: transactions.notes,
      isPaid: transactions.isPaid,
      paidAt: transactions.paidAt,
      creditId: transactions.creditId,
      budgetId: transactions.budgetId,
      cardPurchaseId: transactions.cardPurchaseId,
      savingsGoalId: transactions.savingsGoalId,
      linkedTransactionId: transactions.linkedTransactionId,
      paidByTransferId: transactions.paidByTransferId,
      isHistoricallyPaid: transactions.isHistoricallyPaid,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      categoryName: categories.name,
      categoryColor: categories.color,
      accountName: accounts.name,
      budgetName: budgets.name,
      entityName: entities.name,
      entityImageUrl: entities.imageUrl,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(budgets, eq(transactions.budgetId, budgets.id))
    .leftJoin(entities, eq(transactions.entityId, entities.id))
    .where(
      and(
        eq(transactions.savingsGoalId, goalId),
        eq(transactions.userId, userId)
      )
    )
    .orderBy(desc(transactions.date), desc(transactions.createdAt));
}
