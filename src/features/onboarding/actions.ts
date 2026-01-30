'use server';

import { db } from '@/lib/db';
import { currencies, categoryTemplates, categories, projects, projectMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { checkNeedsOnboarding, checkHasCategories } from './queries';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Ejecuta el proceso de onboarding para un usuario nuevo
 * - Crea un proyecto inicial con el mes actual
 * - Copia las categorías del sistema al usuario
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

  // Copiar categorías del sistema si el usuario no tiene
  const hasCategories = await checkHasCategories(userId);

  if (!hasCategories) {
    const templates = await db.select().from(categoryTemplates);

    if (templates.length > 0) {
      await db.insert(categories).values(
        templates.map((template) => ({
          userId,
          name: template.name,
          type: template.type,
          group: template.group,
          color: template.color,
        }))
      );
    }
  }

  return { success: true, projectId: newProject.id };
}
