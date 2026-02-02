'use server';

import { db } from '@/lib/db';
import { transactions, projects, projectMembers, accounts, categories, cardPurchases } from '@/lib/db/schema';
import { eq, and, isNotNull, sql, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  createTransactionSchema,
  updateTransactionSchema,
  togglePaidSchema,
  createAccountTransferSchema,
  updateAccountTransferSchema,
  payCreditCardSchema,
  setHistoricallyPaidSchema,
} from './schemas';
import { getUnpaidCreditCardTransactions } from './queries';
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  TogglePaidInput,
  CreateAccountTransferInput,
  UpdateAccountTransferInput,
  PayCreditCardInput,
  SetHistoricallyPaidInput,
} from './schemas';
import { updateAccountBalance } from '@/features/accounts/actions';

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

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/accounts');

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

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/accounts');

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

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/accounts');

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

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/accounts');

  return { success: true, data: undefined };
}

// ============================================================================
// TRANSFERENCIAS ENTRE CUENTAS
// ============================================================================

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

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/accounts');

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

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/accounts');

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

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/accounts');

  return { success: true, data: undefined };
}

// ============================================================================
// PAGO DE TARJETA DE CRÉDITO
// ============================================================================

/**
 * Paga múltiples transacciones de tarjeta de crédito mediante una transferencia
 * desde una cuenta bancaria a la tarjeta de crédito.
 *
 * - Calcula el total de las transacciones seleccionadas
 * - Crea una transferencia desde la cuenta origen a la TC
 * - Actualiza las transacciones seleccionadas con paidByTransferId
 * - Opcionalmente registra intereses/cargos como gasto en la cuenta origen
 */
export async function payCreditCardTransactions(
  userId: string,
  input: PayCreditCardInput
): Promise<ActionResult<{ transferId: string; totalPaid: number; interestPaid?: number }>> {
  const parsed = payCreditCardSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar acceso al proyecto
  const hasAccess = await verifyProjectAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  // Verificar que la cuenta origen no es la tarjeta de crédito
  if (parsed.data.sourceAccountId === parsed.data.creditCardAccountId) {
    return { success: false, error: 'La cuenta origen y la tarjeta de crédito deben ser diferentes' };
  }

  // Verificar que la cuenta destino es una tarjeta de crédito
  const creditCardAccount = await db
    .select({ id: accounts.id, type: accounts.type, name: accounts.name, entityId: accounts.entityId })
    .from(accounts)
    .where(eq(accounts.id, parsed.data.creditCardAccountId))
    .limit(1);

  if (!creditCardAccount[0]) {
    return { success: false, error: 'Tarjeta de crédito no encontrada' };
  }

  if (creditCardAccount[0].type !== 'credit_card') {
    return { success: false, error: 'La cuenta destino debe ser una tarjeta de crédito' };
  }

  // Obtener la cuenta origen
  const sourceAccount = await db
    .select({ id: accounts.id, name: accounts.name, entityId: accounts.entityId })
    .from(accounts)
    .where(eq(accounts.id, parsed.data.sourceAccountId))
    .limit(1);

  if (!sourceAccount[0]) {
    return { success: false, error: 'Cuenta origen no encontrada' };
  }

  // Obtener las transacciones seleccionadas y verificar que pertenecen a la TC
  const selectedTransactions = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      baseAmount: transactions.baseAmount,
      paidByTransferId: transactions.paidByTransferId,
      cardPurchaseId: transactions.cardPurchaseId,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.projectId, parsed.data.projectId),
        eq(transactions.accountId, parsed.data.creditCardAccountId)
      )
    );

  // Filtrar solo las transacciones que están en el array de IDs
  const transactionsToUpdate = selectedTransactions.filter(
    (t) => parsed.data.transactionIds.includes(t.id)
  );

  if (transactionsToUpdate.length === 0) {
    return { success: false, error: 'No se encontraron transacciones válidas para pagar' };
  }

  // Verificar que ninguna ya esté pagada
  const alreadyPaid = transactionsToUpdate.filter((t) => t.paidByTransferId !== null);
  if (alreadyPaid.length > 0) {
    return { success: false, error: `${alreadyPaid.length} transacción(es) ya están pagadas` };
  }

  // Calcular el total
  const totalAmount = transactionsToUpdate.reduce(
    (sum, t) => sum + parseFloat(t.baseAmount),
    0
  );

  // Obtener la moneda del proyecto
  const project = await db
    .select({ currency: projects.currency })
    .from(projects)
    .where(eq(projects.id, parsed.data.projectId))
    .limit(1);

  if (!project[0]) {
    return { success: false, error: 'Proyecto no encontrado' };
  }

  // Buscar o crear categoría de transferencias
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
    const [newCategory] = await db
      .insert(categories)
      .values({
        projectId: parsed.data.projectId,
        name: 'Transferencias',
        color: '#6B7280',
      })
      .returning({ id: categories.id });
    transferCategoryId = newCategory.id;
  } else {
    transferCategoryId = transferCategory[0].id;
  }

  const amount = String(totalAmount.toFixed(2));
  const description = parsed.data.description || 'Pago de tarjeta de crédito';

  // Crear transacción de salida (expense en cuenta origen)
  const [outTransaction] = await db
    .insert(transactions)
    .values({
      userId,
      projectId: parsed.data.projectId,
      categoryId: transferCategoryId,
      accountId: parsed.data.sourceAccountId,
      entityId: sourceAccount[0].entityId,
      type: 'expense',
      description: `${description} → ${creditCardAccount[0].name}`,
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

  // Crear transacción de entrada (income en tarjeta de crédito)
  const [inTransaction] = await db
    .insert(transactions)
    .values({
      userId,
      projectId: parsed.data.projectId,
      categoryId: transferCategoryId,
      accountId: parsed.data.creditCardAccountId,
      entityId: creditCardAccount[0].entityId,
      type: 'income',
      description: `${description} ← ${sourceAccount[0].name}`,
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

  // Vincular las transacciones de la transferencia
  await db
    .update(transactions)
    .set({ linkedTransactionId: inTransaction.id })
    .where(eq(transactions.id, outTransaction.id));

  // Actualizar balances de la transferencia
  const amountNum = parseFloat(amount);
  await updateAccountBalance(parsed.data.sourceAccountId, -amountNum);
  await updateAccountBalance(parsed.data.creditCardAccountId, amountNum);

  // Registrar intereses/cargos si existen (como gasto en cuenta origen)
  let interestPaid = 0;
  if (parsed.data.interestAmount && parsed.data.interestAmount > 0) {
    interestPaid = parsed.data.interestAmount;

    // Obtener o crear categoría de intereses
    let interestCategoryId = parsed.data.interestCategoryId;
    if (!interestCategoryId) {
      const interestCategory = await db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.projectId, parsed.data.projectId),
            eq(categories.name, 'Intereses y Cargos TC')
          )
        )
        .limit(1);

      if (!interestCategory[0]) {
        const [newCategory] = await db
          .insert(categories)
          .values({
            projectId: parsed.data.projectId,
            name: 'Intereses y Cargos TC',
            color: '#DC2626', // Red color
          })
          .returning({ id: categories.id });
        interestCategoryId = newCategory.id;
      } else {
        interestCategoryId = interestCategory[0].id;
      }
    }

    const interestAmountStr = String(interestPaid.toFixed(2));
    const interestDescription = parsed.data.interestDescription || `Intereses/Cargos ${creditCardAccount[0].name}`;

    // Crear transacción de intereses como gasto en la cuenta origen
    await db
      .insert(transactions)
      .values({
        userId,
        projectId: parsed.data.projectId,
        categoryId: interestCategoryId,
        accountId: parsed.data.sourceAccountId,
        entityId: sourceAccount[0].entityId,
        type: 'expense',
        description: interestDescription,
        notes: parsed.data.notes,
        date: parsed.data.date,
        isPaid: true,
        originalAmount: interestAmountStr,
        originalCurrency: project[0].currency,
        baseAmount: interestAmountStr,
        baseCurrency: project[0].currency,
        exchangeRate: '1',
      });

    // Actualizar balance de la cuenta origen por los intereses
    await updateAccountBalance(parsed.data.sourceAccountId, -interestPaid);
  }

  // Actualizar las transacciones seleccionadas con paidByTransferId
  const now = new Date();
  for (const t of transactionsToUpdate) {
    await db
      .update(transactions)
      .set({
        paidByTransferId: outTransaction.id,
        paidAt: now,
        updatedAt: now,
      })
      .where(eq(transactions.id, t.id));
  }

  // Verificar si alguna compra en cuotas quedó completamente pagada
  const cardPurchaseIds = [...new Set(
    transactionsToUpdate
      .filter((t) => t.cardPurchaseId !== null)
      .map((t) => t.cardPurchaseId as string)
  )];

  for (const purchaseId of cardPurchaseIds) {
    // Contar cuotas totales y pagadas de esta compra
    const [result] = await db
      .select({
        totalInstallments: cardPurchases.installments,
        paidInstallments: sql<number>`(
          SELECT COUNT(*) FROM ${transactions}
          WHERE ${transactions.cardPurchaseId} = ${purchaseId}
          AND ${transactions.paidByTransferId} IS NOT NULL
        )`,
      })
      .from(cardPurchases)
      .where(eq(cardPurchases.id, purchaseId))
      .limit(1);

    // Si todas las cuotas están pagadas, desactivar la compra
    if (result && Number(result.paidInstallments) >= result.totalInstallments) {
      await db
        .update(cardPurchases)
        .set({
          isActive: false,
          updatedAt: now,
        })
        .where(eq(cardPurchases.id, purchaseId));
    }
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/accounts');
  revalidatePath('/dashboard/card-purchases');

  return {
    success: true,
    data: { transferId: outTransaction.id, totalPaid: totalAmount, interestPaid },
  };
}

/**
 * Obtiene transacciones pendientes de pago de una tarjeta de crédito (server action)
 */
export async function fetchUnpaidCCTransactions(
  accountId: string,
  projectId: string,
  userId: string
) {
  return getUnpaidCreditCardTransactions(accountId, projectId, userId);
}

/**
 * Marca o desmarca transacciones como históricamente pagadas
 * Útil para registrar cuotas que ya estaban pagadas antes de usar la app
 */
export async function setTransactionsHistoricallyPaid(
  userId: string,
  input: SetHistoricallyPaidInput
): Promise<ActionResult<{ updatedCount: number }>> {
  const parsed = setHistoricallyPaidSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar acceso al proyecto
  const hasAccess = await verifyProjectAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  // Obtener las transacciones seleccionadas y verificar que pertenecen al proyecto
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

  // Actualizar las transacciones
  const now = new Date();
  await db
    .update(transactions)
    .set({
      isHistoricallyPaid: parsed.data.isHistoricallyPaid,
      updatedAt: now,
    })
    .where(
      and(
        eq(transactions.projectId, parsed.data.projectId),
        inArray(transactions.id, parsed.data.transactionIds)
      )
    );

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/card-purchases');

  return {
    success: true,
    data: { updatedCount: selectedTransactions.length },
  };
}
