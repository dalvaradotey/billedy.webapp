'use server';

import { db } from '@/lib/db';
import { transactions, projects, projectMembers, accounts, categories, cardPurchases } from '@/lib/db/schema';
import { eq, and, isNotNull, sql, inArray } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import {
  payCreditCardSchema,
  setHistoricallyPaidSchema,
} from '../schemas';
import type {
  PayCreditCardInput,
  SetHistoricallyPaidInput,
} from '../schemas';
import type { ActionResult } from '../types';
import { updateAccountBalance } from '@/features/accounts/actions';
import { getUnpaidCreditCardTransactions } from '../queries';
import { verifyProjectAccess } from './transaction-crud';

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

  invalidateRelatedCache('transactions');
  invalidateRelatedCache('cardPurchases');

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

  invalidateRelatedCache('transactions');
  invalidateRelatedCache('cardPurchases');

  return {
    success: true,
    data: { updatedCount: selectedTransactions.length },
  };
}
