'use server';

import { db } from '@/lib/db';
import { budgets, projectMembers } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  createBudgetSchema,
  updateBudgetSchema,
  upsertBudgetSchema,
} from './schemas';
import type {
  CreateBudgetInput,
  UpdateBudgetInput,
  UpsertBudgetInput,
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
 * Crea un nuevo presupuesto
 */
export async function createBudget(
  userId: string,
  input: CreateBudgetInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = createBudgetSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar acceso al proyecto
  const hasAccess = await verifyProjectAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  // Verificar si ya existe un presupuesto para esta categoría/período
  const existing = await db
    .select({ id: budgets.id })
    .from(budgets)
    .where(
      and(
        eq(budgets.projectId, parsed.data.projectId),
        eq(budgets.categoryId, parsed.data.categoryId),
        eq(budgets.year, parsed.data.year),
        eq(budgets.month, parsed.data.month)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return { success: false, error: 'Ya existe un presupuesto para esta categoría en este período' };
  }

  const [newBudget] = await db
    .insert(budgets)
    .values({
      projectId: parsed.data.projectId,
      categoryId: parsed.data.categoryId,
      year: parsed.data.year,
      month: parsed.data.month,
      amount: String(parsed.data.amount),
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

  await db
    .update(budgets)
    .set({
      amount: String(parsed.data.amount),
      updatedAt: new Date(),
    })
    .where(eq(budgets.id, budgetId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/budgets');

  return { success: true, data: undefined };
}

/**
 * Crea o actualiza un presupuesto (upsert)
 */
export async function upsertBudget(
  userId: string,
  input: UpsertBudgetInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = upsertBudgetSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar acceso al proyecto
  const hasAccess = await verifyProjectAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  // Buscar presupuesto existente
  const existing = await db
    .select({ id: budgets.id })
    .from(budgets)
    .where(
      and(
        eq(budgets.projectId, parsed.data.projectId),
        eq(budgets.categoryId, parsed.data.categoryId),
        eq(budgets.year, parsed.data.year),
        eq(budgets.month, parsed.data.month)
      )
    )
    .limit(1);

  let budgetId: string;

  if (existing[0]) {
    // Actualizar existente
    await db
      .update(budgets)
      .set({
        amount: String(parsed.data.amount),
        updatedAt: new Date(),
      })
      .where(eq(budgets.id, existing[0].id));
    budgetId = existing[0].id;
  } else {
    // Crear nuevo
    const [newBudget] = await db
      .insert(budgets)
      .values({
        projectId: parsed.data.projectId,
        categoryId: parsed.data.categoryId,
        year: parsed.data.year,
        month: parsed.data.month,
        amount: String(parsed.data.amount),
      })
      .returning({ id: budgets.id });
    budgetId = newBudget.id;
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/budgets');

  return { success: true, data: { id: budgetId } };
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
 * Copia presupuestos del mes anterior al mes actual
 */
export async function copyBudgetsFromPreviousMonth(
  projectId: string,
  userId: string,
  targetYear: number,
  targetMonth: number
): Promise<ActionResult<{ count: number }>> {
  // Verificar acceso
  const hasAccess = await verifyProjectAccess(projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  // Calcular mes anterior
  let prevYear = targetYear;
  let prevMonth = targetMonth - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear--;
  }

  // Obtener presupuestos del mes anterior
  const previousBudgets = await db
    .select({
      categoryId: budgets.categoryId,
      amount: budgets.amount,
    })
    .from(budgets)
    .where(
      and(
        eq(budgets.projectId, projectId),
        eq(budgets.year, prevYear),
        eq(budgets.month, prevMonth)
      )
    );

  if (previousBudgets.length === 0) {
    return { success: false, error: 'No hay presupuestos en el mes anterior' };
  }

  // Verificar cuáles ya existen en el mes objetivo
  const existingBudgets = await db
    .select({ categoryId: budgets.categoryId })
    .from(budgets)
    .where(
      and(
        eq(budgets.projectId, projectId),
        eq(budgets.year, targetYear),
        eq(budgets.month, targetMonth)
      )
    );

  const existingCategoryIds = new Set(existingBudgets.map((b) => b.categoryId));

  // Filtrar presupuestos que no existen aún
  const budgetsToCreate = previousBudgets.filter(
    (b) => !existingCategoryIds.has(b.categoryId)
  );

  if (budgetsToCreate.length === 0) {
    return { success: true, data: { count: 0 } };
  }

  // Crear nuevos presupuestos
  await db.insert(budgets).values(
    budgetsToCreate.map((b) => ({
      projectId,
      categoryId: b.categoryId,
      year: targetYear,
      month: targetMonth,
      amount: b.amount,
    }))
  );

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/budgets');

  return { success: true, data: { count: budgetsToCreate.length } };
}
