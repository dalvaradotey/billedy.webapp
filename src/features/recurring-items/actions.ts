'use server';

import { db } from '@/lib/db';
import { recurringItems, transactions, projects, projectMembers } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  createRecurringItemSchema,
  updateRecurringItemSchema,
  toggleActiveSchema,
} from './schemas';
import type {
  CreateRecurringItemInput,
  UpdateRecurringItemInput,
  ToggleActiveInput,
} from './schemas';
import { getActiveRecurringItems } from './queries';

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
 * Crea un nuevo item recurrente
 */
export async function createRecurringItem(
  userId: string,
  input: CreateRecurringItemInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = createRecurringItemSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar acceso al proyecto
  const hasAccess = await verifyProjectAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  // Obtener la moneda base del proyecto
  const project = await db
    .select({
      baseCurrencyId: projects.baseCurrencyId,
    })
    .from(projects)
    .where(eq(projects.id, parsed.data.projectId))
    .limit(1);

  if (!project[0]) {
    return { success: false, error: 'Proyecto no encontrado' };
  }

  const amount = String(parsed.data.amount);

  const [newItem] = await db
    .insert(recurringItems)
    .values({
      userId,
      projectId: parsed.data.projectId,
      categoryId: parsed.data.categoryId,
      accountId: parsed.data.accountId,
      type: parsed.data.type,
      name: parsed.data.name,
      amount,
      currencyId: project[0].baseCurrencyId,
      dayOfMonth: parsed.data.dayOfMonth,
      isActive: parsed.data.isActive ?? true,
    })
    .returning({ id: recurringItems.id });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/recurring');

  return { success: true, data: { id: newItem.id } };
}

/**
 * Actualiza un item recurrente existente
 */
export async function updateRecurringItem(
  itemId: string,
  userId: string,
  input: UpdateRecurringItemInput
): Promise<ActionResult> {
  const parsed = updateRecurringItemSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar que el item existe y el usuario tiene acceso
  const existing = await db
    .select({ projectId: recurringItems.projectId })
    .from(recurringItems)
    .innerJoin(projectMembers, eq(recurringItems.projectId, projectMembers.projectId))
    .where(
      and(
        eq(recurringItems.id, itemId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Item no encontrado' };
  }

  const updateData: Record<string, unknown> = {
    ...parsed.data,
    updatedAt: new Date(),
  };

  // Si se actualiza el monto, convertir a string
  if (parsed.data.amount !== undefined) {
    updateData.amount = String(parsed.data.amount);
  }

  await db
    .update(recurringItems)
    .set(updateData)
    .where(eq(recurringItems.id, itemId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/recurring');

  return { success: true, data: undefined };
}

/**
 * Cambia el estado activo de un item recurrente
 */
export async function toggleRecurringItemActive(
  itemId: string,
  userId: string,
  input: ToggleActiveInput
): Promise<ActionResult> {
  const parsed = toggleActiveSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar acceso
  const existing = await db
    .select({ projectId: recurringItems.projectId })
    .from(recurringItems)
    .innerJoin(projectMembers, eq(recurringItems.projectId, projectMembers.projectId))
    .where(
      and(
        eq(recurringItems.id, itemId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Item no encontrado' };
  }

  await db
    .update(recurringItems)
    .set({
      isActive: parsed.data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(recurringItems.id, itemId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/recurring');

  return { success: true, data: undefined };
}

/**
 * Elimina un item recurrente
 */
export async function deleteRecurringItem(
  itemId: string,
  userId: string
): Promise<ActionResult> {
  // Verificar acceso
  const existing = await db
    .select({ projectId: recurringItems.projectId })
    .from(recurringItems)
    .innerJoin(projectMembers, eq(recurringItems.projectId, projectMembers.projectId))
    .where(
      and(
        eq(recurringItems.id, itemId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Item no encontrado' };
  }

  await db.delete(recurringItems).where(eq(recurringItems.id, itemId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/recurring');

  return { success: true, data: undefined };
}

/**
 * Genera transacciones a partir de los items recurrentes activos
 * Esta función se llama al inicio de cada mes o manualmente
 */
export async function generateTransactionsFromRecurring(
  projectId: string,
  userId: string
): Promise<ActionResult<{ count: number }>> {
  // Verificar acceso
  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  // Obtener proyecto para la moneda
  const project = await db
    .select({
      baseCurrencyId: projects.baseCurrencyId,
      currency: projects.currency,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project[0]) {
    return { success: false, error: 'Proyecto no encontrado' };
  }

  // Obtener items recurrentes activos
  const activeItems = await getActiveRecurringItems(projectId, userId);

  if (activeItems.length === 0) {
    return { success: true, data: { count: 0 } };
  }

  const today = new Date();

  // Crear transacciones para cada item
  const transactionsToCreate = activeItems.map((item) => {
    // Usar el día del mes especificado o el día actual
    const transactionDate = new Date(today.getFullYear(), today.getMonth(), item.dayOfMonth ?? today.getDate());

    return {
      userId,
      projectId,
      categoryId: item.categoryId,
      accountId: item.accountId,
      type: item.type,
      description: item.name,
      originalAmount: item.amount,
      originalCurrency: project[0].currency,
      originalCurrencyId: project[0].baseCurrencyId,
      baseAmount: item.amount,
      baseCurrency: project[0].currency,
      baseCurrencyId: project[0].baseCurrencyId,
      exchangeRate: '1',
      date: transactionDate,
      isPaid: false,
      recurringItemId: item.id,
    };
  });

  await db.insert(transactions).values(transactionsToCreate);

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/recurring');

  return { success: true, data: { count: transactionsToCreate.length } };
}
