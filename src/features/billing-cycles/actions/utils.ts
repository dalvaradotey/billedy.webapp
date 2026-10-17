import { db } from '@/lib/db';
import { billingCycles, projectMembers } from '@/lib/db/schema';
import { eq, and, lte, gte, ne } from 'drizzle-orm';
import { memberCondition } from '@/lib/auth/project-access';

export type { ActionResult } from '@/types/action-result';
export { UNAUTHORIZED_ERROR } from '@/lib/auth/guards';

/**
 * Busca un ciclo verificando que el usuario sea miembro del proyecto con rol
 * que pueda modificar (owner/editor). Para las mutaciones sobre el ciclo.
 */
export async function getCycleForWrite(cycleId: string, userId: string) {
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
    .where(and(eq(billingCycles.id, cycleId), memberCondition(userId, { write: true })))
    .limit(1);

  return existing ?? null;
}

/**
 * Busca un ciclo del proyecto cuyas fechas se crucen con el rango dado.
 * Un solape hace que un pago de TC quede en dos ciclos (o en el equivocado).
 */
export async function findOverlappingCycle(
  projectId: string,
  startDate: Date,
  endDate: Date,
  excludeCycleId?: string
): Promise<{ id: string; name: string } | null> {
  const conditions = [
    eq(billingCycles.projectId, projectId),
    lte(billingCycles.startDate, endDate),
    gte(billingCycles.endDate, startDate),
  ];
  if (excludeCycleId) {
    conditions.push(ne(billingCycles.id, excludeCycleId));
  }

  const [overlapping] = await db
    .select({ id: billingCycles.id, name: billingCycles.name })
    .from(billingCycles)
    .where(and(...conditions))
    .limit(1);

  return overlapping ?? null;
}

export function overlapError(cycleName: string): string {
  return `Las fechas se cruzan con "${cycleName}". Ajusta el inicio o el fin para que no se solapen.`;
}
