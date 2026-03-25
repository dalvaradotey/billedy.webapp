'use server';

import { db } from '@/lib/db';
import { savingsGoals, transactions, projectMembers, categories, accounts, budgets, entities } from '@/lib/db/schema';
import { eq, and, isNotNull, desc } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import type { TransactionWithCategory } from '@/features/transactions/types';
import {
  createSavingsGoalSchema,
  updateSavingsGoalSchema,
} from './schemas';
import type {
  CreateSavingsGoalInput,
  UpdateSavingsGoalInput,
} from './schemas';

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

// ============================================================================
// SAVINGS GOALS ACTIONS
// ============================================================================

/**
 * Crea una nueva meta de ahorro
 */
export async function createSavingsGoal(
  userId: string,
  currencyId: string,
  input: CreateSavingsGoalInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = createSavingsGoalSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  if (parsed.data.projectId) {
    const hasAccess = await verifyProjectAccess(parsed.data.projectId, userId);
    if (!hasAccess) {
      return { success: false, error: 'No tienes acceso a este proyecto' };
    }
  }

  const [newGoal] = await db
    .insert(savingsGoals)
    .values({
      userId,
      projectId: parsed.data.projectId ?? null,
      name: parsed.data.name,
      type: parsed.data.type,
      currencyId,
      targetAmount: String(parsed.data.targetAmount),
      initialBalance: String(parsed.data.initialBalance ?? 0),
    })
    .returning({ id: savingsGoals.id });

  invalidateRelatedCache('savings');

  return { success: true, data: { id: newGoal.id } };
}

/**
 * Actualiza una meta de ahorro
 */
export async function updateSavingsGoal(
  goalId: string,
  userId: string,
  input: UpdateSavingsGoalInput
): Promise<ActionResult> {
  const parsed = updateSavingsGoalSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  const existing = await db
    .select({ id: savingsGoals.id })
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, userId)))
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Meta de ahorro no encontrada' };
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
  if (parsed.data.targetAmount !== undefined) {
    updateData.targetAmount = String(parsed.data.targetAmount);
  }
  if (parsed.data.isCompleted !== undefined) updateData.isCompleted = parsed.data.isCompleted;
  if (parsed.data.isArchived !== undefined) updateData.isArchived = parsed.data.isArchived;

  await db.update(savingsGoals).set(updateData).where(eq(savingsGoals.id, goalId));

  invalidateRelatedCache('savings');

  return { success: true, data: undefined };
}

/**
 * Marca o desmarca una meta de ahorro como completada
 */
export async function completeSavingsGoal(
  goalId: string,
  userId: string,
  isCompleted: boolean
): Promise<ActionResult> {
  const existing = await db
    .select({ id: savingsGoals.id })
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, userId)))
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Meta de ahorro no encontrada' };
  }

  await db
    .update(savingsGoals)
    .set({
      isCompleted,
      updatedAt: new Date(),
    })
    .where(eq(savingsGoals.id, goalId));

  invalidateRelatedCache('savings');

  return { success: true, data: undefined };
}

/**
 * Archiva o restaura una meta de ahorro
 */
export async function archiveSavingsGoal(
  goalId: string,
  userId: string,
  isArchived: boolean
): Promise<ActionResult> {
  const existing = await db
    .select({ id: savingsGoals.id })
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, userId)))
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Meta de ahorro no encontrada' };
  }

  await db
    .update(savingsGoals)
    .set({
      isArchived,
      updatedAt: new Date(),
    })
    .where(eq(savingsGoals.id, goalId));

  invalidateRelatedCache('savings');

  return { success: true, data: undefined };
}

/**
 * Elimina una meta de ahorro
 * Las transacciones vinculadas quedan con savingsGoalId = NULL (ON DELETE SET NULL)
 */
export async function deleteSavingsGoal(goalId: string, userId: string): Promise<ActionResult> {
  const existing = await db
    .select({ id: savingsGoals.id })
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, userId)))
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Meta de ahorro no encontrada' };
  }

  await db.delete(savingsGoals).where(eq(savingsGoals.id, goalId));

  invalidateRelatedCache('savings');

  return { success: true, data: undefined };
}

// ============================================================================
// GOAL TRANSACTIONS
// ============================================================================

/**
 * Obtiene transacciones vinculadas a una meta (para lazy load desde cliente)
 */
export async function fetchGoalTransactions(
  goalId: string,
  userId: string
): Promise<ActionResult<TransactionWithCategory[]>> {
  const existing = await db
    .select({ id: savingsGoals.id })
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, userId)))
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Meta de ahorro no encontrada' };
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
      budgetId: transactions.budgetId,
      cardPurchaseId: transactions.cardPurchaseId,
      savingsGoalId: transactions.savingsGoalId,
      linkedTransactionId: transactions.linkedTransactionId,
      paidByTransferId: transactions.paidByTransferId,
      isHistoricallyPaid: transactions.isHistoricallyPaid,
      isReconciled: transactions.isReconciled,
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
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(budgets, eq(transactions.budgetId, budgets.id))
    .leftJoin(entities, eq(transactions.entityId, entities.id))
    .where(
      and(
        eq(transactions.savingsGoalId, goalId),
        eq(transactions.userId, userId)
      )
    )
    .orderBy(desc(transactions.date), desc(transactions.createdAt));

  return { success: true, data: result };
}

/**
 * Desvincula una transacción de una meta de ahorro (savingsGoalId = null)
 */
export async function unlinkTransactionFromGoal(
  transactionId: string,
  userId: string
): Promise<ActionResult> {
  const existing = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Transacción no encontrada' };
  }

  await db
    .update(transactions)
    .set({ savingsGoalId: null, updatedAt: new Date() })
    .where(eq(transactions.id, transactionId));

  invalidateRelatedCache('savings');
  invalidateRelatedCache('transactions');

  return { success: true, data: undefined };
}
