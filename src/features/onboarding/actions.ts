'use server';

import { db } from '@/lib/db';
import { currencies, projects, projectMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { checkNeedsOnboarding } from './queries';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Ejecuta el proceso de onboarding para un usuario nuevo
 * - Crea un proyecto inicial con el mes actual
 */
export async function runOnboarding(userId: string): Promise<{ success: boolean; projectId?: string }> {
  const needsOnboarding = await checkNeedsOnboarding(userId);

  if (!needsOnboarding) {
    return { success: true };
  }

  // Obtener la moneda CLP
  const clpCurrency = await db
    .select()
    .from(currencies)
    .where(eq(currencies.code, 'CLP'))
    .limit(1);

  if (!clpCurrency[0]) {
    console.error('No se encontró la moneda CLP');
    return { success: false };
  }

  // Crear proyecto con el nombre del mes actual
  const now = new Date();
  const monthName = MONTH_NAMES[now.getMonth()];
  const year = now.getFullYear();
  const projectName = `${monthName} ${year}`;

  const [newProject] = await db
    .insert(projects)
    .values({
      userId,
      name: projectName,
      baseCurrencyId: clpCurrency[0].id,
      currency: 'CLP',
    })
    .returning();

  // Agregar al creador como miembro owner
  await db.insert(projectMembers).values({
    projectId: newProject.id,
    userId,
    role: 'owner',
    acceptedAt: new Date(),
  });

  return { success: true, projectId: newProject.id };
}
