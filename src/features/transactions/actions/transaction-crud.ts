'use server';

import { db } from '@/lib/db';
import { transactions, projects, projectMembers, accounts } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import { inArray } from 'drizzle-orm';
import {
  createTransactionSchema,
  updateTransactionSchema,
  togglePaidSchema,
  bulkTogglePaidSchema,
  bulkUpdateDateSchema,
} from '../schemas';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  TogglePaidInput,
  BulkTogglePaidInput,
  BulkUpdateDateInput,
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

  // Obtener la moneda base del proyecto y el tipo/saldo de cuenta
  const [project, account] = await Promise.all([
    db
      .select({ currency: projects.currency })
      .from(projects)
      .where(eq(projects.id, parsed.data.projectId))
      .limit(1),
    db
      .select({ type: accounts.type, currentBalance: accounts.currentBalance })
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

  const isPaid = parsed.data.isPaid ?? false;

  const [newTransaction] = await db
    .insert(transactions)
    .values({
      userId,
      projectId: parsed.data.projectId,
      categoryId: parsed.data.categoryId || null,
      accountId: parsed.data.accountId,
      entityId: parsed.data.entityId ?? null,
      budgetId: parsed.data.budgetId ?? null,
      savingsGoalId: parsed.data.savingsGoalId ?? null,
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

  // Modo previsional: crear ajuste de rentabilidad automático
  const isProvisionAccount = account[0].type === 'pension' || account[0].type === 'unemployment';
  const providerBalance = parsed.data.providerBalance;

  if (isProvisionAccount && providerBalance != null && isPaid) {
    const currentBalance = parseFloat(account[0].currentBalance);
    const amountNum = parseFloat(amount);
    const balanceAfterContribution = currentBalance + (parsed.data.type === 'income' ? amountNum : -amountNum);
    const adjustmentAmount = providerBalance - balanceAfterContribution;

    // Crear transacción de ajuste si hay diferencia significativa
    if (Math.abs(adjustmentAmount) >= 1 && parsed.data.profitabilityCategoryId) {
      const isGain = adjustmentAmount > 0;
      const typeLabel = account[0].type === 'pension' ? 'AFP' : 'Cesantía';
      await db
        .insert(transactions)
        .values({
          userId,
          projectId: parsed.data.projectId,
          accountId: parsed.data.accountId,
          categoryId: parsed.data.profitabilityCategoryId,
          type: isGain ? 'income' : 'expense',
          originalAmount: String(Math.abs(adjustmentAmount)),
          originalCurrency: project[0].currency,
          baseAmount: String(Math.abs(adjustmentAmount)),
          baseCurrency: project[0].currency,
          exchangeRate: '1',
          date: parsed.data.date,
          description: `Rentabilidad ${typeLabel}`,
          isPaid: true,
          paidAt: parsed.data.date,
        });
    }

    // Actualizar saldo directo al saldo del proveedor
    await db
      .update(accounts)
      .set({
        currentBalance: String(providerBalance),
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, parsed.data.accountId));

    invalidateRelatedCache('accounts');
  } else if (isPaid) {
    // Flujo normal: solo actualizar balance si la transacción está pagada
    const amountNum = parseFloat(amount);
    const balanceDelta = parsed.data.type === 'income' ? amountNum : -amountNum;
    await updateAccountBalance(parsed.data.accountId, balanceDelta);
  }

  invalidateRelatedCache('transactions');
  if (parsed.data.savingsGoalId) {
    invalidateRelatedCache('savings');
  }

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
  invalidateRelatedCache('savings');

  return { success: true, data: undefined };
}

/**
 * Marca/desmarca múltiples transacciones como pagadas en lote
 */
export async function bulkToggleTransactionsPaid(
  userId: string,
  input: BulkTogglePaidInput
): Promise<ActionResult<{ updatedCount: number }>> {
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
