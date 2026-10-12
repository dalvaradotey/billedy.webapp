import { db } from '@/lib/db';
import { projectMembers } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

/**
 * Verifica que el usuario sea miembro aceptado del proyecto.
 * No es una server action: no debe quedar expuesta como endpoint.
 */
export async function verifyProjectAccess(projectId: string, userId: string): Promise<boolean> {
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
