import { db } from '@/lib/db';
import { entities, users } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { cachedQuery, CACHE_TAGS } from '@/lib/cache';
import type { Entity } from './types';

/**
 * Query interna para obtener entidades activas
 */
async function _getEntities(): Promise<Entity[]> {
  return db
    .select()
    .from(entities)
    .where(eq(entities.isActive, true))
    .orderBy(asc(entities.name));
}

/**
 * Obtiene todas las entidades activas
 * Cacheada por 5 minutos (datos maestros que cambian poco)
 */
export const getEntities = cachedQuery(
  _getEntities,
  ['entities', 'active'],
  { tags: [CACHE_TAGS.entities], revalidate: 300 }
);

/**
 * Obtiene todas las entidades (incluyendo inactivas) - solo para admin
 */
export async function getAllEntities(): Promise<Entity[]> {
  return db.select().from(entities).orderBy(asc(entities.name));
}

/**
 * Query interna para verificar admin
 */
async function _isUserAdmin(userId: string): Promise<boolean> {
  const result = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result[0]?.isAdmin ?? false;
}

/**
 * Verifica si un usuario es administrador
 * Cacheada por 3 minutos (cambia muy raramente)
 */
export const isUserAdmin = cachedQuery(
  _isUserAdmin,
  ['users', 'is-admin'],
  { tags: [CACHE_TAGS.projects], revalidate: 180 }
);
