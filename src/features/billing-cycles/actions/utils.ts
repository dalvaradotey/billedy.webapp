import { db } from '@/lib/db';
import { billingCycles, projectMembers } from '@/lib/db/schema';
import { eq, and, isNotNull, lte, gte, ne } from 'drizzle-orm';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export { UNAUTHORIZED_ERROR } from '@/lib/auth/guards';

/**
 * Verifica que el usuario tenga acceso al proyecto
 */
export async function verifyProjectAccess(
  projectId: string,
  userId: string
): Promise<boolean> {
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
