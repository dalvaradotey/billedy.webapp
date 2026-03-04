import { db } from '@/lib/db';
import { budgets, categories, projectMembers, accounts, transactions } from '@/lib/db/schema';
import { eq, and, isNotNull, isNull, sql, gte, lte, or, asc } from 'drizzle-orm';
import { cachedQuery, CACHE_TAGS } from '@/lib/cache';
import type { BudgetWithCategory, BudgetProgress } from './types';

/**
 * Verifica acceso al proyecto (helper interno)
 */
async function verifyProjectAccess(projectId: string, userId: string): Promise<boolean> {
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

  return hasAccess.length > 0;
}

/**
 * Query interna para obtener presupuestos con categoría
 */
async function _getBudgetsWithCategory(
  projectId: string,
  userId: string
): Promise<BudgetWithCategory[]> {
  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) return [];

  const budgetsList = await db
    .select({
      id: budgets.id,
      projectId: budgets.projectId,
      name: budgets.name,
      categoryId: budgets.categoryId,
      defaultAccountId: budgets.defaultAccountId,
      defaultAmount: budgets.defaultAmount,
      currency: budgets.currency,
      startDate: budgets.startDate,
      endDate: budgets.endDate,
      isActive: budgets.isActive,
      sortOrder: budgets.sortOrder,
      createdAt: budgets.createdAt,
      updatedAt: budgets.updatedAt,
      categoryName: categories.name,
      categoryColor: categories.color,
      accountName: accounts.name,
    })
    .from(budgets)
    .leftJoin(categories, eq(budgets.categoryId, categories.id))
    .leftJoin(accounts, eq(budgets.defaultAccountId, accounts.id))
    .where(eq(budgets.projectId, projectId))
    .orderBy(asc(budgets.sortOrder), asc(budgets.name));

  return budgetsList;
}

/**
 * Obtiene las plantillas de presupuesto del proyecto con información de categoría
 * Cacheada por 60 segundos
 */
export const getBudgetsWithCategory = cachedQuery(
  _getBudgetsWithCategory,
  ['budgets', 'with-category'],
  { tags: [CACHE_TAGS.budgets, CACHE_TAGS.categories] }
);

/**
 * Query interna para obtener presupuestos activos con info de categoría
 * Filtra presupuestos temporales expirados
 */
async function _getActiveBudgets(
  projectId: string,
  userId: string
): Promise<{
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  defaultAccountId: string | null;
}[]> {
  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) return [];

  const today = new Date();

  const result = await db
    .select({
      id: budgets.id,
      name: budgets.name,
      categoryId: budgets.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      defaultAccountId: budgets.defaultAccountId,
    })
    .from(budgets)
    .leftJoin(categories, eq(budgets.categoryId, categories.id))
    .where(
      and(
        eq(budgets.projectId, projectId),
        eq(budgets.isActive, true),
        // Excluir temporales expirados
        or(
          isNull(budgets.startDate),
          and(
            lte(budgets.startDate, today),
            gte(budgets.endDate, today)
          )
        )
      )
    )
    .orderBy(asc(budgets.sortOrder), asc(budgets.name));

  return result;
}

/**
 * Obtiene presupuestos activos del proyecto para selectores (con info de categoría)
 * Cacheada por 60 segundos
 */
export const getActiveBudgets = cachedQuery(
  _getActiveBudgets,
  ['budgets', 'active'],
  { tags: [CACHE_TAGS.budgets, CACHE_TAGS.categories] }
);

/**
 * Query interna para obtener categorías del proyecto
 */
async function _getProjectCategories(
  projectId: string,
  userId: string
): Promise<{ id: string; name: string; color: string }[]> {
  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) return [];

  const result = await db
    .select({
      id: categories.id,
      name: categories.name,
      color: categories.color,
    })
    .from(categories)
    .where(
      and(
        eq(categories.projectId, projectId),
        eq(categories.isArchived, false)
      )
    )
    .orderBy(categories.name);

  return result;
}

/**
 * Obtiene categorías activas del proyecto
 * Cacheada por 60 segundos
 */
export const getProjectCategories = cachedQuery(
  _getProjectCategories,
  ['budgets', 'project-categories'],
  { tags: [CACHE_TAGS.categories] }
);

/**
 * Query interna para obtener progreso de presupuestos para un rango de fechas (ciclo)
 * Para presupuestos permanentes: usa el rango del ciclo
 * Para presupuestos temporales: usa su propio rango de fechas
 */
async function _getBudgetsProgress(
  projectId: string,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<BudgetProgress[]> {
  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) return [];

  const today = new Date();
  // Convertir fechas a strings ISO para uso en sql`` templates (el driver pg no serializa Date objects ahí)
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Obtener presupuestos activos con sus gastos en el período
  // Para temporales: usa su propio rango; para permanentes: usa rango del ciclo
  const result = await db
    .select({
      id: budgets.id,
      name: budgets.name,
      budgetedAmount: budgets.defaultAmount,
      categoryId: budgets.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      defaultAccountId: budgets.defaultAccountId,
      startDate: budgets.startDate,
      endDate: budgets.endDate,
      spentAmount: sql<string>`COALESCE(SUM(${transactions.baseAmount}), 0)`,
    })
    .from(budgets)
    .leftJoin(categories, eq(budgets.categoryId, categories.id))
    .leftJoin(
      transactions,
      and(
        eq(transactions.budgetId, budgets.id),
        eq(transactions.type, 'expense'),
        // Rango dinámico: si el budget tiene fechas propias, usa esas; si no, usa las del ciclo
        sql`${transactions.date} >= COALESCE(${budgets.startDate}, ${startDateStr}::date)`,
        sql`${transactions.date} <= COALESCE(${budgets.endDate}, ${endDateStr}::date)`
      )
    )
    .where(
      and(
        eq(budgets.projectId, projectId),
        eq(budgets.isActive, true),
        // Incluir permanentes + temporales vigentes
        or(
          isNull(budgets.startDate),
          and(
            lte(budgets.startDate, today),
            gte(budgets.endDate, today)
          )
        )
      )
    )
    .groupBy(
      budgets.id,
      budgets.name,
      budgets.defaultAmount,
      budgets.categoryId,
      budgets.defaultAccountId,
      budgets.sortOrder,
      budgets.startDate,
      budgets.endDate,
      categories.name,
      categories.color
    )
    .orderBy(asc(budgets.sortOrder), asc(budgets.name));

  return result.map((budget) => {
    const budgetedAmount = parseFloat(budget.budgetedAmount);
    const spentAmount = parseFloat(budget.spentAmount);
    const remainingAmount = budgetedAmount - spentAmount;
    const progressPercentage = budgetedAmount > 0
      ? Math.min(100, Math.round((spentAmount / budgetedAmount) * 100))
      : 0;

    return {
      id: budget.id,
      name: budget.name,
      budgetedAmount,
      spentAmount,
      remainingAmount,
      progressPercentage,
      categoryName: budget.categoryName,
      categoryColor: budget.categoryColor,
      categoryId: budget.categoryId,
      defaultAccountId: budget.defaultAccountId,
      startDate: budget.startDate,
      endDate: budget.endDate,
    };
  });
}

/**
 * Obtiene el progreso de presupuestos activos para un ciclo
 * Cacheado - las fechas forman parte de la cache key automáticamente
 */
export const getBudgetsProgress = cachedQuery(
  _getBudgetsProgress,
  ['budgets', 'progress'],
  { tags: [CACHE_TAGS.budgets, CACHE_TAGS.transactions] }
);
