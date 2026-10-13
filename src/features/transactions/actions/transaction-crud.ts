'use server';

import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { transactions, projectMembers } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import { inArray } from 'drizzle-orm';
import {
  updateTransactionSchema,
  togglePaidSchema,
  toggleReconciledSchema,
  bulkTogglePaidSchema,
  bulkToggleReconciledSchema,
  bulkUpdateDateSchema,
} from '../schemas';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  TogglePaidInput,
  ToggleReconciledInput,
  BulkTogglePaidInput,
  BulkToggleReconciledInput,
  BulkUpdateDateInput,
} from '../schemas';
import type { ActionResult } from '../types';
import { updateAccountBalance } from '@/features/accounts/lib/balance';
import { verifyProjectAccess } from '../lib/access';
import { normalizeNature } from '../nature';
import { validateFundPayment } from '../lib/fund-validation';
import { insertTransaction, removeTransaction } from '../lib/write-transaction';

/**
 * Crea una nueva transacción
 */
export async function createTransaction(
  userId: string,
  input: CreateTransactionInput
): Promise<ActionResult<{ id: string }>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }
  return insertTransaction(userId, input, invalidateRelatedCache);
}

/**
 * Actualiza una transacción existente
 */
export async function updateTransaction(
  transactionId: string,
  userId: string,
  input: UpdateTransactionInput
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

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
      nature: transactions.nature,
      accountFundId: transactions.accountFundId,
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

  // La naturaleza debe ser coherente con el tipo (si cambia el tipo, puede dejar de aplicar)
  if (parsed.data.nature !== undefined || parsed.data.type !== undefined) {
    updateData.nature = normalizeNature(
      parsed.data.nature ?? oldTransaction.nature,
      parsed.data.type ?? oldTransaction.type
    );
  }

  // Pago con fondo: coherente con el tipo, la cuenta y el saldo del fondo
  {
    const finalType = parsed.data.type ?? oldTransaction.type;
    const finalAccountId = parsed.data.accountId ?? oldTransaction.accountId;
    const finalFundId =
      finalType === 'expense'
        ? parsed.data.accountFundId !== undefined
          ? parsed.data.accountFundId
          : oldTransaction.accountFundId
        : null;
    if (finalFundId && finalAccountId) {
      const fundError = await validateFundPayment({
        projectId: oldTransaction.projectId,
        accountId: finalAccountId,
        fundId: finalFundId,
        amount: parsed.data.originalAmount ?? parseFloat(oldTransaction.originalAmount),
        previous: { fundId: oldTransaction.accountFundId, amount: parseFloat(oldTransaction.originalAmount) },
      });
      if (fundError) return { success: false, error: fundError };
    }
    updateData.accountFundId = finalFundId;
  }

  // Convertir categoryId vacío a null
  if ('categoryId' in updateData) {
    updateData.categoryId = updateData.categoryId || null;
  }

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
  invalidateRelatedCache('savings');

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
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

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
 * Marca/desmarca una transacción como conciliada
 */
export async function toggleTransactionReconciled(
  transactionId: string,
  userId: string,
  input: ToggleReconciledInput
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = toggleReconciledSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  const existing = await db
    .select({
      projectId: transactions.projectId,
      isReconciled: transactions.isReconciled,
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

  if (existing[0].isReconciled === parsed.data.isReconciled) {
    return { success: true, data: undefined };
  }

  await db
    .update(transactions)
    .set({
      isReconciled: parsed.data.isReconciled,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, transactionId));

  invalidateRelatedCache('transactions');

  return { success: true, data: undefined };
}

/**
 * Marca/desmarca transacciones como conciliadas en lote
 */
export async function bulkToggleTransactionsReconciled(
  userId: string,
  input: BulkToggleReconciledInput
): Promise<ActionResult<{ updatedCount: number }>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = bulkToggleReconciledSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  const hasAccess = await verifyProjectAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  const selectedTransactions = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.projectId, parsed.data.projectId),
        inArray(transactions.id, parsed.data.transactionIds)
      )
    );

  if (selectedTransactions.length === 0) {
    return { success: false, error: 'No se encontraron transacciones válidas' };
  }

  await db
    .update(transactions)
    .set({
      isReconciled: parsed.data.isReconciled,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(transactions.projectId, parsed.data.projectId),
        inArray(transactions.id, parsed.data.transactionIds)
      )
    );

  invalidateRelatedCache('transactions');

  return {
    success: true,
    data: { updatedCount: selectedTransactions.length },
  };
}

/**
 * Elimina una transacción (y su vinculada si es una transferencia)
 */
export async function deleteTransaction(
  transactionId: string,
  userId: string
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }
  return removeTransaction(transactionId, userId, invalidateRelatedCache);
}

/**
 * Marca/desmarca múltiples transacciones como pagadas en lote
 */
export async function bulkToggleTransactionsPaid(
  userId: string,
  input: BulkTogglePaidInput
): Promise<ActionResult<{ updatedCount: number }>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = bulkTogglePaidSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  const hasAccess = await verifyProjectAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  // Obtener transacciones que realmente necesitan cambio
  const selected = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      type: transactions.type,
      originalAmount: transactions.originalAmount,
      isPaid: transactions.isPaid,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.projectId, parsed.data.projectId),
        inArray(transactions.id, parsed.data.transactionIds)
      )
    );

  // Filtrar solo las que necesitan cambio
  const toUpdate = selected.filter(t => t.isPaid !== parsed.data.isPaid);

  if (toUpdate.length === 0) {
    return { success: true, data: { updatedCount: 0 } };
  }

  const now = new Date();
  const idsToUpdate = toUpdate.map(t => t.id);

  // Actualizar en batch
  await db
    .update(transactions)
    .set({
      isPaid: parsed.data.isPaid,
      paidAt: parsed.data.isPaid ? now : null,
      updatedAt: now,
    })
    .where(
      and(
        eq(transactions.projectId, parsed.data.projectId),
        inArray(transactions.id, idsToUpdate)
      )
    );

  // Agrupar deltas por accountId para minimizar llamadas
  const deltasByAccount = new Map<string, number>();
  for (const t of toUpdate) {
    if (!t.accountId) continue;
    const amount = parseFloat(t.originalAmount);
    let delta: number;
    if (parsed.data.isPaid) {
      delta = t.type === 'income' ? amount : -amount;
    } else {
      delta = t.type === 'income' ? -amount : amount;
    }
    deltasByAccount.set(t.accountId, (deltasByAccount.get(t.accountId) ?? 0) + delta);
  }

  // Aplicar ajustes de balance por cuenta
  await Promise.all(
    Array.from(deltasByAccount.entries()).map(([accountId, delta]) =>
      updateAccountBalance(accountId, delta)
    )
  );

  invalidateRelatedCache('transactions');

  return { success: true, data: { updatedCount: toUpdate.length } };
}

/**
 * Cambia la fecha de múltiples transacciones en lote
 */
export async function bulkUpdateTransactionDates(
  userId: string,
  input: BulkUpdateDateInput
): Promise<ActionResult<{ updatedCount: number }>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = bulkUpdateDateSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  const hasAccess = await verifyProjectAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  const selected = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.projectId, parsed.data.projectId),
        inArray(transactions.id, parsed.data.transactionIds)
      )
    );

  if (selected.length === 0) {
    return { success: false, error: 'No se encontraron transacciones válidas' };
  }

  const now = new Date();

  await db
    .update(transactions)
    .set({
      date: parsed.data.date,
      updatedAt: now,
    })
    .where(
      and(
        eq(transactions.projectId, parsed.data.projectId),
        inArray(transactions.id, parsed.data.transactionIds)
      )
    );

  invalidateRelatedCache('transactions');

  return { success: true, data: { updatedCount: selected.length } };
}
