import { db } from '@/lib/db';
import { categories, projectMembers } from '@/lib/db/schema';
import { eq, and, asc, isNotNull } from 'drizzle-orm';
import type { Category } from './types';

/**
 * Obtiene todas las categorías del proyecto
 */
export async function getCategories(projectId: string, userId: string): Promise<Category[]> {
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

  return db
    .select()
    .from(categories)
    .where(eq(categories.projectId, projectId))
    .orderBy(asc(categories.name));
}

/**
 * Obtiene categorías activas (no archivadas) del proyecto
 */
export async function getActiveCategories(projectId: string, userId: string): Promise<Category[]> {
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

  return db
    .select()
    .from(categories)
    .where(and(eq(categories.projectId, projectId), eq(categories.isArchived, false)))
    .orderBy(asc(categories.name));
}

/**
 * Obtiene una categoría por ID
 */
export async function getCategoryById(
  categoryId: string,
  userId: string
): Promise<Category | null> {
  const result = await db
    .select({
      id: categories.id,
      projectId: categories.projectId,
      name: categories.name,
      color: categories.color,
      isArchived: categories.isArchived,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
    })
    .from(categories)
    .innerJoin(projectMembers, eq(categories.projectId, projectMembers.projectId))
    .where(
      and(
        eq(categories.id, categoryId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  return result[0] ?? null;
}
