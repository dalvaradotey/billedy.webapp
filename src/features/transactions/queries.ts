import { db } from '@/lib/db';
import { transactions, categories, projectMembers, accounts, budgets, entities } from '@/lib/db/schema';
import { eq, and, desc, gte, lte, like, sql, isNotNull, or } from 'drizzle-orm';
import type {
  Transaction,
  TransactionWithCategory,
  TransactionFilters,
  TransactionSummary,
} from './types';

/**
 * Obtiene transacciones del proyecto con filtros
 */
export async function getTransactions(
  projectId: string,
  userId: string,
  filters: TransactionFilters = {}
): Promise<TransactionWithCategory[]> {
  const conditions = [
    eq(transactions.projectId, projectId),
    eq(projectMembers.userId, userId),
    isNotNull(projectMembers.acceptedAt),
  ];

  if (filters.type) {
    conditions.push(eq(transactions.type, filters.type));
  }

  if (filters.categoryId) {
    conditions.push(eq(transactions.categoryId, filters.categoryId));
  }

  if (filters.isPaid !== undefined) {
    conditions.push(eq(transactions.isPaid, filters.isPaid));
  }

  if (filters.startDate) {
    conditions.push(gte(transactions.date, filters.startDate));
  }

  if (filters.endDate) {
    conditions.push(lte(transactions.date, filters.endDate));
  }

  if (filters.search) {
    conditions.push(
      or(
        like(transactions.description, `%${filters.search}%`),
        like(categories.name, `%${filters.search}%`)
      )!
    );
  }

  const result = await db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      projectId: transactions.projectId,
      categoryId: transactions.categoryId,
      accountId: transactions.accountId,
      entityId: transactions.entityId,
      type: transactions.type,
      originalAmount: transactions.originalAmount,
      originalCurrency: transactions.originalCurrency,
      baseAmount: transactions.baseAmount,
      baseCurrency: transactions.baseCurrency,
      exchangeRate: transactions.exchangeRate,
      date: transactions.date,
      description: transactions.description,
      notes: transactions.notes,
      isPaid: transactions.isPaid,
      paidAt: transactions.paidAt,
      creditId: transactions.creditId,
      recurringItemId: transactions.recurringItemId,
      budgetId: transactions.budgetId,
      cardPurchaseId: transactions.cardPurchaseId,
      linkedTransactionId: transactions.linkedTransactionId,
      paidByTransferId: transactions.paidByTransferId,
      isHistoricallyPaid: transactions.isHistoricallyPaid,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      categoryName: categories.name,
      categoryColor: categories.color,
      accountName: accounts.name,
      budgetName: budgets.name,
      entityName: entities.name,
      entityImageUrl: entities.imageUrl,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .innerJoin(projectMembers, eq(transactions.projectId, projectMembers.projectId))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(budgets, eq(transactions.budgetId, budgets.id))
    .leftJoin(entities, eq(transactions.entityId, entities.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));

  return result;
}

/**
 * Obtiene una transacción por ID
 */
export async function getTransactionById(
  transactionId: string,
  userId: string
): Promise<TransactionWithCategory | null> {
  const result = await db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      projectId: transactions.projectId,
      categoryId: transactions.categoryId,
      accountId: transactions.accountId,
      entityId: transactions.entityId,
      type: transactions.type,
      originalAmount: transactions.originalAmount,
      originalCurrency: transactions.originalCurrency,
      baseAmount: transactions.baseAmount,
      baseCurrency: transactions.baseCurrency,
      exchangeRate: transactions.exchangeRate,
      date: transactions.date,
      description: transactions.description,
      notes: transactions.notes,
      isPaid: transactions.isPaid,
      paidAt: transactions.paidAt,
      creditId: transactions.creditId,
      recurringItemId: transactions.recurringItemId,
      budgetId: transactions.budgetId,
      cardPurchaseId: transactions.cardPurchaseId,
      linkedTransactionId: transactions.linkedTransactionId,
      paidByTransferId: transactions.paidByTransferId,
      isHistoricallyPaid: transactions.isHistoricallyPaid,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      categoryName: categories.name,
      categoryColor: categories.color,
      accountName: accounts.name,
      budgetName: budgets.name,
      entityName: entities.name,
      entityImageUrl: entities.imageUrl,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .innerJoin(projectMembers, eq(transactions.projectId, projectMembers.projectId))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(budgets, eq(transactions.budgetId, budgets.id))
    .leftJoin(entities, eq(transactions.entityId, entities.id))
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * Obtiene resumen de transacciones del proyecto
 */
export async function getTransactionSummary(
  projectId: string,
  userId: string
): Promise<TransactionSummary> {
  const result = await db
    .select({
      type: transactions.type,
      isPaid: transactions.isPaid,
      totalAmount: sql<string>`SUM(${transactions.baseAmount})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .innerJoin(projectMembers, eq(transactions.projectId, projectMembers.projectId))
    .where(
      and(
        eq(transactions.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .groupBy(transactions.type, transactions.isPaid);

  let totalIncome = 0;
  let totalExpense = 0;
  let paidCount = 0;
  let pendingCount = 0;

  for (const row of result) {
    const amount = parseFloat(row.totalAmount ?? '0');
    const count = Number(row.count);

    if (row.type === 'income') {
      totalIncome += amount;
    } else {
      totalExpense += amount;
    }

    if (row.isPaid) {
      paidCount += count;
    } else {
      pendingCount += count;
    }
  }

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    paidCount,
    pendingCount,
  };
}

/**
 * Obtiene transacciones recientes del proyecto
 */
export async function getRecentTransactions(
  projectId: string,
  userId: string,
  limit: number = 5
): Promise<TransactionWithCategory[]> {
  const result = await db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      projectId: transactions.projectId,
      categoryId: transactions.categoryId,
      accountId: transactions.accountId,
      entityId: transactions.entityId,
      type: transactions.type,
      originalAmount: transactions.originalAmount,
      originalCurrency: transactions.originalCurrency,
      baseAmount: transactions.baseAmount,
      baseCurrency: transactions.baseCurrency,
      exchangeRate: transactions.exchangeRate,
      date: transactions.date,
      description: transactions.description,
      notes: transactions.notes,
      isPaid: transactions.isPaid,
      paidAt: transactions.paidAt,
      creditId: transactions.creditId,
      recurringItemId: transactions.recurringItemId,
      budgetId: transactions.budgetId,
      cardPurchaseId: transactions.cardPurchaseId,
      linkedTransactionId: transactions.linkedTransactionId,
      paidByTransferId: transactions.paidByTransferId,
      isHistoricallyPaid: transactions.isHistoricallyPaid,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      categoryName: categories.name,
      categoryColor: categories.color,
      accountName: accounts.name,
      budgetName: budgets.name,
      entityName: entities.name,
      entityImageUrl: entities.imageUrl,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .innerJoin(projectMembers, eq(transactions.projectId, projectMembers.projectId))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(budgets, eq(transactions.budgetId, budgets.id))
    .leftJoin(entities, eq(transactions.entityId, entities.id))
    .where(
      and(
        eq(transactions.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit);

  return result;
}

/**
 * Obtiene transacciones pendientes de pago de una tarjeta de crédito
 * (transacciones de tipo expense sin paidByTransferId)
 */
export async function getUnpaidCreditCardTransactions(
  accountId: string,
  projectId: string,
  userId: string
): Promise<TransactionWithCategory[]> {
  // Verificar acceso
  const hasAccess = await db
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

  if (hasAccess.length === 0) {
    return [];
  }

  const result = await db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      projectId: transactions.projectId,
      categoryId: transactions.categoryId,
      accountId: transactions.accountId,
      entityId: transactions.entityId,
      type: transactions.type,
      originalAmount: transactions.originalAmount,
      originalCurrency: transactions.originalCurrency,
      baseAmount: transactions.baseAmount,
      baseCurrency: transactions.baseCurrency,
      exchangeRate: transactions.exchangeRate,
      date: transactions.date,
      description: transactions.description,
      notes: transactions.notes,
      isPaid: transactions.isPaid,
      paidAt: transactions.paidAt,
      creditId: transactions.creditId,
      recurringItemId: transactions.recurringItemId,
      budgetId: transactions.budgetId,
      cardPurchaseId: transactions.cardPurchaseId,
      linkedTransactionId: transactions.linkedTransactionId,
      paidByTransferId: transactions.paidByTransferId,
      isHistoricallyPaid: transactions.isHistoricallyPaid,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      categoryName: categories.name,
      categoryColor: categories.color,
      accountName: accounts.name,
      budgetName: budgets.name,
      entityName: entities.name,
      entityImageUrl: entities.imageUrl,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(budgets, eq(transactions.budgetId, budgets.id))
    .leftJoin(entities, eq(transactions.entityId, entities.id))
    .where(
      and(
        eq(transactions.accountId, accountId),
        eq(transactions.projectId, projectId),
        eq(transactions.type, 'expense'),
        sql`${transactions.paidByTransferId} IS NULL`
      )
    )
    .orderBy(desc(transactions.date), desc(transactions.createdAt));

  return result;
}
