'use server';

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { simulations } from '@/lib/db/schema';
import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import { NO_PROJECT_ACCESS, verifyProjectWriteAccess } from '@/lib/auth/project-access';
import type { ActionResult } from '@/types/action-result';

const money = z.number().finite().nonnegative();

const loanSchema = z.object({
  amount: money,
  months: z.number().int().min(1).max(120),
  monthlyRate: z.number().finite().min(0).max(0.2),
  offerInstallment: money.nullable().optional(),
  monthlyInsurance: money.optional(),
  upfrontCosts: money.optional(),
  graceMonths: z.number().int().min(0).max(24).optional(),
});

const planSchema = z.object({
  target: z.number().finite().positive(),
  allocations: z.record(z.string(), money),
  bank: loanSchema,
  cardAdvance: loanSchema.extend({ cardId: z.string().uuid().nullable().optional() }).optional(),
  monthlyRepay: money,
  earmarkedId: z.string().uuid().nullable().optional(),
  optionId: z.string().max(20).optional(),
});

const saveSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre').max(255),
  plan: planSchema,
});

export async function saveSimulation(
  userId: string,
  projectId: string,
  input: z.infer<typeof saveSchema>
): Promise<ActionResult<{ id: string }>> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  if (!(await verifyProjectWriteAccess(projectId, userId))) return { success: false, error: NO_PROJECT_ACCESS };
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  const [row] = await db
    .insert(simulations)
    .values({
      projectId,
      userId,
      name: parsed.data.name,
      target: String(parsed.data.plan.target),
      plan: parsed.data.plan,
    })
    .returning({ id: simulations.id });
  return { success: true, data: { id: row.id } };
}

export async function deleteSimulation(userId: string, projectId: string, simulationId: string): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  if (!(await verifyProjectWriteAccess(projectId, userId))) return { success: false, error: NO_PROJECT_ACCESS };
  if (!z.string().uuid().safeParse(simulationId).success) return { success: false, error: 'Simulación no encontrada' };
  await db.delete(simulations).where(and(eq(simulations.id, simulationId), eq(simulations.projectId, projectId)));
  return { success: true, data: undefined };
}
