import { db } from '@/lib/db';
import { categories } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import type { Category, CategoryType, CategoryGroup } from './types';

/**
 * Obtiene todas las categorías del usuario
 */
export async function getCategories(userId: string): Promise<Category[]> {
  return db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.group), asc(categories.name));
}

/**
 * Obtiene categorías activas (no archivadas) del usuario
 */
export async function getActiveCategories(userId: string): Promise<Category[]> {
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.isArchived, false)))
    .orderBy(asc(categories.group), asc(categories.name));
}

/**
 * Obtiene categorías por tipo (income/expense)
 */
export async function getCategoriesByType(
  userId: string,
  type: CategoryType
): Promise<Category[]> {
  return db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.type, type),
        eq(categories.isArchived, false)
      )
    )
    .orderBy(asc(categories.group), asc(categories.name));
}

/**
 * Obtiene categorías agrupadas por grupo
 */
export async function getCategoriesGrouped(userId: string): Promise<CategoryGroup[]> {
  const allCategories = await getActiveCategories(userId);

  const groupMap = new Map<string | null, Category[]>();

  for (const category of allCategories) {
    const groupName = category.group;
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, []);
    }
    groupMap.get(groupName)!.push(category);
  }

  // Convertir a array y ordenar (null al final)
  const groups: CategoryGroup[] = [];
  const sortedKeys = Array.from(groupMap.keys()).sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a.localeCompare(b);
  });

  for (const key of sortedKeys) {
    groups.push({
      name: key,
      categories: groupMap.get(key)!,
    });
  }

  return groups;
}

/**
 * Obtiene una categoría por ID
 */
export async function getCategoryById(
  categoryId: string,
  userId: string
): Promise<Category | null> {
  const result = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1);

  return result[0] ?? null;
}
