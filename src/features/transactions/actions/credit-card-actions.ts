'use server';

import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { transactions, projects, accounts, categories, cardPurchases } from '@/lib/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import {
  payCreditCardSchema,
  setHistoricallyPaidSchema,
} from '../schemas';
import type {
  PayCreditCardInput,
  SetHistoricallyPaidInput,
} from '../schemas';
import type { ActionResult } from '@/types/action-result';
import { updateAccountBalance, type DbExecutor } from '@/features/accounts/lib/balance';
import { getUnpaidCreditCardTransactions } from '../queries';
import { NO_PROJECT_ACCESS, projectRefsError, verifyProjectWriteAccess } from '@/lib/auth/project-access';

/** Busca una categoría del proyecto por nombre o la crea */
async function findOrCreateCategory(
  executor: DbExecutor,
  projectId: string,
  name: string,
  color: string
): Promise<string> {
  const [existing] = await executor
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.projectId, projectId), eq(categories.name, name)))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await executor
    .insert(categories)
    .values({ projectId, name, color })
    .returning({ id: categories.id });
  return created.id;
}

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
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = payCreditCardSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  const projectId = parsed.data.projectId;

  // Verificar acceso de escritura al proyecto
  const hasAccess = await verifyProjectWriteAccess(projectId, userId);
  if (!hasAccess) {
    return { success: false, error: NO_PROJECT_ACCESS };
  }

  // Verificar que la cuenta origen no es la tarjeta de crédito
  if (parsed.data.sourceAccountId === parsed.data.creditCardAccountId) {
    return { success: false, error: 'La cuenta origen y la tarjeta de crédito deben ser diferentes' };
  }

  // Cuentas (ambas del proyecto), transacciones seleccionadas de la TC, moneda y categoría de intereses
  const [creditCardAccount, sourceAccount, transactionsToUpdate, project, refsError] = await Promise.all([
    db
      .select({ id: accounts.id, type: accounts.type, name: accounts.name, entityId: accounts.entityId })
      .from(accounts)
      .where(and(eq(accounts.id, parsed.data.creditCardAccountId), eq(accounts.projectId, projectId)))
      .limit(1),
    db
      .select({ id: accounts.id, name: accounts.name, entityId: accounts.entityId })
      .from(accounts)
      .where(and(eq(accounts.id, parsed.data.sourceAccountId), eq(accounts.projectId, projectId)))
      .limit(1),
    db
      .select({
        id: transactions.id,
        baseAmount: transactions.baseAmount,
        paidByTransferId: transactions.paidByTransferId,
        cardPurchaseId: transactions.cardPurchaseId,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.projectId, projectId),
          eq(transactions.accountId, parsed.data.creditCardAccountId),
          inArray(transactions.id, parsed.data.transactionIds)
        )
      ),
    db.select({ currency: projects.currency }).from(projects).where(eq(projects.id, projectId)).limit(1),
    projectRefsError(projectId, { categoryIds: [parsed.data.interestCategoryId] }),
  ]);

  if (!creditCardAccount[0]) {
    return { success: false, error: 'Tarjeta de crédito no encontrada' };
  }

  if (creditCardAccount[0].type !== 'credit_card') {
    return { success: false, error: 'La cuenta destino debe ser una tarjeta de crédito' };
  }

  if (!sourceAccount[0]) {
    return { success: false, error: 'Cuenta origen no encontrada' };
  }

  if (refsError) {
    return { success: false, error: refsError };
  }

  if (transactionsToUpdate.length === 0) {
    return { success: false, error: 'No se encontraron transacciones válidas para pagar' };
  }

  // Verificar que ninguna ya esté pagada
  const alreadyPaid = transactionsToUpdate.filter((t) => t.paidByTransferId !== null);
  if (alreadyPaid.length > 0) {
    return { success: false, error: `${alreadyPaid.length} transacción(es) ya están pagadas` };
  }

  if (!project[0]) {
    return { success: false, error: 'Proyecto no encontrado' };
  }

  const currency = project[0].currency;

  // Calcular el total
  const totalAmount = transactionsToUpdate.reduce(
    (sum, t) => sum + parseFloat(t.baseAmount),
    0
  );

  const amount = String(totalAmount.toFixed(2));
  const amountNum = parseFloat(amount);
  const description = parsed.data.description || 'Pago de tarjeta de crédito';
  const interestPaid = parsed.data.interestAmount && parsed.data.interestAmount > 0 ? parsed.data.interestAmount : 0;
  const idsToMark = transactionsToUpdate.map((t) => t.id);
  const cardPurchaseIds = [...new Set(
    transactionsToUpdate
      .map((t) => t.cardPurchaseId)
      .filter((id): id is string => id !== null)
  )];

  // Transferencia, intereses, marcas de pago y saldos se guardan juntos
  const transferId = await db.transaction(async (tx) => {
    const transferCategoryId = await findOrCreateCategory(tx, projectId, 'Transferencias', '#6B7280');

    // Crear transacción de salida (expense en cuenta origen)
    const [outTransaction] = await tx
      .insert(transactions)
      .values({
        userId,
        projectId,
        categoryId: transferCategoryId,
        accountId: parsed.data.sourceAccountId,
        entityId: sourceAccount[0].entityId,
        type: 'expense',
        description: `${description} → ${creditCardAccount[0].name}`,
        notes: parsed.data.notes,
        date: parsed.data.date,
        isPaid: true,
        originalAmount: amount,
        originalCurrency: currency,
        baseAmount: amount,
        baseCurrency: currency,
        exchangeRate: '1',
      })
      .returning({ id: transactions.id });

    // Crear transacción de entrada (income en tarjeta de crédito)
    const [inTransaction] = await tx
      .insert(transactions)
      .values({
        userId,
        projectId,
        categoryId: transferCategoryId,
        accountId: parsed.data.creditCardAccountId,
        entityId: creditCardAccount[0].entityId,
        type: 'income',
        description: `${description} ← ${sourceAccount[0].name}`,
        notes: parsed.data.notes,
        date: parsed.data.date,
        isPaid: true,
        originalAmount: amount,
        originalCurrency: currency,
        baseAmount: amount,
        baseCurrency: currency,
        exchangeRate: '1',
        linkedTransactionId: outTransaction.id,
      })
      .returning({ id: transactions.id });

    // Vincular las transacciones de la transferencia
    await tx
      .update(transactions)
      .set({ linkedTransactionId: inTransaction.id })
      .where(eq(transactions.id, outTransaction.id));

    // Actualizar balances de la transferencia
    await updateAccountBalance(parsed.data.sourceAccountId, -amountNum, tx);
    await updateAccountBalance(parsed.data.creditCardAccountId, amountNum, tx);

    // Registrar intereses/cargos si existen (como gasto en cuenta origen)
    if (interestPaid > 0) {
      const interestCategoryId =
        parsed.data.interestCategoryId ||
        (await findOrCreateCategory(tx, projectId, 'Intereses y Cargos TC', '#DC2626'));

      const interestAmountStr = String(interestPaid.toFixed(2));
      const interestDescription = parsed.data.interestDescription || `Intereses/Cargos ${creditCardAccount[0].name}`;

      // Crear transacción de intereses como gasto en la cuenta origen
      await tx
        .insert(transactions)
        .values({
          userId,
          projectId,
          categoryId: interestCategoryId,
          accountId: parsed.data.sourceAccountId,
          entityId: sourceAccount[0].entityId,
          type: 'expense',
          description: interestDescription,
          notes: parsed.data.notes,
          date: parsed.data.date,
          isPaid: true,
          originalAmount: interestAmountStr,
          originalCurrency: currency,
          baseAmount: interestAmountStr,
          baseCurrency: currency,
          exchangeRate: '1',
        });

      // Actualizar balance de la cuenta origen por los intereses
      await updateAccountBalance(parsed.data.sourceAccountId, -interestPaid, tx);
    }

    // Marcar las transacciones seleccionadas con paidByTransferId (una sola sentencia)
    const now = new Date();
    await tx
      .update(transactions)
      .set({
        paidByTransferId: outTransaction.id,
        paidAt: now,
        updatedAt: now,
      })
      .where(and(eq(transactions.projectId, projectId), inArray(transactions.id, idsToMark)));

    // Desactivar las compras en cuotas que quedaron con todas sus cuotas pagadas
    if (cardPurchaseIds.length > 0) {
      await tx
        .update(cardPurchases)
        .set({ isActive: false, updatedAt: now })
        .where(
          and(
            eq(cardPurchases.projectId, projectId),
            inArray(cardPurchases.id, cardPurchaseIds),
            sql`${cardPurchases.installments} <= (
              SELECT COUNT(*) FROM ${transactions}
              WHERE ${transactions.cardPurchaseId} = ${cardPurchases.id}
              AND ${transactions.paidByTransferId} IS NOT NULL
            )`
          )
        );
    }

    return outTransaction.id;
  });

  invalidateRelatedCache('transactions');
  invalidateRelatedCache('cardPurchases');

  return {
    success: true,
    data: { transferId, totalPaid: totalAmount, interestPaid },
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
  if (!(await isSessionUser(userId))) {
    return [];
  }

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
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = setHistoricallyPaidSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar acceso de escritura al proyecto
  const hasAccess = await verifyProjectWriteAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: NO_PROJECT_ACCESS };
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
