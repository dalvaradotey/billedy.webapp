'use server';

import { db } from '@/lib/db';
import { billingCycles, projectMembers } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import {
  createBillingCycleSchema,
  updateBillingCycleSchema,
  type CreateBillingCycleInput,
  type UpdateBillingCycleInput,
} from '../schemas';
import { type ActionResult, verifyProjectAccess } from './utils';
import { loadCycleTransactions } from './cycle-transactions';

/**
 * Crea un nuevo ciclo de facturación
 */
export async function createBillingCycle(
  userId: string,
  input: CreateBillingCycleInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = createBillingCycleSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  const hasAccess = await verifyProjectAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  // Verificar que no haya un ciclo abierto que se solape
  const overlapping = await db
    .select({ id: billingCycles.id })
    .from(billingCycles)
    .where(
      and(eq(billingCycles.projectId, parsed.data.projectId), eq(billingCycles.status, 'open'))
    )
    .limit(1);

  if (overlapping.length > 0) {
    return {
      success: false,
      error: 'Ya existe un ciclo abierto. Ciérralo antes de crear uno nuevo.',
    };
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
  userId: string,
  input: UpdateBillingCycleInput
): Promise<ActionResult> {
  const parsed = updateBillingCycleSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar que el ciclo existe y el usuario tiene acceso
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

  if (existing[0].status === 'closed') {
    return { success: false, error: 'No se puede editar un ciclo cerrado' };
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.startDate !== undefined) updateData.startDate = parsed.data.startDate;
  if (parsed.data.endDate !== undefined) updateData.endDate = parsed.data.endDate;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

  await db.update(billingCycles).set(updateData).where(eq(billingCycles.id, cycleId));

  invalidateRelatedCache('billingCycles');

  return { success: true, data: undefined };
}

/**
 * Elimina un ciclo de facturación
 */
export async function deleteBillingCycle(
  cycleId: string,
  userId: string
): Promise<ActionResult> {
  const existing = await db
    .select({
      id: billingCycles.id,
      projectId: billingCycles.projectId,
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

  await db.delete(billingCycles).where(eq(billingCycles.id, cycleId));

  invalidateRelatedCache('billingCycles');

  return { success: true, data: undefined };
}
