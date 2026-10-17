'use server';

import { db } from '@/lib/db';
import { billingCycles } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import { requireUserId } from '@/lib/auth/guards';
import { closeBillingCycleSchema, type CloseBillingCycleInput } from '../schemas';
import { getCycleBalances, toClosingSnapshot } from '../lib/cycle-balance';
import {
  type ActionResult,
  UNAUTHORIZED_ERROR,
  getCycleForWrite,
  findOverlappingCycle,
  overlapError,
} from './utils';

/**
 * Cierra un ciclo de facturación y guarda el snapshot
 * Permite ajustar la fecha de fin al momento de cerrar.
 *
 * Los ciclos cerrados se muestran siempre calculados en vivo; el snapshot queda
 * como registro del valor al cierre en closing_snapshot (cascada completa, de
 * donde se derivan ingresos, gastos, ahorro y saldo final).
 */
export async function closeBillingCycle(
  cycleId: string,
  input?: CloseBillingCycleInput
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  // Validar input (opcional)
  const parsed = closeBillingCycleSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar que el ciclo existe y el usuario puede modificarlo
  const existing = await getCycleForWrite(cycleId, userId);

  if (!existing) {
    return { success: false, error: 'Ciclo no encontrado' };
  }

  if (existing.status === 'closed') {
    return { success: false, error: 'El ciclo ya está cerrado' };
  }

  // Usar la fecha de fin proporcionada o la existente
  const finalEndDate = parsed.data.endDate ?? new Date(existing.endDate);
  const startDate = new Date(existing.startDate);

  // Validar que endDate >= startDate
  if (finalEndDate < startDate) {
    return { success: false, error: 'La fecha de fin debe ser posterior a la fecha de inicio' };
  }

  const overlapping = await findOverlappingCycle(
    existing.projectId,
    startDate,
    finalEndDate,
    cycleId
  );
  if (overlapping) {
    return { success: false, error: overlapError(overlapping.name) };
  }

  // Calcular el saldo con la fecha de fin final (el ciclo anterior se usa para el pago TC)
  const projectCycles = await db
    .select({
      id: billingCycles.id,
      startDate: billingCycles.startDate,
      endDate: billingCycles.endDate,
      status: billingCycles.status,
    })
    .from(billingCycles)
    .where(eq(billingCycles.projectId, existing.projectId));

  const balances = await getCycleBalances(
    existing.projectId,
    projectCycles.map((c) =>
      c.id === cycleId
        ? { ...c, endDate: finalEndDate, status: 'closed' as const }
        : { ...c, startDate: new Date(c.startDate), endDate: new Date(c.endDate) }
    )
  );
  const balance = balances.get(cycleId)!;

  // Cerrar el ciclo con el snapshot
  await db
    .update(billingCycles)
    .set({
      status: 'closed',
      endDate: finalEndDate,
      closingSnapshot: toClosingSnapshot(balance),
      updatedAt: new Date(),
    })
    .where(and(eq(billingCycles.id, cycleId), eq(billingCycles.projectId, existing.projectId)));

  invalidateRelatedCache('billingCycles');

  return { success: true, data: undefined };
}

/**
 * Reabre un ciclo cerrado (borra el snapshot)
 */
export async function reopenBillingCycle(cycleId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const existing = await getCycleForWrite(cycleId, userId);

  if (!existing) {
    return { success: false, error: 'Ciclo no encontrado' };
  }

  if (existing.status === 'open') {
    return { success: false, error: 'El ciclo ya está abierto' };
  }

  // Verificar que no haya otro ciclo abierto
  const openCycle = await db
    .select({ id: billingCycles.id })
    .from(billingCycles)
    .where(
      and(eq(billingCycles.projectId, existing.projectId), eq(billingCycles.status, 'open'))
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
      closingSnapshot: null,
      updatedAt: new Date(),
    })
    .where(and(eq(billingCycles.id, cycleId), eq(billingCycles.projectId, existing.projectId)));

  invalidateRelatedCache('billingCycles');

  return { success: true, data: undefined };
}
