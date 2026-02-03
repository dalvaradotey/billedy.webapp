'use server';

import { db } from '@/lib/db';
import { transactions, projects, projectMembers, accounts, categories } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import {
  createAccountTransferSchema,
  updateAccountTransferSchema,
} from '../schemas';
import type {
  CreateAccountTransferInput,
  UpdateAccountTransferInput,
} from '../schemas';
import type { ActionResult } from '../types';
import { updateAccountBalance } from '@/features/accounts/actions';
import { verifyProjectAccess } from './transaction-crud';

/**
 * Crea una transferencia entre cuentas (genera 2 transacciones vinculadas)
 */
export async function createAccountTransfer(
  userId: string,
  input: CreateAccountTransferInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = createAccountTransferSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar acceso al proyecto
  const hasAccess = await verifyProjectAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  // Obtener la moneda del proyecto
  const project = await db
    .select({
      currency: projects.currency,
    })
    .from(projects)
    .where(eq(projects.id, parsed.data.projectId))
    .limit(1);

  if (!project[0]) {
    return { success: false, error: 'Proyecto no encontrado' };
  }

  // Buscar o crear categoría de transferencias (por nombre)
  const transferCategory = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.projectId, parsed.data.projectId),
        eq(categories.name, 'Transferencias')
      )
    )
    .limit(1);

  let transferCategoryId: string;
  if (!transferCategory[0]) {
    // Crear categoría de transferencias automáticamente
    const [newCategory] = await db
      .insert(categories)
      .values({
        projectId: parsed.data.projectId,
        name: 'Transferencias',
        color: '#6B7280', // Gray color
      })
      .returning({ id: categories.id });
    transferCategoryId = newCategory.id;
  } else {
    transferCategoryId = transferCategory[0].id;
  }

  // Obtener nombres y entityId de las cuentas
  const [fromAccount, toAccount] = await Promise.all([
    db.select({ name: accounts.name, entityId: accounts.entityId }).from(accounts).where(eq(accounts.id, parsed.data.fromAccountId)).limit(1),
    db.select({ name: accounts.name, entityId: accounts.entityId }).from(accounts).where(eq(accounts.id, parsed.data.toAccountId)).limit(1),
  ]);

  if (!fromAccount[0] || !toAccount[0]) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  const amount = String(parsed.data.amount);
  const description = parsed.data.description || 'Transferencia entre cuentas';

  // Crear transacción de salida (expense en cuenta origen)
  // Usa el entityId de la cuenta origen
  const [outTransaction] = await db
    .insert(transactions)
    .values({
      userId,
      projectId: parsed.data.projectId,
      categoryId: transferCategoryId,
      accountId: parsed.data.fromAccountId,
      entityId: fromAccount[0].entityId,
      type: 'expense',
      description: `${description} → ${toAccount[0].name}`,
      notes: parsed.data.notes,
      date: parsed.data.date,
      isPaid: true,
      originalAmount: amount,
      originalCurrency: project[0].currency,
      baseAmount: amount,
      baseCurrency: project[0].currency,
      exchangeRate: '1',
    })
    .returning({ id: transactions.id });

  // Crear transacción de entrada (income en cuenta destino)
  // Usa el entityId de la cuenta destino
  const [inTransaction] = await db
    .insert(transactions)
    .values({
      userId,
      projectId: parsed.data.projectId,
      categoryId: transferCategoryId,
      accountId: parsed.data.toAccountId,
      entityId: toAccount[0].entityId,
      type: 'income',
      description: `${description} ← ${fromAccount[0].name}`,
      notes: parsed.data.notes,
      date: parsed.data.date,
      isPaid: true,
      originalAmount: amount,
      originalCurrency: project[0].currency,
      baseAmount: amount,
      baseCurrency: project[0].currency,
      exchangeRate: '1',
      linkedTransactionId: outTransaction.id,
    })
    .returning({ id: transactions.id });

  // Actualizar la transacción de salida con el linkedTransactionId
  await db
    .update(transactions)
    .set({ linkedTransactionId: inTransaction.id })
    .where(eq(transactions.id, outTransaction.id));

  // Actualizar balances (restar de origen, sumar a destino)
  const amountNum = parseFloat(amount);
  await updateAccountBalance(parsed.data.fromAccountId, -amountNum);
  await updateAccountBalance(parsed.data.toAccountId, amountNum);

  invalidateRelatedCache('transactions');

  return { success: true, data: { id: outTransaction.id } };
}

/**
 * Actualiza una transferencia entre cuentas (actualiza ambas transacciones vinculadas)
 */
export async function updateAccountTransfer(
  transactionId: string,
  userId: string,
  input: UpdateAccountTransferInput
): Promise<ActionResult> {
  const parsed = updateAccountTransferSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Obtener la transacción y su vinculada (identificada por linkedTransactionId)
  const existing = await db
    .select({
      id: transactions.id,
      projectId: transactions.projectId,
      accountId: transactions.accountId,
      originalAmount: transactions.originalAmount,
      linkedTransactionId: transactions.linkedTransactionId,
      description: transactions.description,
      type: transactions.type,
    })
    .from(transactions)
    .innerJoin(projectMembers, eq(transactions.projectId, projectMembers.projectId))
    .where(
      and(
        eq(transactions.id, transactionId),
        isNotNull(transactions.linkedTransactionId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Transferencia no encontrada' };
  }

  const transaction = existing[0];
  const oldAmount = parseFloat(transaction.originalAmount);

  // Obtener la transacción vinculada
  let linkedTransaction = null;
  if (transaction.linkedTransactionId) {
    const linked = await db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        description: transactions.description,
      })
      .from(transactions)
      .where(eq(transactions.id, transaction.linkedTransactionId))
      .limit(1);
    linkedTransaction = linked[0] ?? null;
  }

  // Revertir balances anteriores según el tipo de transacción
  if (transaction.accountId) {
    // Si era expense, revertimos sumando. Si era income, revertimos restando.
    const revertDelta = transaction.type === 'expense' ? oldAmount : -oldAmount;
    await updateAccountBalance(transaction.accountId, revertDelta);
  }
  if (linkedTransaction?.accountId) {
    // La transacción vinculada tiene el tipo opuesto
    const linkedRevertDelta = transaction.type === 'expense' ? -oldAmount : oldAmount;
    await updateAccountBalance(linkedTransaction.accountId, linkedRevertDelta);
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (parsed.data.date !== undefined) updateData.date = parsed.data.date;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

  let newAmount = oldAmount;
  if (parsed.data.amount !== undefined) {
    const amount = String(parsed.data.amount);
    updateData.originalAmount = amount;
    updateData.baseAmount = amount;
    newAmount = parsed.data.amount;
  }

  // Actualizar descripciones si se proporciona
  if (parsed.data.description !== undefined) {
    // Extraer el nombre de la cuenta del destino de la descripción actual
    const toAccountName = transaction.description.split(' → ')[1] ?? '';
    const fromAccountName = linkedTransaction?.description.split(' ← ')[1] ?? '';

    await db
      .update(transactions)
      .set({
        ...updateData,
        description: `${parsed.data.description} → ${toAccountName}`
      })
      .where(eq(transactions.id, transactionId));

    if (linkedTransaction) {
      await db
        .update(transactions)
        .set({
          ...updateData,
          description: `${parsed.data.description} ← ${fromAccountName}`
        })
        .where(eq(transactions.id, linkedTransaction.id));
    }
  } else {
    // Actualizar ambas transacciones
    await db
      .update(transactions)
      .set(updateData)
      .where(eq(transactions.id, transactionId));

    if (linkedTransaction) {
      await db
        .update(transactions)
        .set(updateData)
        .where(eq(transactions.id, linkedTransaction.id));
    }
  }

  // Aplicar nuevos balances según el tipo de transacción
  if (transaction.accountId) {
    const newDelta = transaction.type === 'expense' ? -newAmount : newAmount;
    await updateAccountBalance(transaction.accountId, newDelta);
  }
  if (linkedTransaction?.accountId) {
    // La transacción vinculada tiene el tipo opuesto
    const linkedNewDelta = transaction.type === 'expense' ? newAmount : -newAmount;
    await updateAccountBalance(linkedTransaction.accountId, linkedNewDelta);
  }

  invalidateRelatedCache('transactions');

  return { success: true, data: undefined };
}

/**
 * Elimina una transferencia entre cuentas (elimina ambas transacciones vinculadas)
 */
export async function deleteAccountTransfer(
  transactionId: string,
  userId: string
): Promise<ActionResult> {
  // Obtener la transacción y su vinculada (identificada por linkedTransactionId)
  const existing = await db
    .select({
      id: transactions.id,
      projectId: transactions.projectId,
      accountId: transactions.accountId,
      originalAmount: transactions.originalAmount,
      linkedTransactionId: transactions.linkedTransactionId,
      type: transactions.type,
    })
    .from(transactions)
    .innerJoin(projectMembers, eq(transactions.projectId, projectMembers.projectId))
    .where(
      and(
        eq(transactions.id, transactionId),
        isNotNull(transactions.linkedTransactionId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Transferencia no encontrada' };
  }

  const transaction = existing[0];
  const amount = parseFloat(transaction.originalAmount);

  // Obtener la transacción vinculada
  let linkedAccountId: string | null = null;
  if (transaction.linkedTransactionId) {
    const linked = await db
      .select({ accountId: transactions.accountId })
      .from(transactions)
      .where(eq(transactions.id, transaction.linkedTransactionId))
      .limit(1);
    linkedAccountId = linked[0]?.accountId ?? null;
  }

  // Eliminar ambas transacciones
  await db.delete(transactions).where(eq(transactions.id, transactionId));
  if (transaction.linkedTransactionId) {
    await db.delete(transactions).where(eq(transactions.id, transaction.linkedTransactionId));
  }

  // Revertir balances según el tipo de transacción
  if (transaction.accountId) {
    // Si era expense, revertimos sumando. Si era income, revertimos restando.
    const revertDelta = transaction.type === 'expense' ? amount : -amount;
    await updateAccountBalance(transaction.accountId, revertDelta);
  }
  if (linkedAccountId) {
    // La transacción vinculada tiene el tipo opuesto
    const linkedRevertDelta = transaction.type === 'expense' ? -amount : amount;
    await updateAccountBalance(linkedAccountId, linkedRevertDelta);
  }

  invalidateRelatedCache('transactions');

  return { success: true, data: undefined };
}
