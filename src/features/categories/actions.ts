'use server';

import { db } from '@/lib/db';
import { categories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createCategorySchema, updateCategorySchema } from './schemas';
import type { CreateCategoryInput, UpdateCategoryInput } from './schemas';

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

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

  const [newCategory] = await db
    .insert(categories)
    .values({
      ...parsed.data,
      userId,
    })
    .returning({ id: categories.id });

  revalidatePath('/dashboard/categories');

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

  await db
    .update(categories)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));

  revalidatePath('/dashboard/categories');

  return { success: true, data: undefined };
}

/**
 * Archiva una categoría
 */
export async function archiveCategory(
  categoryId: string,
  userId: string
): Promise<ActionResult> {
  await db
    .update(categories)
    .set({
      isArchived: true,
      updatedAt: new Date(),
    })
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));

  revalidatePath('/dashboard/categories');

  return { success: true, data: undefined };
}

/**
 * Restaura una categoría archivada
 */
export async function restoreCategory(
  categoryId: string,
  userId: string
): Promise<ActionResult> {
  await db
    .update(categories)
    .set({
      isArchived: false,
      updatedAt: new Date(),
    })
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));

  revalidatePath('/dashboard/categories');

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
  await db
    .delete(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));

  revalidatePath('/dashboard/categories');

  return { success: true, data: undefined };
}
