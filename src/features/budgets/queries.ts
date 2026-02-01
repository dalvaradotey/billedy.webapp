import { db } from '@/lib/db';
import { budgets, categories, projectMembers } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import type { BudgetWithCategory } from './types';

/**
 * Obtiene las plantillas de presupuesto del proyecto con información de categoría
 */
export async function getBudgetsWithCategory(
  projectId: string,
  userId: string
): Promise<BudgetWithCategory[]> {
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

  // Obtener presupuestos con categoría (left join ya que categoryId es opcional)
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
 * Obtiene presupuestos activos del proyecto para selectores
 */
export async function getActiveBudgets(
  projectId: string,
  userId: string
): Promise<{ id: string; name: string; categoryId: string | null }[]> {
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

  const result = await db
    .select({
      id: budgets.id,
      name: budgets.name,
      categoryId: budgets.categoryId,
    })
    .from(budgets)
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
 * Obtiene categorías activas del proyecto
 */
export async function getProjectCategories(
  projectId: string,
  userId: string
): Promise<{ id: string; name: string; color: string }[]> {
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
