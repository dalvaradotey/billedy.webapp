'use server';

import { db } from '@/lib/db';
import { billingCycles, projectMembers } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import { requireUserId } from '@/lib/auth/guards';
import { closeBillingCycleSchema, type CloseBillingCycleInput } from '../schemas';
import { getCycleBalances, toClosingSnapshot } from '../lib/cycle-balance';
import {
  type ActionResult,
  UNAUTHORIZED_ERROR,
  findOverlappingCycle,
  overlapError,
} from './utils';

/**
 * Cierra un ciclo de facturación y guarda el snapshot
 * Permite ajustar la fecha de fin al momento de cerrar.
 *
 * Los ciclos cerrados se muestran siempre calculados en vivo; el snapshot queda
 * como registro del valor al cierre (columnas snapshot_*):
 * - snapshot_income   = ingresos + abonos
 * - snapshot_expenses = gastos débito + pago TC
 * - snapshot_savings  = aportes − retiros de ahorro
 * - snapshot_balance  = saldo final
 */
export async function closeBillingCycle(
  cycleId: string,
  input?: CloseBillingCycleInput
): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  // Validar input si existe
  if (input) {
    const parsed = closeBillingCycleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
    }
  }

  // Verificar que el ciclo existe y el usuario tiene acceso
  const [existing] = await db
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

  if (!existing) {
    return { success: false, error: 'Ciclo no encontrado' };
  }

  if (existing.status === 'closed') {
    return { success: false, error: 'El ciclo ya está cerrado' };
  }

  // Usar la fecha de fin proporcionada o la existente
  const finalEndDate = input?.endDate ?? new Date(existing.endDate);
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
      snapshotIncome: String(balance.income.real + balance.reimbursements.real),
      snapshotExpenses: String(balance.debitExpenses.real + balance.cardPayment.real),
      snapshotSavings: String(balance.savingsIn.real - balance.savingsOut.real),
      snapshotBalance: String(balance.finalBalance.real),
      closingSnapshot: toClosingSnapshot(balance),
      updatedAt: new Date(),
    })
    .where(eq(billingCycles.id, cycleId));

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

  const [existing] = await db
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
      snapshotIncome: null,
      snapshotExpenses: null,
      snapshotSavings: null,
      snapshotBalance: null,
      closingSnapshot: null,
      updatedAt: new Date(),
    })
    .where(eq(billingCycles.id, cycleId));

  invalidateRelatedCache('billingCycles');

  return { success: true, data: undefined };
}
