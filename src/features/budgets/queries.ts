import { db } from '@/lib/db';
import { budgets, categories, projectMembers } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { cachedQuery, CACHE_TAGS } from '@/lib/cache';
import type { BudgetWithCategory } from './types';

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
      defaultAmount: budgets.defaultAmount,
      currency: budgets.currency,
      isActive: budgets.isActive,
      createdAt: budgets.createdAt,
      updatedAt: budgets.updatedAt,
      categoryName: categories.name,
      categoryColor: categories.color,
    })
    .from(budgets)
    .leftJoin(categories, eq(budgets.categoryId, categories.id))
    .where(eq(budgets.projectId, projectId))
    .orderBy(budgets.name);

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
}[]> {
  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) return [];

  const result = await db
    .select({
      id: budgets.id,
      name: budgets.name,
      categoryId: budgets.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
    })
    .from(budgets)
    .leftJoin(categories, eq(budgets.categoryId, categories.id))
    .where(
      and(
        eq(budgets.projectId, projectId),
        eq(budgets.isActive, true)
      )
    )
    .orderBy(budgets.name);

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
