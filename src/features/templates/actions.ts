'use server';

import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import {
  memberCondition,
  NO_PROJECT_ACCESS,
  projectRefsError,
  verifyProjectWriteAccess,
} from '@/lib/auth/project-access';
import { invalidateCache, CACHE_TAGS } from '@/lib/cache';
import { db } from '@/lib/db';
import { templates, templateItems, projectMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { ActionResult } from '@/types/action-result';
import {
  createTemplateSchema,
  updateTemplateSchema,
  createTemplateItemSchema,
  updateTemplateItemSchema,
} from './schemas';
import type { Template, TemplateItem } from './types';

/**
 * Plantilla que el usuario puede modificar (miembro con rol de escritura)
 */
async function findWritableTemplate(templateId: string, userId: string) {
  const [row] = await db
    .select({ id: templates.id, projectId: templates.projectId, isActive: templates.isActive })
    .from(templates)
    .innerJoin(projectMembers, eq(templates.projectId, projectMembers.projectId))
    .where(and(eq(templates.id, templateId), memberCondition(userId, { write: true })))
    .limit(1);
  return row ?? null;
}

/**
 * Item de plantilla que el usuario puede modificar (miembro con rol de escritura)
 */
async function findWritableTemplateItem(itemId: string, userId: string) {
  const [row] = await db
    .select({ id: templateItems.id, projectId: templateItems.projectId })
    .from(templateItems)
    .innerJoin(projectMembers, eq(templateItems.projectId, projectMembers.projectId))
    .where(and(eq(templateItems.id, itemId), memberCondition(userId, { write: true })))
    .limit(1);
  return row ?? null;
}

/**
 * Crea una nueva plantilla
 */
export async function createTemplate(data: {
  userId: string;
  projectId: string;
  name: string;
  description?: string | null;
}): Promise<ActionResult<Template>> {
  if (!(await isSessionUser(data.userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  try {
    const validated = createTemplateSchema.parse(data);

    // Verificar acceso de escritura al proyecto
    if (!(await verifyProjectWriteAccess(validated.projectId, validated.userId))) {
      return { success: false, error: NO_PROJECT_ACCESS };
    }

    const [template] = await db
      .insert(templates)
      .values({
        userId: validated.userId,
        projectId: validated.projectId,
        name: validated.name,
        description: validated.description || null,
      })
      .returning();

    invalidateCache(CACHE_TAGS.templates);

    return { success: true, data: template };
  } catch (error) {
    console.error('Error creating template:', error);
    return { success: false, error: 'Error al crear la plantilla' };
  }
}

/**
 * Actualiza una plantilla
 */
export async function updateTemplate(
  templateId: string,
  userId: string,
  data: {
    name?: string;
    description?: string | null;
    isActive?: boolean;
  }
): Promise<ActionResult<Template>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  try {
    const validated = updateTemplateSchema.parse(data);

    // Verificar acceso de escritura
    const existing = await findWritableTemplate(templateId, userId);
    if (!existing) {
      return { success: false, error: 'Plantilla no encontrada' };
    }

    const [updated] = await db
      .update(templates)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(and(eq(templates.id, templateId), eq(templates.projectId, existing.projectId)))
      .returning();

    invalidateCache(CACHE_TAGS.templates);

    return { success: true, data: updated };
  } catch (error) {
    console.error('Error updating template:', error);
    return { success: false, error: 'Error al actualizar' };
  }
}

/**
 * Archiva una plantilla
 */
export async function archiveTemplate(templateId: string, userId: string): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  try {
    const existing = await findWritableTemplate(templateId, userId);
    if (!existing) {
      return { success: false, error: 'Plantilla no encontrada' };
    }

    await db
      .update(templates)
      .set({
        isArchived: true,
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(eq(templates.id, templateId), eq(templates.projectId, existing.projectId)));

    invalidateCache(CACHE_TAGS.templates);

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error archiving template:', error);
    return { success: false, error: 'Error al archivar' };
  }
}

/**
 * Elimina una plantilla y todos sus items
 */
export async function deleteTemplate(templateId: string, userId: string): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  try {
    const existing = await findWritableTemplate(templateId, userId);
    if (!existing) {
      return { success: false, error: 'Plantilla no encontrada' };
    }

    // Los items se eliminan automáticamente por CASCADE
    await db
      .delete(templates)
      .where(and(eq(templates.id, templateId), eq(templates.projectId, existing.projectId)));

    invalidateCache(CACHE_TAGS.templates);

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error deleting template:', error);
    return { success: false, error: 'Error al eliminar' };
  }
}

/**
 * Crea un nuevo item en una plantilla.
 * El proyecto se toma de la plantilla verificada, nunca del cliente.
 */
export async function createTemplateItem(data: {
  templateId: string;
  userId: string;
  categoryId: string;
  accountId?: string | null;
  entityId?: string | null;
  type: 'income' | 'expense';
  description: string;
  originalAmount: number;
  originalCurrency: string;
  baseAmount: number;
  baseCurrency: string;
  notes?: string | null;
}): Promise<ActionResult<TemplateItem>> {
  if (!(await isSessionUser(data.userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  try {
    const validated = createTemplateItemSchema.parse(data);

    // Verificar acceso de escritura y que la plantilla exista
    const templateInfo = await findWritableTemplate(validated.templateId, validated.userId);
    if (!templateInfo) {
      return { success: false, error: 'Plantilla no encontrada' };
    }

    // La categoría y la cuenta deben ser del proyecto de la plantilla
    const refsError = await projectRefsError(templateInfo.projectId, {
      accountIds: [validated.accountId],
      categoryIds: [validated.categoryId],
    });
    if (refsError) return { success: false, error: refsError };

    const [item] = await db
      .insert(templateItems)
      .values({
        templateId: validated.templateId,
        userId: validated.userId,
        projectId: templateInfo.projectId,
        categoryId: validated.categoryId,
        accountId: validated.accountId || null,
        entityId: validated.entityId || null,
        type: validated.type,
        description: validated.description,
        originalAmount: validated.originalAmount.toFixed(2),
        originalCurrency: validated.originalCurrency,
        baseAmount: validated.baseAmount.toFixed(2),
        baseCurrency: validated.baseCurrency,
        notes: validated.notes || null,
      })
      .returning();

    invalidateCache(CACHE_TAGS.templates);

    return { success: true, data: item };
  } catch (error) {
    console.error('Error creating template item:', error);
    return { success: false, error: 'Error al crear el item' };
  }
}

/**
 * Actualiza un item de plantilla
 */
export async function updateTemplateItem(
  itemId: string,
  userId: string,
  data: {
    categoryId?: string;
    accountId?: string | null;
    entityId?: string | null;
    description?: string;
    originalAmount?: number;
    originalCurrency?: string;
    baseAmount?: number;
    baseCurrency?: string;
    notes?: string | null;
  }
): Promise<ActionResult<TemplateItem>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  try {
    const validated = updateTemplateItemSchema.parse(data);

    // Verificar acceso de escritura
    const existing = await findWritableTemplateItem(itemId, userId);
    if (!existing) {
      return { success: false, error: 'Item no encontrado' };
    }

    // La categoría y la cuenta nuevas deben ser del proyecto del item
    const refsError = await projectRefsError(existing.projectId, {
      accountIds: [validated.accountId],
      categoryIds: [validated.categoryId],
    });
    if (refsError) return { success: false, error: refsError };

    const { originalAmount, baseAmount, ...rest } = validated;
    const [updated] = await db
      .update(templateItems)
      .set({
        ...rest,
        // Formatear montos si se proporcionan
        ...(originalAmount !== undefined ? { originalAmount: originalAmount.toFixed(2) } : {}),
        ...(baseAmount !== undefined ? { baseAmount: baseAmount.toFixed(2) } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(templateItems.id, itemId), eq(templateItems.projectId, existing.projectId)))
      .returning();

    invalidateCache(CACHE_TAGS.templates);

    return { success: true, data: updated };
  } catch (error) {
    console.error('Error updating template item:', error);
    return { success: false, error: 'Error al actualizar' };
  }
}

/**
 * Elimina un item de plantilla
 */
export async function deleteTemplateItem(itemId: string, userId: string): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  try {
    const existing = await findWritableTemplateItem(itemId, userId);
    if (!existing) {
      return { success: false, error: 'Item no encontrado' };
    }

    await db
      .delete(templateItems)
      .where(and(eq(templateItems.id, itemId), eq(templateItems.projectId, existing.projectId)));

    invalidateCache(CACHE_TAGS.templates);

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error deleting template item:', error);
    return { success: false, error: 'Error al eliminar' };
  }
}

/**
 * Alterna el estado activo de una plantilla
 */
export async function toggleTemplateActive(
  templateId: string,
  userId: string
): Promise<ActionResult<{ isActive: boolean }>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  try {
    // Verificar acceso de escritura y obtener estado actual
    const existing = await findWritableTemplate(templateId, userId);
    if (!existing) {
      return { success: false, error: 'Plantilla no encontrada' };
    }

    const newIsActive = !existing.isActive;

    await db
      .update(templates)
      .set({
        isActive: newIsActive,
        updatedAt: new Date(),
      })
      .where(and(eq(templates.id, templateId), eq(templates.projectId, existing.projectId)));

    invalidateCache(CACHE_TAGS.templates);

    return { success: true, data: { isActive: newIsActive } };
  } catch (error) {
    console.error('Error toggling template active:', error);
    return { success: false, error: 'Error al cambiar estado' };
  }
}
