'use server';

import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import { memberCondition, NO_PROJECT_ACCESS, verifyProjectWriteAccess } from '@/lib/auth/project-access';
import { db } from '@/lib/db';
import { categories, projectMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import type { ActionResult } from '@/types/action-result';
import { createCategorySchema, updateCategorySchema } from './schemas';
import type { CreateCategoryInput, UpdateCategoryInput } from './schemas';

/**
 * Proyecto de la categoría si el usuario puede modificarla (rol de escritura)
 */
async function findWritableCategoryProject(categoryId: string, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ projectId: categories.projectId })
    .from(categories)
    .innerJoin(projectMembers, eq(categories.projectId, projectMembers.projectId))
    .where(and(eq(categories.id, categoryId), memberCondition(userId, { write: true })))
    .limit(1);
  return row?.projectId ?? null;
}

/**
 * Crea una nueva categoría
 */
export async function createCategory(
  userId: string,
  input: CreateCategoryInput
): Promise<ActionResult<{ id: string }>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = createCategorySchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  const hasAccess = await verifyProjectWriteAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: NO_PROJECT_ACCESS };
  }

  const [newCategory] = await db
    .insert(categories)
    .values({
      projectId: parsed.data.projectId,
      name: parsed.data.name,
      color: parsed.data.color,
      defaultNature: parsed.data.defaultNature ?? null,
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
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = updateCategorySchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar que la categoría existe y el usuario puede modificarla
  const projectId = await findWritableCategoryProject(categoryId, userId);
  if (!projectId) {
    return { success: false, error: 'Categoría no encontrada' };
  }

  await db
    .update(categories)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(and(eq(categories.id, categoryId), eq(categories.projectId, projectId)));

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
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  // Verificar acceso de escritura
  const projectId = await findWritableCategoryProject(categoryId, userId);
  if (!projectId) {
    return { success: false, error: 'Categoría no encontrada' };
  }

  await db
    .update(categories)
    .set({
      isArchived: true,
      updatedAt: new Date(),
    })
    .where(and(eq(categories.id, categoryId), eq(categories.projectId, projectId)));

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
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  // Verificar acceso de escritura
  const projectId = await findWritableCategoryProject(categoryId, userId);
  if (!projectId) {
    return { success: false, error: 'Categoría no encontrada' };
  }

  await db
    .update(categories)
    .set({
      isArchived: false,
      updatedAt: new Date(),
    })
    .where(and(eq(categories.id, categoryId), eq(categories.projectId, projectId)));

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
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  // Verificar acceso de escritura
  const projectId = await findWritableCategoryProject(categoryId, userId);
  if (!projectId) {
    return { success: false, error: 'Categoría no encontrada' };
  }

  await db
    .delete(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.projectId, projectId)));

  invalidateRelatedCache('categories');

  return { success: true, data: undefined };
}
