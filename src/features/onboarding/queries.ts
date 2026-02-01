import { db } from '@/lib/db';
import { projectMembers } from '@/lib/db/schema';
import { eq, count, and, isNotNull } from 'drizzle-orm';

/**
 * Verifica si un usuario necesita onboarding
 * Un usuario necesita onboarding si no es miembro de ningún proyecto
 */
export async function checkNeedsOnboarding(userId: string): Promise<boolean> {
  const result = await db
    .select({ count: count() })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    );

  return result[0].count === 0;
}
