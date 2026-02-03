'use server';

import { db } from '@/lib/db';
import { transactions, projects, projectMembers, accounts } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import {
  createTransactionSchema,
  updateTransactionSchema,
  togglePaidSchema,
} from '../schemas';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  TogglePaidInput,
} from '../schemas';
import type { ActionResult } from '../types';
import { updateAccountBalance } from '@/features/accounts/actions';

/**
 * Verifica que el usuario tenga acceso al proyecto
 */
export async function verifyProjectAccess(projectId: string, userId: string): Promise<boolean> {
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

  // Obtener la moneda base del proyecto y el tipo de cuenta
  const [project, account] = await Promise.all([
    db
      .select({ currency: projects.currency })
      .from(projects)
      .where(eq(projects.id, parsed.data.projectId))
      .limit(1),
    db
      .select({ type: accounts.type })
      .from(accounts)
      .where(eq(accounts.id, parsed.data.accountId))
      .limit(1),
  ]);

  if (!project[0]) {
    return { success: false, error: 'Proyecto no encontrado' };
  }

  if (!account[0]) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  const amount = typeof parsed.data.originalAmount === 'string'
    ? parsed.data.originalAmount
    : String(parsed.data.originalAmount);

  // Para gastos en tarjeta de crédito, siempre marcar como pagado
  // (afecta el balance de la TC inmediatamente)
  const isCreditCardExpense = account[0].type === 'credit_card' && parsed.data.type === 'expense';
  const isPaid = isCreditCardExpense ? true : (parsed.data.isPaid ?? false);

  const [newTransaction] = await db
    .insert(transactions)
    .values({
      userId,
      projectId: parsed.data.projectId,
      categoryId: parsed.data.categoryId,
      accountId: parsed.data.accountId,
      entityId: parsed.data.entityId ?? null,
      budgetId: parsed.data.budgetId ?? null,
      type: parsed.data.type,
      description: parsed.data.description,
      notes: parsed.data.notes,
      date: parsed.data.date,
      isPaid,
      originalAmount: amount,
      originalCurrency: project[0].currency,
      baseAmount: amount,
      baseCurrency: project[0].currency,
      exchangeRate: '1',
    })
    .returning({ id: transactions.id });

  // Solo actualizar balance si la transacción está marcada como pagada
  if (isPaid) {
    const amountNum = parseFloat(amount);
    const balanceDelta = parsed.data.type === 'income' ? amountNum : -amountNum;
    await updateAccountBalance(parsed.data.accountId, balanceDelta);
  }

  invalidateRelatedCache('transactions');

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
      accountId: transactions.accountId,
      type: transactions.type,
      originalAmount: transactions.originalAmount,
      isPaid: transactions.isPaid,
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

  const oldTransaction = existing[0];

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

  // Update account balances - solo si la transacción está/estaba pagada
  const newAmount = parsed.data.originalAmount ?? parseFloat(oldTransaction.originalAmount);
  const newType = parsed.data.type ?? oldTransaction.type;
  const newAccountId = parsed.data.accountId ?? oldTransaction.accountId;
  const newIsPaid = parsed.data.isPaid ?? oldTransaction.isPaid;
  const oldAmount = parseFloat(oldTransaction.originalAmount);

  // Revertir balance anterior solo si estaba pagada
  if (oldTransaction.isPaid && oldTransaction.accountId) {
    const oldDelta = oldTransaction.type === 'income' ? -oldAmount : oldAmount;
    await updateAccountBalance(oldTransaction.accountId, oldDelta);
  }

  // Aplicar nuevo balance solo si está pagada
  if (newIsPaid && newAccountId) {
    const newDelta = newType === 'income' ? newAmount : -newAmount;
    await updateAccountBalance(newAccountId, newDelta);
  }

  invalidateRelatedCache('transactions');

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

  // Verificar acceso y obtener datos para ajustar balance
  const existing = await db
    .select({
      projectId: transactions.projectId,
      accountId: transactions.accountId,
      type: transactions.type,
      originalAmount: transactions.originalAmount,
      isPaid: transactions.isPaid,
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

  const transaction = existing[0];

  // Solo actualizar si el estado realmente cambia
  if (transaction.isPaid === parsed.data.isPaid) {
    return { success: true, data: undefined };
  }

  await db
    .update(transactions)
    .set({
      isPaid: parsed.data.isPaid,
      paidAt: parsed.data.isPaid ? (parsed.data.paidAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, transactionId));

  // Ajustar balance de la cuenta según el cambio de estado
  if (transaction.accountId) {
    const amount = parseFloat(transaction.originalAmount);
    if (parsed.data.isPaid) {
      // Marcar como pagada: aplicar el delta
      const delta = transaction.type === 'income' ? amount : -amount;
      await updateAccountBalance(transaction.accountId, delta);
    } else {
      // Marcar como no pagada: revertir el delta
      const delta = transaction.type === 'income' ? -amount : amount;
      await updateAccountBalance(transaction.accountId, delta);
    }
  }

  invalidateRelatedCache('transactions');

  return { success: true, data: undefined };
}

/**
 * Elimina una transacción (y su vinculada si es una transferencia)
 */
export async function deleteTransaction(
  transactionId: string,
  userId: string
): Promise<ActionResult> {
  // Verificar acceso y obtener datos para revertir el balance
  const existing = await db
    .select({
      projectId: transactions.projectId,
      accountId: transactions.accountId,
      type: transactions.type,
      originalAmount: transactions.originalAmount,
      isPaid: transactions.isPaid,
      linkedTransactionId: transactions.linkedTransactionId,
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

  const transaction = existing[0];

  // Si tiene transacción vinculada, obtenerla y eliminarla también
  let linkedTransaction: { accountId: string | null; type: string; originalAmount: string; isPaid: boolean } | null = null;
  if (transaction.linkedTransactionId) {
    const linked = await db
      .select({
        accountId: transactions.accountId,
        type: transactions.type,
        originalAmount: transactions.originalAmount,
        isPaid: transactions.isPaid,
      })
      .from(transactions)
      .where(eq(transactions.id, transaction.linkedTransactionId))
      .limit(1);
    linkedTransaction = linked[0] ?? null;

    // Eliminar la transacción vinculada
    if (linkedTransaction) {
      await db.delete(transactions).where(eq(transactions.id, transaction.linkedTransactionId));
    }
  }

  // Eliminar la transacción principal
  await db.delete(transactions).where(eq(transactions.id, transactionId));

  // Revertir balance de la transacción principal
  if (transaction.isPaid && transaction.accountId) {
    const amount = parseFloat(transaction.originalAmount);
    const reverseDelta = transaction.type === 'income' ? -amount : amount;
    await updateAccountBalance(transaction.accountId, reverseDelta);
  }

  // Revertir balance de la transacción vinculada
  if (linkedTransaction?.isPaid && linkedTransaction.accountId) {
    const linkedAmount = parseFloat(linkedTransaction.originalAmount);
    const linkedReverseDelta = linkedTransaction.type === 'income' ? -linkedAmount : linkedAmount;
    await updateAccountBalance(linkedTransaction.accountId, linkedReverseDelta);
  }

  invalidateRelatedCache('transactions');

  return { success: true, data: undefined };
}
