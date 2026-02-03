'use server';

import { invalidateCache, CACHE_TAGS } from '@/lib/cache';
import { db } from '@/lib/db';
import {
  templates,
  templateItems,
  projectMembers,
  projects,
  currencies,
} from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import {
  createTemplateSchema,
  updateTemplateSchema,
  createTemplateItemSchema,
  updateTemplateItemSchema,
} from './schemas';
import type { Template, TemplateItem } from './types';

/**
 * Crea una nueva plantilla
 */
export async function createTemplate(data: {
  userId: string;
  projectId: string;
  name: string;
  description?: string | null;
}): Promise<{ success: boolean; data?: Template; error?: string }> {
  try {
    const validated = createTemplateSchema.parse(data);

    // Verificar acceso al proyecto
    const hasAccess = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, validated.projectId),
          eq(projectMembers.userId, validated.userId),
          isNotNull(projectMembers.acceptedAt)
        )
      )
      .limit(1);

    if (hasAccess.length === 0) {
      return { success: false, error: 'No tienes acceso a este proyecto' };
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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear la plantilla',
    };
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
): Promise<{ success: boolean; data?: Template; error?: string }> {
  try {
    const validated = updateTemplateSchema.parse(data);

    // Verificar acceso
    const existing = await db
      .select({ id: templates.id })
      .from(templates)
      .innerJoin(projectMembers, eq(templates.projectId, projectMembers.projectId))
      .where(
        and(
          eq(templates.id, templateId),
          eq(projectMembers.userId, userId),
          isNotNull(projectMembers.acceptedAt)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return { success: false, error: 'Plantilla no encontrada' };
    }

    const [updated] = await db
      .update(templates)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(eq(templates.id, templateId))
      .returning();

    invalidateCache(CACHE_TAGS.templates);

    return { success: true, data: updated };
  } catch (error) {
    console.error('Error updating template:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar',
    };
  }
}

/**
 * Archiva una plantilla
 */
export async function archiveTemplate(
  templateId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await db
      .select({ id: templates.id })
      .from(templates)
      .innerJoin(projectMembers, eq(templates.projectId, projectMembers.projectId))
      .where(
        and(
          eq(templates.id, templateId),
          eq(projectMembers.userId, userId),
          isNotNull(projectMembers.acceptedAt)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return { success: false, error: 'Plantilla no encontrada' };
    }

    await db
      .update(templates)
      .set({
        isArchived: true,
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(templates.id, templateId));

    invalidateCache(CACHE_TAGS.templates);

    return { success: true };
  } catch (error) {
    console.error('Error archiving template:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al archivar',
    };
  }
}

/**
 * Elimina una plantilla y todos sus items
 */
export async function deleteTemplate(
  templateId: string,
  userId: string
): Promise<{ success: boolean; deletedItems?: number; error?: string }> {
  try {
    const existing = await db
      .select({ id: templates.id })
      .from(templates)
      .innerJoin(projectMembers, eq(templates.projectId, projectMembers.projectId))
      .where(
        and(
          eq(templates.id, templateId),
          eq(projectMembers.userId, userId),
          isNotNull(projectMembers.acceptedAt)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return { success: false, error: 'Plantilla no encontrada' };
    }

    // Los items se eliminan automáticamente por CASCADE
    await db.delete(templates).where(eq(templates.id, templateId));

    invalidateCache(CACHE_TAGS.templates);

    return { success: true };
  } catch (error) {
    console.error('Error deleting template:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar',
    };
  }
}

/**
 * Crea un nuevo item en una plantilla
 */
export async function createTemplateItem(data: {
  templateId: string;
  userId: string;
  projectId: string;
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
}): Promise<{ success: boolean; data?: TemplateItem; error?: string }> {
  try {
    const validated = createTemplateItemSchema.parse(data);

    // Verificar acceso al proyecto y que la plantilla exista
    const [templateInfo] = await db
      .select({ id: templates.id })
      .from(templates)
      .innerJoin(projectMembers, eq(templates.projectId, projectMembers.projectId))
      .where(
        and(
          eq(templates.id, validated.templateId),
          eq(projectMembers.userId, validated.userId),
          isNotNull(projectMembers.acceptedAt)
        )
      )
      .limit(1);

    if (!templateInfo) {
      return { success: false, error: 'Plantilla no encontrada' };
    }

    const [item] = await db
      .insert(templateItems)
      .values({
        templateId: validated.templateId,
        userId: validated.userId,
        projectId: validated.projectId,
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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear el item',
    };
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
): Promise<{ success: boolean; data?: TemplateItem; error?: string }> {
  try {
    const validated = updateTemplateItemSchema.parse(data);

    // Verificar acceso
    const existing = await db
      .select({ id: templateItems.id })
      .from(templateItems)
      .innerJoin(projectMembers, eq(templateItems.projectId, projectMembers.projectId))
      .where(
        and(
          eq(templateItems.id, itemId),
          eq(projectMembers.userId, userId),
          isNotNull(projectMembers.acceptedAt)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return { success: false, error: 'Item no encontrado' };
    }

    const updateData: Record<string, unknown> = {
      ...validated,
      updatedAt: new Date(),
    };

    // Formatear montos si se proporcionan
    if (validated.originalAmount !== undefined) {
      updateData.originalAmount = validated.originalAmount.toFixed(2);
    }
    if (validated.baseAmount !== undefined) {
      updateData.baseAmount = validated.baseAmount.toFixed(2);
    }

    const [updated] = await db
      .update(templateItems)
      .set(updateData)
      .where(eq(templateItems.id, itemId))
      .returning();

    invalidateCache(CACHE_TAGS.templates);

    return { success: true, data: updated };
  } catch (error) {
    console.error('Error updating template item:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar',
    };
  }
}

/**
 * Elimina un item de plantilla
 */
export async function deleteTemplateItem(
  itemId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await db
      .select({ id: templateItems.id })
      .from(templateItems)
      .innerJoin(projectMembers, eq(templateItems.projectId, projectMembers.projectId))
      .where(
        and(
          eq(templateItems.id, itemId),
          eq(projectMembers.userId, userId),
          isNotNull(projectMembers.acceptedAt)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return { success: false, error: 'Item no encontrado' };
    }

    await db.delete(templateItems).where(eq(templateItems.id, itemId));

    invalidateCache(CACHE_TAGS.templates);

    return { success: true };
  } catch (error) {
    console.error('Error deleting template item:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar',
    };
  }
}

/**
 * Alterna el estado activo de una plantilla
 */
export async function toggleTemplateActive(
  templateId: string,
  userId: string
): Promise<{ success: boolean; isActive?: boolean; error?: string }> {
  try {
    // Verificar acceso y obtener estado actual
    const [existing] = await db
      .select({ id: templates.id, isActive: templates.isActive })
      .from(templates)
      .innerJoin(projectMembers, eq(templates.projectId, projectMembers.projectId))
      .where(
        and(
          eq(templates.id, templateId),
          eq(projectMembers.userId, userId),
          isNotNull(projectMembers.acceptedAt)
        )
      )
      .limit(1);

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
      .where(eq(templates.id, templateId));

    invalidateCache(CACHE_TAGS.templates);

    return { success: true, isActive: newIsActive };
  } catch (error) {
    console.error('Error toggling template active:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al cambiar estado',
    };
  }
}
