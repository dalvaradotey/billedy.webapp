'use server';

import { db } from '@/lib/db';
import { billingCycles, projectMembers } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import { closeBillingCycleSchema, type CloseBillingCycleInput } from '../schemas';
import { type ActionResult, calculateTotalsForRange } from './utils';

/**
 * Cierra un ciclo de facturación y guarda el snapshot
 * Permite ajustar la fecha de fin al momento de cerrar
 */
export async function closeBillingCycle(
  cycleId: string,
  userId: string,
  input?: CloseBillingCycleInput
): Promise<ActionResult> {
  // Validar input si existe
  if (input) {
    const parsed = closeBillingCycleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
    }
  }

  // Verificar que el ciclo existe y el usuario tiene acceso
  const existing = await db
    .select({
      id: billingCycles.id,
      projectId: billingCycles.projectId,
      status: billingCycles.status,
      startDate: billingCycles.startDate,
      endDate: billingCycles.endDate,
    })
    .from(billingCycles)
    .innerJoin(projectMembers, eq(billingCycles.projectId, projectMembers.projectId))
    .where(
      and(
        eq(billingCycles.id, cycleId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Ciclo no encontrado' };
  }

  if (existing[0].status === 'closed') {
    return { success: false, error: 'El ciclo ya está cerrado' };
  }

  // Usar la fecha de fin proporcionada o la existente
  const finalEndDate = input?.endDate ?? new Date(existing[0].endDate);
  const startDate = new Date(existing[0].startDate);

  // Validar que endDate >= startDate
  if (finalEndDate < startDate) {
    return { success: false, error: 'La fecha de fin debe ser posterior a la fecha de inicio' };
  }

  // Calcular totales usando el rango de fechas final
  const totals = await calculateTotalsForRange(existing[0].projectId, startDate, finalEndDate);

  // Cerrar el ciclo con el snapshot
  await db
    .update(billingCycles)
    .set({
      status: 'closed',
      endDate: finalEndDate,
      snapshotIncome: String(totals.income),
      snapshotExpenses: String(totals.expenses),
      snapshotSavings: String(totals.savings),
      snapshotBalance: String(totals.balance),
      updatedAt: new Date(),
    })
    .where(eq(billingCycles.id, cycleId));

  invalidateRelatedCache('billingCycles');

  return { success: true, data: undefined };
}

/**
 * Reabre un ciclo cerrado (borra el snapshot)
 */
export async function reopenBillingCycle(
  cycleId: string,
  userId: string
): Promise<ActionResult> {
  const existing = await db
    .select({
      id: billingCycles.id,
      projectId: billingCycles.projectId,
      status: billingCycles.status,
    })
    .from(billingCycles)
    .innerJoin(projectMembers, eq(billingCycles.projectId, projectMembers.projectId))
    .where(
      and(
        eq(billingCycles.id, cycleId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Ciclo no encontrado' };
  }

  if (existing[0].status === 'open') {
    return { success: false, error: 'El ciclo ya está abierto' };
  }

  // Verificar que no haya otro ciclo abierto
  const openCycle = await db
    .select({ id: billingCycles.id })
    .from(billingCycles)
    .where(
      and(eq(billingCycles.projectId, existing[0].projectId), eq(billingCycles.status, 'open'))
    )
    .limit(1);

  if (openCycle.length > 0) {
    return {
      success: false,
      error: 'Ya hay un ciclo abierto. Ciérralo antes de reabrir este.',
    };
  }

  await db
    .update(billingCycles)
    .set({
      status: 'open',
      snapshotIncome: null,
      snapshotExpenses: null,
      snapshotSavings: null,
      snapshotBalance: null,
      updatedAt: new Date(),
    })
    .where(eq(billingCycles.id, cycleId));

  invalidateRelatedCache('billingCycles');

  return { success: true, data: undefined };
}

/**
 * Recalcula el snapshot de un ciclo cerrado
 */
export async function recalculateSnapshot(
  cycleId: string,
  userId: string
): Promise<ActionResult> {
  const existing = await db
    .select({
      id: billingCycles.id,
      projectId: billingCycles.projectId,
      status: billingCycles.status,
      startDate: billingCycles.startDate,
      endDate: billingCycles.endDate,
    })
    .from(billingCycles)
    .innerJoin(projectMembers, eq(billingCycles.projectId, projectMembers.projectId))
    .where(
      and(
        eq(billingCycles.id, cycleId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Ciclo no encontrado' };
  }

  if (existing[0].status !== 'closed') {
    return { success: false, error: 'Solo se puede recalcular un ciclo cerrado' };
  }

  const totals = await calculateTotalsForRange(
    existing[0].projectId,
    new Date(existing[0].startDate),
    new Date(existing[0].endDate)
  );

  await db
    .update(billingCycles)
    .set({
      snapshotIncome: String(totals.income),
      snapshotExpenses: String(totals.expenses),
      snapshotSavings: String(totals.savings),
      snapshotBalance: String(totals.balance),
      updatedAt: new Date(),
    })
    .where(eq(billingCycles.id, cycleId));

  invalidateRelatedCache('billingCycles');

  return { success: true, data: undefined };
}
