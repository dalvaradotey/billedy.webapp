'use server';

import { db } from '@/lib/db';
import { billingCycles } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import { requireUserId } from '@/lib/auth/guards';
import { NO_PROJECT_ACCESS, verifyProjectWriteAccess } from '@/lib/auth/project-access';
import {
  createBillingCycleSchema,
  updateBillingCycleSchema,
  type CreateBillingCycleInput,
  type UpdateBillingCycleInput,
} from '../schemas';
import {
  type ActionResult,
  UNAUTHORIZED_ERROR,
  getCycleForWrite,
  findOverlappingCycle,
  overlapError,
} from './utils';
import { loadCycleTransactions } from './cycle-transactions';

/**
 * Crea un nuevo ciclo de facturación
 */
export async function createBillingCycle(
  input: CreateBillingCycleInput
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  if (!userId) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = createBillingCycleSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  const hasAccess = await verifyProjectWriteAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: NO_PROJECT_ACCESS };
  }

  // Solo puede haber un ciclo abierto
  const openCycle = await db
    .select({ id: billingCycles.id })
    .from(billingCycles)
    .where(
      and(eq(billingCycles.projectId, parsed.data.projectId), eq(billingCycles.status, 'open'))
    )
    .limit(1);

  if (openCycle.length > 0) {
    return {
      success: false,
      error: 'Ya existe un ciclo abierto. Ciérralo antes de crear uno nuevo.',
    };
  }

  const overlapping = await findOverlappingCycle(
    parsed.data.projectId,
    parsed.data.startDate,
    parsed.data.endDate
  );
  if (overlapping) {
    return { success: false, error: overlapError(overlapping.name) };
  }

  const [newCycle] = await db
    .insert(billingCycles)
    .values({
      projectId: parsed.data.projectId,
      name: parsed.data.name,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      notes: parsed.data.notes,
      status: 'open',
    })
    .returning({ id: billingCycles.id });

  // Cargar transacciones automáticas al crear el ciclo
  await loadCycleTransactions(
    parsed.data.projectId,
    userId,
    parsed.data.startDate,
    parsed.data.endDate
  );

  invalidateRelatedCache('billingCycles');
  invalidateRelatedCache('transactions');

  return { success: true, data: { id: newCycle.id } };
}

/**
 * Actualiza un ciclo de facturación
 */
export async function updateBillingCycle(
  cycleId: string,
  input: UpdateBillingCycleInput
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = updateBillingCycleSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  const existing = await getCycleForWrite(cycleId, userId);

  if (!existing) {
    return { success: false, error: 'Ciclo no encontrado' };
  }

  if (existing.status === 'closed') {
    return { success: false, error: 'No se puede editar un ciclo cerrado' };
  }

  const startDate = parsed.data.startDate ?? new Date(existing.startDate);
  const endDate = parsed.data.endDate ?? new Date(existing.endDate);

  if (endDate <= startDate) {
    return { success: false, error: 'La fecha de fin debe ser posterior a la fecha de inicio' };
  }

  const overlapping = await findOverlappingCycle(existing.projectId, startDate, endDate, cycleId);
  if (overlapping) {
    return { success: false, error: overlapError(overlapping.name) };
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.startDate !== undefined) updateData.startDate = parsed.data.startDate;
  if (parsed.data.endDate !== undefined) updateData.endDate = parsed.data.endDate;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

  await db
    .update(billingCycles)
    .set(updateData)
    .where(and(eq(billingCycles.id, cycleId), eq(billingCycles.projectId, existing.projectId)));

  invalidateRelatedCache('billingCycles');

  return { success: true, data: undefined };
}

/**
 * Elimina un ciclo de facturación
 */
export async function deleteBillingCycle(cycleId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const existing = await getCycleForWrite(cycleId, userId);

  if (!existing) {
    return { success: false, error: 'Ciclo no encontrado' };
  }

  await db
    .delete(billingCycles)
    .where(and(eq(billingCycles.id, cycleId), eq(billingCycles.projectId, existing.projectId)));

  invalidateRelatedCache('billingCycles');

  return { success: true, data: undefined };
}
