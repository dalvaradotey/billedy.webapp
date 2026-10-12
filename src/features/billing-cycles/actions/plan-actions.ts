'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts, projects } from '@/lib/db/schema';
import { invalidateRelatedCache } from '@/lib/cache';
import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import { getBillingCycles } from '../queries';
import { getCyclePlanStatus, type CyclePlanStatus } from '../lib/cycle-plan';
import {
  abonoWindowStart,
  createSettlement,
  getAvailableAbonos,
  getPendingExpenses,
  liquidateFund as liquidateFundLib,
  type AvailableAbono,
  type PendingExpense,
} from '../lib/settlements';
import { type ActionResult, verifyProjectAccess } from './utils';

const planSchema = z.object({
  savingsTarget: z.number().int().nonnegative().nullable(),
  cardSpendingCap: z.number().int().nonnegative().nullable(),
  contingencyAccountId: z.string().uuid().nullable(),
});

export type ProjectPlanInput = z.infer<typeof planSchema>;

/**
 * Configura el plan del ciclo: ahorro objetivo, techo de gasto propio en TC y
 * cuenta del fondo de imprevistos. Solo el dueño del proyecto.
 */
export async function updateProjectPlan(
  projectId: string,
  userId: string,
  input: ProjectPlanInput
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = planSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  if (parsed.data.contingencyAccountId) {
    const [account] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.id, parsed.data.contingencyAccountId),
          eq(accounts.projectId, projectId),
          eq(accounts.type, 'savings')
        )
      )
      .limit(1);
    if (!account) {
      return { success: false, error: 'La cuenta del fondo debe ser una cuenta de ahorro del proyecto' };
    }
  }

  const updated = await db
    .update(projects)
    .set({
      savingsTarget: parsed.data.savingsTarget != null ? String(parsed.data.savingsTarget) : null,
      cardSpendingCap: parsed.data.cardSpendingCap != null ? String(parsed.data.cardSpendingCap) : null,
      contingencyAccountId: parsed.data.contingencyAccountId,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning({ id: projects.id });

  if (updated.length === 0) {
    return { success: false, error: 'Solo el dueño del proyecto puede cambiar el plan' };
  }

  invalidateRelatedCache('projects');
  invalidateRelatedCache('billingCycles');

  return { success: true, data: undefined };
}

/**
 * Plan del ciclo abierto (techo TC, ahorro, libre). null si no hay ciclo abierto.
 * Lo usan los formularios para avisar antes de pasarse del techo.
 */
export async function fetchCyclePlanStatus(
  projectId: string,
  userId: string
): Promise<ActionResult<CyclePlanStatus | null>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const cycles = await getBillingCycles(projectId, userId);
  const open = cycles.find((c) => c.status === 'open');
  if (!open) return { success: true, data: null };

  return { success: true, data: await getCyclePlanStatus(open) };
}

/**
 * Gastos pendientes de compensar y abonos disponibles para asignar.
 */
export async function fetchPendingSettlements(
  projectId: string,
  userId: string
): Promise<ActionResult<{ expenses: PendingExpense[]; abonos: AvailableAbono[] }>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }
  if (!(await verifyProjectAccess(projectId, userId))) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  const expenses = await getPendingExpenses(projectId);
  const toCollect = expenses.filter((e) => e.nature !== 'fund');
  const abonos = toCollect.length > 0 ? await getAvailableAbonos(projectId, abonoWindowStart(toCollect)) : [];
  return { success: true, data: { expenses, abonos } };
}

/**
 * Compensa un gasto con un abono, o cierra la diferencia sin movimiento
 * (settlingTransactionId = null: "lo asumió la otra persona", redondeo).
 */
export async function settleExpense(
  projectId: string,
  userId: string,
  input: { expenseId: string; settlingTransactionId: string | null; amount?: number }
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }
  if (!(await verifyProjectAccess(projectId, userId))) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  const result = await createSettlement({ projectId, ...input });
  if (!result.success) return result;

  invalidateRelatedCache('billingCycles');
  return { success: true, data: undefined };
}

/**
 * Retira desde la cuenta del fondo el total de los gastos del fondo cuya plata
 * ya salió (débito o TC pagada).
 */
export async function liquidateFund(
  projectId: string,
  userId: string
): Promise<ActionResult<{ amount: number; count: number }>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }
  if (!(await verifyProjectAccess(projectId, userId))) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  const result = await liquidateFundLib(projectId, userId);
  if (!result.success) return result;

  invalidateRelatedCache('transactions');
  invalidateRelatedCache('savings');
  return result;
}
