'use server';

import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import { memberCondition, NO_PROJECT_ACCESS, verifyProjectWriteAccess } from '@/lib/auth/project-access';
import { db } from '@/lib/db';
import { savingsGoals, transactions, projectMembers, categories, accounts, budgets, entities } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import type { ActionResult } from '@/types/action-result';
import type { TransactionWithCategory } from '@/features/transactions/types';
import {
  createSavingsGoalSchema,
  updateSavingsGoalSchema,
} from './schemas';
import type {
  CreateSavingsGoalInput,
  UpdateSavingsGoalInput,
} from './schemas';

/**
 * Meta del usuario que puede modificar. Las metas son del usuario; si están
 * asociadas a un proyecto, además exige rol de escritura en ese proyecto.
 */
async function findWritableGoal(goalId: string, userId: string): Promise<{ id: string } | null> {
  const [goal] = await db
    .select({ id: savingsGoals.id, projectId: savingsGoals.projectId })
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, userId)))
    .limit(1);

  if (!goal) return null;
  if (goal.projectId && !(await verifyProjectWriteAccess(goal.projectId, userId))) return null;
  return goal;
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
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = createSavingsGoalSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  if (parsed.data.projectId) {
    const hasAccess = await verifyProjectWriteAccess(parsed.data.projectId, userId);
    if (!hasAccess) {
      return { success: false, error: NO_PROJECT_ACCESS };
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
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = updateSavingsGoalSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  const existing = await findWritableGoal(goalId, userId);
  if (!existing) {
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

  await db
    .update(savingsGoals)
    .set(updateData)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, userId)));

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
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const existing = await findWritableGoal(goalId, userId);
  if (!existing) {
    return { success: false, error: 'Meta de ahorro no encontrada' };
  }

  await db
    .update(savingsGoals)
    .set({
      isCompleted,
      updatedAt: new Date(),
    })
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, userId)));

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
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const existing = await findWritableGoal(goalId, userId);
  if (!existing) {
    return { success: false, error: 'Meta de ahorro no encontrada' };
  }

  await db
    .update(savingsGoals)
    .set({
      isArchived,
      updatedAt: new Date(),
    })
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, userId)));

  invalidateRelatedCache('savings');

  return { success: true, data: undefined };
}

/**
 * Elimina una meta de ahorro
 * Las transacciones vinculadas quedan con savingsGoalId = NULL (ON DELETE SET NULL)
 */
export async function deleteSavingsGoal(goalId: string, userId: string): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const existing = await findWritableGoal(goalId, userId);
  if (!existing) {
    return { success: false, error: 'Meta de ahorro no encontrada' };
  }

  await db
    .delete(savingsGoals)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, userId)));

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
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

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
      nature: transactions.nature,
      accountFundId: transactions.accountFundId,
      investmentId: transactions.investmentId,
      investmentRole: transactions.investmentRole,
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
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  // Transacción del usuario en un proyecto donde puede modificar
  const [existing] = await db
    .select({ id: transactions.id, projectId: transactions.projectId })
    .from(transactions)
    .innerJoin(projectMembers, eq(transactions.projectId, projectMembers.projectId))
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId),
        memberCondition(userId, { write: true })
      )
    )
    .limit(1);

  if (!existing) {
    return { success: false, error: 'Transacción no encontrada' };
  }

  await db
    .update(transactions)
    .set({ savingsGoalId: null, updatedAt: new Date() })
    .where(and(eq(transactions.id, transactionId), eq(transactions.projectId, existing.projectId)));

  invalidateRelatedCache('savings');
  invalidateRelatedCache('transactions');

  return { success: true, data: undefined };
}
