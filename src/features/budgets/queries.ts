import { db } from '@/lib/db';
import { budgets, categories, transactions, projectMembers } from '@/lib/db/schema';
import { eq, and, sql, isNotNull, gte, lt } from 'drizzle-orm';
import type { BudgetWithProgress, BudgetSummary, BudgetPeriod } from './types';

/**
 * Obtiene los presupuestos del proyecto con el progreso de gasto
 */
export async function getBudgetsWithProgress(
  projectId: string,
  userId: string,
  period: BudgetPeriod
): Promise<BudgetWithProgress[]> {
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

  // Obtener presupuestos del período
  const budgetsList = await db
    .select({
      id: budgets.id,
      projectId: budgets.projectId,
      categoryId: budgets.categoryId,
      year: budgets.year,
      month: budgets.month,
      amount: budgets.amount,
      createdAt: budgets.createdAt,
      updatedAt: budgets.updatedAt,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryType: categories.type,
    })
    .from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .where(
      and(
        eq(budgets.projectId, projectId),
        eq(budgets.year, period.year),
        eq(budgets.month, period.month)
      )
    )
    .orderBy(categories.name);

  if (budgetsList.length === 0) {
    return [];
  }

  // Calcular el rango de fechas del mes
  const startDate = new Date(period.year, period.month - 1, 1);
  const endDate = new Date(period.year, period.month, 1);

  // Obtener gastos por categoría del período
  const spentByCategory = await db
    .select({
      categoryId: transactions.categoryId,
      totalSpent: sql<string>`SUM(${transactions.baseAmount})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.projectId, projectId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, startDate),
        lt(transactions.date, endDate)
      )
    )
    .groupBy(transactions.categoryId);

  // Crear mapa de gastos por categoría
  const spentMap = new Map<string, number>();
  for (const row of spentByCategory) {
    spentMap.set(row.categoryId, parseFloat(row.totalSpent ?? '0'));
  }

  // Combinar presupuestos con gastos
  return budgetsList.map((budget) => {
    const budgetAmount = parseFloat(budget.amount);
    const spent = spentMap.get(budget.categoryId) ?? 0;
    const remaining = budgetAmount - spent;
    const percentage = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;

    return {
      ...budget,
      spent,
      remaining,
      percentage,
      isOverBudget: spent > budgetAmount,
    };
  });
}

/**
 * Obtiene el resumen de presupuestos del período
 */
export async function getBudgetSummary(
  projectId: string,
  userId: string,
  period: BudgetPeriod
): Promise<BudgetSummary> {
  const budgetsWithProgress = await getBudgetsWithProgress(projectId, userId, period);

  let totalBudgeted = 0;
  let totalSpent = 0;
  let categoriesOverBudget = 0;
  let categoriesOnTrack = 0;

  for (const budget of budgetsWithProgress) {
    totalBudgeted += parseFloat(budget.amount);
    totalSpent += budget.spent;

    if (budget.isOverBudget) {
      categoriesOverBudget++;
    } else {
      categoriesOnTrack++;
    }
  }

  return {
    totalBudgeted,
    totalSpent,
    totalRemaining: totalBudgeted - totalSpent,
    categoriesOverBudget,
    categoriesOnTrack,
  };
}

/**
 * Obtiene un presupuesto específico
 */
export async function getBudgetById(
  budgetId: string,
  userId: string
): Promise<BudgetWithProgress | null> {
  const result = await db
    .select({
      id: budgets.id,
      projectId: budgets.projectId,
      categoryId: budgets.categoryId,
      year: budgets.year,
      month: budgets.month,
      amount: budgets.amount,
      createdAt: budgets.createdAt,
      updatedAt: budgets.updatedAt,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryType: categories.type,
    })
    .from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .innerJoin(projectMembers, eq(budgets.projectId, projectMembers.projectId))
    .where(
      and(
        eq(budgets.id, budgetId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!result[0]) {
    return null;
  }

  const budget = result[0];
  const budgetAmount = parseFloat(budget.amount);

  // Calcular gastos de este presupuesto
  const startDate = new Date(budget.year, budget.month - 1, 1);
  const endDate = new Date(budget.year, budget.month, 1);

  const spentResult = await db
    .select({
      totalSpent: sql<string>`SUM(${transactions.baseAmount})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.projectId, budget.projectId),
        eq(transactions.categoryId, budget.categoryId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, startDate),
        lt(transactions.date, endDate)
      )
    );

  const spent = parseFloat(spentResult[0]?.totalSpent ?? '0');
  const remaining = budgetAmount - spent;
  const percentage = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;

  return {
    ...budget,
    spent,
    remaining,
    percentage,
    isOverBudget: spent > budgetAmount,
  };
}

/**
 * Obtiene categorías de gasto que no tienen presupuesto en el período
 */
export async function getCategoriesWithoutBudget(
  projectId: string,
  userId: string,
  period: BudgetPeriod
): Promise<{ id: string; name: string; color: string }[]> {
  // Obtener todas las categorías de gasto del usuario
  const allCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      color: categories.color,
    })
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.type, 'expense'),
        eq(categories.isArchived, false)
      )
    )
    .orderBy(categories.name);

  // Obtener categorías que ya tienen presupuesto
  const existingBudgets = await db
    .select({ categoryId: budgets.categoryId })
    .from(budgets)
    .where(
      and(
        eq(budgets.projectId, projectId),
        eq(budgets.year, period.year),
        eq(budgets.month, period.month)
      )
    );

  const budgetedCategoryIds = new Set(existingBudgets.map((b) => b.categoryId));

  // Filtrar categorías sin presupuesto
  return allCategories.filter((cat) => !budgetedCategoryIds.has(cat.id));
}
