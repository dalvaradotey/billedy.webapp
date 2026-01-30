'use server';

import { db } from '@/lib/db';
import { savingsFunds, savingsMovements, projectMembers } from '@/lib/db/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  createSavingsFundSchema,
  updateSavingsFundSchema,
  createMovementSchema,
  updateMovementSchema,
} from './schemas';
import type {
  CreateSavingsFundInput,
  UpdateSavingsFundInput,
  CreateMovementInput,
  UpdateMovementInput,
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
 * Recalcula el balance actual de un fondo basado en sus movimientos
 */
async function recalculateFundBalance(fundId: string): Promise<void> {
  const result = await db
    .select({
      balance: sql<string>`
        COALESCE(
          SUM(CASE
            WHEN ${savingsMovements.type} = 'deposit' THEN ${savingsMovements.amount}
            WHEN ${savingsMovements.type} = 'withdrawal' THEN -${savingsMovements.amount}
            ELSE 0
          END),
          0
        )
      `,
    })
    .from(savingsMovements)
    .where(eq(savingsMovements.savingsFundId, fundId));

  const newBalance = result[0]?.balance ?? '0';

  await db
    .update(savingsFunds)
    .set({
      currentBalance: newBalance,
      updatedAt: new Date(),
    })
    .where(eq(savingsFunds.id, fundId));
}

// ============================================================================
// SAVINGS FUNDS ACTIONS
// ============================================================================

/**
 * Crea un nuevo fondo de ahorro
 */
export async function createSavingsFund(
  userId: string,
  currencyId: string,
  input: CreateSavingsFundInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = createSavingsFundSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Si hay projectId, verificar acceso
  if (parsed.data.projectId) {
    const hasAccess = await verifyProjectAccess(parsed.data.projectId, userId);
    if (!hasAccess) {
      return { success: false, error: 'No tienes acceso a este proyecto' };
    }
  }

  const initialBalance = String(parsed.data.currentBalance ?? 0);

  const [newFund] = await db
    .insert(savingsFunds)
    .values({
      userId,
      projectId: parsed.data.projectId ?? null,
      name: parsed.data.name,
      type: parsed.data.type,
      accountType: parsed.data.accountType,
      currencyId,
      targetAmount: parsed.data.targetAmount ? String(parsed.data.targetAmount) : null,
      monthlyTarget: String(parsed.data.monthlyTarget),
      currentBalance: initialBalance,
    })
    .returning({ id: savingsFunds.id });

  // Si hay balance inicial, crear movimiento de depósito
  if (parsed.data.currentBalance && parsed.data.currentBalance > 0) {
    await db.insert(savingsMovements).values({
      savingsFundId: newFund.id,
      type: 'deposit',
      amount: initialBalance,
      date: new Date(),
      description: 'Balance inicial',
    });
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/savings');

  return { success: true, data: { id: newFund.id } };
}

/**
 * Actualiza un fondo de ahorro
 */
export async function updateSavingsFund(
  fundId: string,
  userId: string,
  input: UpdateSavingsFundInput
): Promise<ActionResult> {
  const parsed = updateSavingsFundSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar que el fondo existe y pertenece al usuario
  const existing = await db
    .select({ id: savingsFunds.id })
    .from(savingsFunds)
    .where(and(eq(savingsFunds.id, fundId), eq(savingsFunds.userId, userId)))
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Fondo de ahorro no encontrado' };
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
  if (parsed.data.accountType !== undefined) updateData.accountType = parsed.data.accountType;
  if (parsed.data.targetAmount !== undefined) {
    updateData.targetAmount = parsed.data.targetAmount ? String(parsed.data.targetAmount) : null;
  }
  if (parsed.data.monthlyTarget !== undefined) {
    updateData.monthlyTarget = String(parsed.data.monthlyTarget);
  }
  if (parsed.data.isArchived !== undefined) updateData.isArchived = parsed.data.isArchived;

  await db.update(savingsFunds).set(updateData).where(eq(savingsFunds.id, fundId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/savings');

  return { success: true, data: undefined };
}

/**
 * Archiva o restaura un fondo de ahorro
 */
export async function archiveSavingsFund(
  fundId: string,
  userId: string,
  isArchived: boolean
): Promise<ActionResult> {
  const existing = await db
    .select({ id: savingsFunds.id })
    .from(savingsFunds)
    .where(and(eq(savingsFunds.id, fundId), eq(savingsFunds.userId, userId)))
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Fondo de ahorro no encontrado' };
  }

  await db
    .update(savingsFunds)
    .set({
      isArchived,
      updatedAt: new Date(),
    })
    .where(eq(savingsFunds.id, fundId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/savings');

  return { success: true, data: undefined };
}

/**
 * Elimina un fondo de ahorro y todos sus movimientos
 */
export async function deleteSavingsFund(fundId: string, userId: string): Promise<ActionResult> {
  const existing = await db
    .select({ id: savingsFunds.id })
    .from(savingsFunds)
    .where(and(eq(savingsFunds.id, fundId), eq(savingsFunds.userId, userId)))
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Fondo de ahorro no encontrado' };
  }

  // Los movimientos se eliminan en cascada por la FK
  await db.delete(savingsFunds).where(eq(savingsFunds.id, fundId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/savings');

  return { success: true, data: undefined };
}

// ============================================================================
// SAVINGS MOVEMENTS ACTIONS
// ============================================================================

/**
 * Crea un nuevo movimiento (depósito o retiro)
 */
export async function createMovement(
  userId: string,
  input: CreateMovementInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = createMovementSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar que el fondo existe y pertenece al usuario
  const fund = await db
    .select({
      id: savingsFunds.id,
      currentBalance: savingsFunds.currentBalance,
    })
    .from(savingsFunds)
    .where(
      and(eq(savingsFunds.id, parsed.data.savingsFundId), eq(savingsFunds.userId, userId))
    )
    .limit(1);

  if (!fund[0]) {
    return { success: false, error: 'Fondo de ahorro no encontrado' };
  }

  // Verificar que hay suficiente balance para retiro
  if (parsed.data.type === 'withdrawal') {
    const currentBalance = parseFloat(fund[0].currentBalance);
    if (parsed.data.amount > currentBalance) {
      return { success: false, error: 'No hay suficiente balance para este retiro' };
    }
  }

  // Crear el movimiento
  const [newMovement] = await db
    .insert(savingsMovements)
    .values({
      savingsFundId: parsed.data.savingsFundId,
      type: parsed.data.type,
      amount: String(parsed.data.amount),
      date: parsed.data.date,
      description: parsed.data.description,
    })
    .returning({ id: savingsMovements.id });

  // Recalcular balance del fondo
  await recalculateFundBalance(parsed.data.savingsFundId);

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/savings');

  return { success: true, data: { id: newMovement.id } };
}

/**
 * Actualiza un movimiento existente
 */
export async function updateMovement(
  movementId: string,
  userId: string,
  input: UpdateMovementInput
): Promise<ActionResult> {
  const parsed = updateMovementSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar que el movimiento existe y pertenece a un fondo del usuario
  const existing = await db
    .select({
      id: savingsMovements.id,
      savingsFundId: savingsMovements.savingsFundId,
    })
    .from(savingsMovements)
    .innerJoin(savingsFunds, eq(savingsMovements.savingsFundId, savingsFunds.id))
    .where(and(eq(savingsMovements.id, movementId), eq(savingsFunds.userId, userId)))
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Movimiento no encontrado' };
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
  if (parsed.data.amount !== undefined) updateData.amount = String(parsed.data.amount);
  if (parsed.data.date !== undefined) updateData.date = parsed.data.date;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;

  await db.update(savingsMovements).set(updateData).where(eq(savingsMovements.id, movementId));

  // Recalcular balance del fondo
  await recalculateFundBalance(existing[0].savingsFundId);

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/savings');

  return { success: true, data: undefined };
}

/**
 * Elimina un movimiento
 */
export async function deleteMovement(movementId: string, userId: string): Promise<ActionResult> {
  // Verificar que el movimiento existe y pertenece a un fondo del usuario
  const existing = await db
    .select({
      id: savingsMovements.id,
      savingsFundId: savingsMovements.savingsFundId,
    })
    .from(savingsMovements)
    .innerJoin(savingsFunds, eq(savingsMovements.savingsFundId, savingsFunds.id))
    .where(and(eq(savingsMovements.id, movementId), eq(savingsFunds.userId, userId)))
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Movimiento no encontrado' };
  }

  const fundId = existing[0].savingsFundId;

  await db.delete(savingsMovements).where(eq(savingsMovements.id, movementId));

  // Recalcular balance del fondo
  await recalculateFundBalance(fundId);

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/savings');

  return { success: true, data: undefined };
}
