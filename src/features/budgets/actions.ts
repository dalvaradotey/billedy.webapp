'use server';

import { db } from '@/lib/db';
import { budgets, projectMembers } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  createBudgetSchema,
  updateBudgetSchema,
} from './schemas';
import type {
  CreateBudgetInput,
  UpdateBudgetInput,
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

/**
 * Crea un nuevo presupuesto (plantilla)
 */
export async function createBudget(
  userId: string,
  input: CreateBudgetInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = createBudgetSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  const hasAccess = await verifyProjectAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  const [newBudget] = await db
    .insert(budgets)
    .values({
      projectId: parsed.data.projectId,
      name: parsed.data.name,
      categoryId: parsed.data.categoryId ?? null,
      defaultAmount: String(parsed.data.defaultAmount),
      currency: parsed.data.currency,
    })
    .returning({ id: budgets.id });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/budgets');

  return { success: true, data: { id: newBudget.id } };
}

/**
 * Actualiza un presupuesto existente
 */
export async function updateBudget(
  budgetId: string,
  userId: string,
  input: UpdateBudgetInput
): Promise<ActionResult> {
  const parsed = updateBudgetSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar que el presupuesto existe y el usuario tiene acceso
  const existing = await db
    .select({ projectId: budgets.projectId })
    .from(budgets)
    .innerJoin(projectMembers, eq(budgets.projectId, projectMembers.projectId))
    .where(
      and(
        eq(budgets.id, budgetId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Presupuesto no encontrado' };
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.categoryId !== undefined) updateData.categoryId = parsed.data.categoryId;
  if (parsed.data.defaultAmount !== undefined) updateData.defaultAmount = String(parsed.data.defaultAmount);
  if (parsed.data.currency !== undefined) updateData.currency = parsed.data.currency;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

  await db
    .update(budgets)
    .set(updateData)
    .where(eq(budgets.id, budgetId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/budgets');

  return { success: true, data: undefined };
}

/**
 * Elimina un presupuesto
 */
export async function deleteBudget(
  budgetId: string,
  userId: string
): Promise<ActionResult> {
  // Verificar acceso
  const existing = await db
    .select({ projectId: budgets.projectId })
    .from(budgets)
    .innerJoin(projectMembers, eq(budgets.projectId, projectMembers.projectId))
    .where(
      and(
        eq(budgets.id, budgetId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Presupuesto no encontrado' };
  }

  await db.delete(budgets).where(eq(budgets.id, budgetId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/budgets');

  return { success: true, data: undefined };
}

/**
 * Activa o desactiva un presupuesto
 */
export async function toggleBudgetActive(
  budgetId: string,
  userId: string,
  isActive: boolean
): Promise<ActionResult> {
  return updateBudget(budgetId, userId, { isActive });
}
