'use server';

import { db } from '@/lib/db';
import { savingsGoals, projectMembers } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
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
