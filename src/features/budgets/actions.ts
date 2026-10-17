'use server';

import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import {
  memberCondition,
  NO_PROJECT_ACCESS,
  projectRefsError,
  verifyProjectWriteAccess,
} from '@/lib/auth/project-access';
import { db } from '@/lib/db';
import { budgets, projectMembers, transactions, categories, accounts, entities } from '@/lib/db/schema';
import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';
import { z } from 'zod';
import { invalidateRelatedCache } from '@/lib/cache';
import type { ActionResult } from '@/types/action-result';
import {
  createBudgetSchema,
  updateBudgetSchema,
} from './schemas';
import type {
  CreateBudgetInput,
  UpdateBudgetInput,
} from './schemas';

const orderedIdsSchema = z.array(z.string().uuid()).min(1, 'No se proporcionaron presupuestos');

/**
 * Proyecto del presupuesto si el usuario tiene acceso (con `write`, rol de escritura)
 */
async function findBudget(budgetId: string, userId: string, write: boolean) {
  const [row] = await db
    .select({ projectId: budgets.projectId, defaultAmount: budgets.defaultAmount })
    .from(budgets)
    .innerJoin(projectMembers, eq(budgets.projectId, projectMembers.projectId))
    .where(and(eq(budgets.id, budgetId), memberCondition(userId, { write })))
    .limit(1);
  return row ?? null;
}

/**
 * Crea un nuevo presupuesto (plantilla)
 */
export async function createBudget(
  userId: string,
  input: CreateBudgetInput
): Promise<ActionResult<{ id: string }>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = createBudgetSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  const hasAccess = await verifyProjectWriteAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: NO_PROJECT_ACCESS };
  }

  // La categoría y la cuenta por defecto deben ser del proyecto
  const refsError = await projectRefsError(parsed.data.projectId, {
    categoryIds: [parsed.data.categoryId],
    accountIds: [parsed.data.defaultAccountId],
  });
  if (refsError) return { success: false, error: refsError };

  // Calcular siguiente sort_order
  const [maxOrder] = await db
    .select({ max: sql<number>`COALESCE(MAX(${budgets.sortOrder}), 0)` })
    .from(budgets)
    .where(eq(budgets.projectId, parsed.data.projectId));

  const [newBudget] = await db
    .insert(budgets)
    .values({
      projectId: parsed.data.projectId,
      name: parsed.data.name,
      categoryId: parsed.data.categoryId ?? null,
      defaultAccountId: parsed.data.defaultAccountId ?? null,
      defaultAmount: String(parsed.data.defaultAmount),
      currency: parsed.data.currency,
      startDate: parsed.data.startDate ?? null,
      endDate: parsed.data.endDate ?? null,
      sortOrder: (maxOrder?.max ?? 0) + 1000,
    })
    .returning({ id: budgets.id });

  invalidateRelatedCache('budgets');

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
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = updateBudgetSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar que el presupuesto existe y el usuario puede modificarlo
  const existing = await findBudget(budgetId, userId, true);
  if (!existing) {
    return { success: false, error: 'Presupuesto no encontrado' };
  }

  // La categoría y la cuenta por defecto nuevas deben ser del proyecto del presupuesto
  const refsError = await projectRefsError(existing.projectId, {
    categoryIds: [parsed.data.categoryId],
    accountIds: [parsed.data.defaultAccountId],
  });
  if (refsError) return { success: false, error: refsError };

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.categoryId !== undefined) updateData.categoryId = parsed.data.categoryId;
  if (parsed.data.defaultAccountId !== undefined) updateData.defaultAccountId = parsed.data.defaultAccountId;
  if (parsed.data.defaultAmount !== undefined) updateData.defaultAmount = String(parsed.data.defaultAmount);
  if (parsed.data.currency !== undefined) updateData.currency = parsed.data.currency;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
  if (parsed.data.startDate !== undefined) updateData.startDate = parsed.data.startDate;
  if (parsed.data.endDate !== undefined) updateData.endDate = parsed.data.endDate;

  await db
    .update(budgets)
    .set(updateData)
    .where(and(eq(budgets.id, budgetId), eq(budgets.projectId, existing.projectId)));

  invalidateRelatedCache('budgets');

  return { success: true, data: undefined };
}

/**
 * Elimina un presupuesto
 */
export async function deleteBudget(
  budgetId: string,
  userId: string
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  // Verificar acceso de escritura
  const existing = await findBudget(budgetId, userId, true);
  if (!existing) {
    return { success: false, error: 'Presupuesto no encontrado' };
  }

  await db
    .delete(budgets)
    .where(and(eq(budgets.id, budgetId), eq(budgets.projectId, existing.projectId)));

  invalidateRelatedCache('budgets');

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
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  return updateBudget(budgetId, userId, { isActive });
}

/**
 * Reordena los presupuestos (actualiza sort_order en batch)
 */
export async function reorderBudgets(
  projectId: string,
  userId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const hasAccess = await verifyProjectWriteAccess(projectId, userId);
  if (!hasAccess) {
    return { success: false, error: NO_PROJECT_ACCESS };
  }

  const parsedIds = orderedIdsSchema.safeParse(orderedIds);
  if (!parsedIds.success) {
    return { success: false, error: parsedIds.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Un solo UPDATE con los pares (id, orden); solo toca presupuestos del proyecto
  const values = sql.join(
    parsedIds.data.map((id, index) => sql`(${id}, ${(index + 1) * 1000}::int)`),
    sql`, `
  );
  await db.execute(sql`
    update ${budgets}
    set sort_order = v.o, updated_at = now()
    from (values ${values}) as v(id, o)
    where ${budgets.id} = v.id::uuid and ${budgets.projectId} = ${projectId}
  `);

  invalidateRelatedCache('budgets');

  return { success: true, data: undefined };
}

/**
 * Obtiene detalle de un presupuesto: progreso + transacciones para un rango de fechas
 */
export async function fetchBudgetDetail(
  budgetId: string,
  userId: string,
  startDate: string,
  endDate: string
): Promise<ActionResult<{
  spentAmount: number;
  budgetedAmount: number;
  progressPercentage: number;
  remainingAmount: number;
  transactions: {
    id: string;
    date: Date;
    description: string;
    baseAmount: string;
    categoryName: string | null;
    categoryColor: string | null;
    accountName: string | null;
    entityId: string | null;
    entityName: string | null;
    entityImageUrl: string | null;
  }[];
}>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  // Verificar que el presupuesto existe y el usuario tiene acceso (lectura)
  const existing = await findBudget(budgetId, userId, false);
  if (!existing) {
    return { success: false, error: 'Presupuesto no encontrado' };
  }

  const budgetedAmount = parseFloat(existing.defaultAmount);
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T23:59:59Z');

  // Obtener transacciones del presupuesto en el rango
  const txList = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      description: transactions.description,
      baseAmount: transactions.baseAmount,
      categoryName: categories.name,
      categoryColor: categories.color,
      accountName: accounts.name,
      entityId: transactions.entityId,
      entityName: entities.name,
      entityImageUrl: entities.imageUrl,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(entities, eq(transactions.entityId, entities.id))
    .where(
      and(
        eq(transactions.budgetId, budgetId),
        eq(transactions.projectId, existing.projectId),
        eq(transactions.type, 'expense'),
        gte(transactions.date, start),
        lte(transactions.date, end)
      )
    )
    .orderBy(desc(transactions.date));

  const spentAmount = txList.reduce((sum, t) => sum + parseFloat(t.baseAmount), 0);
  const remainingAmount = budgetedAmount - spentAmount;
  const progressPercentage = budgetedAmount > 0
    ? Math.min(100, Math.round((spentAmount / budgetedAmount) * 100))
    : 0;

  return {
    success: true,
    data: {
      spentAmount,
      budgetedAmount,
      progressPercentage,
      remainingAmount,
      transactions: txList,
    },
  };
}
