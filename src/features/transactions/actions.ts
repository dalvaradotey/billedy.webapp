'use server';

import { db } from '@/lib/db';
import { transactions, currencies, projects, projectMembers } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createTransactionSchema, updateTransactionSchema, togglePaidSchema } from './schemas';
import type { CreateTransactionInput, UpdateTransactionInput, TogglePaidInput } from './schemas';

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
 * Crea una nueva transacción
 */
export async function createTransaction(
  userId: string,
  input: CreateTransactionInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = createTransactionSchema.safeParse(input);

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
      currency: projects.currency,
    })
    .from(projects)
    .where(eq(projects.id, parsed.data.projectId))
    .limit(1);

  if (!project[0]) {
    return { success: false, error: 'Proyecto no encontrado' };
  }

  const amount = typeof parsed.data.originalAmount === 'string'
    ? parsed.data.originalAmount
    : String(parsed.data.originalAmount);

  const [newTransaction] = await db
    .insert(transactions)
    .values({
      userId,
      projectId: parsed.data.projectId,
      categoryId: parsed.data.categoryId,
      accountId: parsed.data.accountId,
      type: parsed.data.type,
      description: parsed.data.description,
      notes: parsed.data.notes,
      date: parsed.data.date,
      isPaid: parsed.data.isPaid ?? false,
      originalAmount: amount,
      originalCurrency: project[0].currency,
      originalCurrencyId: project[0].baseCurrencyId,
      baseAmount: amount,
      baseCurrency: project[0].currency,
      baseCurrencyId: project[0].baseCurrencyId,
      exchangeRate: '1',
    })
    .returning({ id: transactions.id });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');

  return { success: true, data: { id: newTransaction.id } };
}

/**
 * Actualiza una transacción existente
 */
export async function updateTransaction(
  transactionId: string,
  userId: string,
  input: UpdateTransactionInput
): Promise<ActionResult> {
  const parsed = updateTransactionSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar que la transacción existe y el usuario tiene acceso
  const existing = await db
    .select({
      projectId: transactions.projectId,
    })
    .from(transactions)
    .innerJoin(projectMembers, eq(transactions.projectId, projectMembers.projectId))
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Transacción no encontrada' };
  }

  const updateData: Record<string, unknown> = {
    ...parsed.data,
    updatedAt: new Date(),
  };

  // Si se actualiza el monto, convertir a string
  if (parsed.data.originalAmount !== undefined) {
    const amount = typeof parsed.data.originalAmount === 'string'
      ? parsed.data.originalAmount
      : String(parsed.data.originalAmount);
    updateData.originalAmount = amount;
    updateData.baseAmount = amount;
  }

  await db
    .update(transactions)
    .set(updateData)
    .where(eq(transactions.id, transactionId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');

  return { success: true, data: undefined };
}

/**
 * Cambia el estado de pago de una transacción
 */
export async function toggleTransactionPaid(
  transactionId: string,
  userId: string,
  input: TogglePaidInput
): Promise<ActionResult> {
  const parsed = togglePaidSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar acceso
  const existing = await db
    .select({ projectId: transactions.projectId })
    .from(transactions)
    .innerJoin(projectMembers, eq(transactions.projectId, projectMembers.projectId))
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Transacción no encontrada' };
  }

  await db
    .update(transactions)
    .set({
      isPaid: parsed.data.isPaid,
      paidAt: parsed.data.isPaid ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, transactionId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');

  return { success: true, data: undefined };
}

/**
 * Elimina una transacción
 */
export async function deleteTransaction(
  transactionId: string,
  userId: string
): Promise<ActionResult> {
  // Verificar acceso
  const existing = await db
    .select({ projectId: transactions.projectId })
    .from(transactions)
    .innerJoin(projectMembers, eq(transactions.projectId, projectMembers.projectId))
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Transacción no encontrada' };
  }

  await db.delete(transactions).where(eq(transactions.id, transactionId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');

  return { success: true, data: undefined };
}
