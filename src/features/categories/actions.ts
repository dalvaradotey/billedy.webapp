'use server';

import { db } from '@/lib/db';
import { categories, projectMembers } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import { createCategorySchema, updateCategorySchema } from './schemas';
import type { CreateCategoryInput, UpdateCategoryInput } from './schemas';

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Verifica que el usuario tenga acceso al proyecto
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
 * Crea una nueva categoría
 */
export async function createCategory(
  userId: string,
  input: CreateCategoryInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = createCategorySchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  const hasAccess = await verifyProjectAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  const [newCategory] = await db
    .insert(categories)
    .values({
      projectId: parsed.data.projectId,
      name: parsed.data.name,
      color: parsed.data.color,
    })
    .returning({ id: categories.id });

  invalidateRelatedCache('categories');

  return { success: true, data: { id: newCategory.id } };
}

/**
 * Actualiza una categoría existente
 */
export async function updateCategory(
  categoryId: string,
  userId: string,
  input: UpdateCategoryInput
): Promise<ActionResult> {
  const parsed = updateCategorySchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar que la categoría existe y el usuario tiene acceso al proyecto
  const existing = await db
    .select({ projectId: categories.projectId })
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

  if (!existing[0]) {
    return { success: false, error: 'Categoría no encontrada' };
  }

  await db
    .update(categories)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(categories.id, categoryId));

  invalidateRelatedCache('categories');

  return { success: true, data: undefined };
}

/**
 * Archiva una categoría
 */
export async function archiveCategory(
  categoryId: string,
  userId: string
): Promise<ActionResult> {
  // Verificar acceso
  const existing = await db
    .select({ projectId: categories.projectId })
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

  if (!existing[0]) {
    return { success: false, error: 'Categoría no encontrada' };
  }

  await db
    .update(categories)
    .set({
      isArchived: true,
      updatedAt: new Date(),
    })
    .where(eq(categories.id, categoryId));

  invalidateRelatedCache('categories');

  return { success: true, data: undefined };
}

/**
 * Restaura una categoría archivada
 */
export async function restoreCategory(
  categoryId: string,
  userId: string
): Promise<ActionResult> {
  // Verificar acceso
  const existing = await db
    .select({ projectId: categories.projectId })
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

  if (!existing[0]) {
    return { success: false, error: 'Categoría no encontrada' };
  }

  await db
    .update(categories)
    .set({
      isArchived: false,
      updatedAt: new Date(),
    })
    .where(eq(categories.id, categoryId));

  invalidateRelatedCache('categories');

  return { success: true, data: undefined };
}

/**
 * Elimina una categoría permanentemente
 * Solo debe usarse si no tiene transacciones asociadas
 */
export async function deleteCategory(
  categoryId: string,
  userId: string
): Promise<ActionResult> {
  // Verificar acceso
  const existing = await db
    .select({ projectId: categories.projectId })
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

  if (!existing[0]) {
    return { success: false, error: 'Categoría no encontrada' };
  }

  await db.delete(categories).where(eq(categories.id, categoryId));

  invalidateRelatedCache('categories');

  return { success: true, data: undefined };
}
