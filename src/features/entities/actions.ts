'use server';

import { db } from '@/lib/db';
import { entities } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { uploadImage, deleteImage } from '@/lib/cloudinary';
import { createEntitySchema, updateEntitySchema } from './schemas';
import { isUserAdmin } from './queries';
import type { CreateEntityInput, UpdateEntityInput } from './schemas';

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Crea una nueva entidad (solo admin)
 */
export async function createEntity(
  userId: string,
  input: CreateEntityInput,
  imageFile?: string // base64 encoded image
): Promise<ActionResult<{ id: string }>> {
  // Verificar que el usuario sea admin
  const admin = await isUserAdmin(userId);
  if (!admin) {
    return { success: false, error: 'No tienes permisos para crear entidades' };
  }

  const parsed = createEntitySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  let imageUrl: string | undefined;

  // Subir imagen si se proporciona
  if (imageFile) {
    try {
      imageUrl = await uploadImage(imageFile, 'entities');
    } catch {
      return { success: false, error: 'Error al subir la imagen' };
    }
  }

  const [newEntity] = await db
    .insert(entities)
    .values({
      ...parsed.data,
      imageUrl,
      createdBy: userId,
    })
    .returning({ id: entities.id });

  revalidatePath('/admin/entities');

  return { success: true, data: { id: newEntity.id } };
}

/**
 * Actualiza una entidad existente (solo admin)
 */
export async function updateEntity(
  entityId: string,
  userId: string,
  input: UpdateEntityInput,
  imageFile?: string // base64 encoded image
): Promise<ActionResult> {
  // Verificar que el usuario sea admin
  const admin = await isUserAdmin(userId);
  if (!admin) {
    return { success: false, error: 'No tienes permisos para editar entidades' };
  }

  const parsed = updateEntitySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  let imageUrl: string | undefined;

  // Subir nueva imagen si se proporciona
  if (imageFile) {
    try {
      // Obtener la entidad actual para eliminar la imagen anterior
      const current = await db
        .select({ imageUrl: entities.imageUrl })
        .from(entities)
        .where(eq(entities.id, entityId))
        .limit(1);

      // Eliminar imagen anterior si existe
      if (current[0]?.imageUrl) {
        await deleteImage(current[0].imageUrl);
      }

      imageUrl = await uploadImage(imageFile, 'entities');
    } catch {
      return { success: false, error: 'Error al subir la imagen' };
    }
  }

  await db
    .update(entities)
    .set({
      ...parsed.data,
      ...(imageUrl && { imageUrl }),
      updatedAt: new Date(),
    })
    .where(eq(entities.id, entityId));

  revalidatePath('/admin/entities');

  return { success: true, data: undefined };
}

/**
 * Desactiva una entidad (solo admin)
 */
export async function deactivateEntity(
  entityId: string,
  userId: string
): Promise<ActionResult> {
  const admin = await isUserAdmin(userId);
  if (!admin) {
    return { success: false, error: 'No tienes permisos para desactivar entidades' };
  }

  await db
    .update(entities)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(entities.id, entityId));

  revalidatePath('/admin/entities');

  return { success: true, data: undefined };
}

/**
 * Activa una entidad (solo admin)
 */
export async function activateEntity(
  entityId: string,
  userId: string
): Promise<ActionResult> {
  const admin = await isUserAdmin(userId);
  if (!admin) {
    return { success: false, error: 'No tienes permisos para activar entidades' };
  }

  await db
    .update(entities)
    .set({
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(entities.id, entityId));

  revalidatePath('/admin/entities');

  return { success: true, data: undefined };
}

/**
 * Elimina una entidad permanentemente (solo admin)
 */
export async function deleteEntity(
  entityId: string,
  userId: string
): Promise<ActionResult> {
  const admin = await isUserAdmin(userId);
  if (!admin) {
    return { success: false, error: 'No tienes permisos para eliminar entidades' };
  }

  // Obtener la entidad para eliminar la imagen
  const entity = await db
    .select({ imageUrl: entities.imageUrl })
    .from(entities)
    .where(eq(entities.id, entityId))
    .limit(1);

  // Eliminar imagen de Cloudinary si existe
  if (entity[0]?.imageUrl) {
    try {
      await deleteImage(entity[0].imageUrl);
    } catch {
      // Continue even if image deletion fails
    }
  }

  await db.delete(entities).where(eq(entities.id, entityId));

  revalidatePath('/admin/entities');

  return { success: true, data: undefined };
}
