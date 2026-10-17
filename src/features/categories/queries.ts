import { db } from '@/lib/db';
import { categories } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { verifyProjectAccess } from '@/lib/auth/project-access';
import { cachedQuery, CACHE_TAGS } from '@/lib/cache';
import type { Category } from './types';

/**
 * Query interna para obtener categorías
 */
async function _getCategories(projectId: string, userId: string): Promise<Category[]> {
  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) return [];

  return db
    .select()
    .from(categories)
    .where(eq(categories.projectId, projectId))
    .orderBy(asc(categories.name));
}

/**
 * Obtiene todas las categorías del proyecto
 * Cacheada por 60 segundos
 */
export const getCategories = cachedQuery(
  _getCategories,
  ['categories', 'list'],
  { tags: [CACHE_TAGS.categories] }
);

/**
 * Query interna para obtener categorías activas
 */
async function _getActiveCategories(projectId: string, userId: string): Promise<Category[]> {
  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) return [];

  return db
    .select()
    .from(categories)
    .where(and(eq(categories.projectId, projectId), eq(categories.isArchived, false)))
    .orderBy(asc(categories.name));
}

/**
 * Obtiene categorías activas (no archivadas) del proyecto
 * Cacheada por 60 segundos
 */
export const getActiveCategories = cachedQuery(
  _getActiveCategories,
  ['categories', 'active'],
  { tags: [CACHE_TAGS.categories] }
);
