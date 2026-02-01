import { db } from '@/lib/db';
import { entities, users } from '@/lib/db/schema';
import { eq, asc, and } from 'drizzle-orm';
import type { Entity, EntityType } from './types';

/**
 * Obtiene todas las entidades activas
 */
export async function getEntities(): Promise<Entity[]> {
  return db
    .select()
    .from(entities)
    .where(eq(entities.isActive, true))
    .orderBy(asc(entities.name));
}

/**
 * Obtiene todas las entidades (incluyendo inactivas) - solo para admin
 */
export async function getAllEntities(): Promise<Entity[]> {
  return db.select().from(entities).orderBy(asc(entities.name));
}

/**
 * Obtiene entidades por tipo
 */
export async function getEntitiesByType(type: EntityType): Promise<Entity[]> {
  return db
    .select()
    .from(entities)
    .where(and(eq(entities.type, type), eq(entities.isActive, true)))
    .orderBy(asc(entities.name));
}

/**
 * Obtiene una entidad por ID
 */
export async function getEntityById(id: string): Promise<Entity | null> {
  const result = await db
    .select()
    .from(entities)
    .where(eq(entities.id, id))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Verifica si un usuario es administrador
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const result = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result[0]?.isAdmin ?? false;
}
