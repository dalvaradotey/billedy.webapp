'use server';

import { db } from '@/lib/db';
import { projects, currencies, projectMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createProjectSchema, updateProjectSchema } from './schemas';
import type { CreateProjectInput, UpdateProjectInput } from './schemas';

const CURRENT_PROJECT_COOKIE = 'billedy_current_project';

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Crea un nuevo proyecto
 */
export async function createProject(
  userId: string,
  input: CreateProjectInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = createProjectSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  let baseCurrencyId = parsed.data.baseCurrencyId;

  // Si no se proporciona baseCurrencyId, obtener CLP por defecto
  if (!baseCurrencyId) {
    const clpCurrency = await db
      .select()
      .from(currencies)
      .where(eq(currencies.code, 'CLP'))
      .limit(1);

    if (!clpCurrency[0]) {
      return { success: false, error: 'No se encontró la moneda CLP' };
    }
    baseCurrencyId = clpCurrency[0].id;
  }

  const [newProject] = await db
    .insert(projects)
    .values({
      ...parsed.data,
      baseCurrencyId,
      userId,
    })
    .returning({ id: projects.id });

  // Agregar al creador como miembro owner
  await db.insert(projectMembers).values({
    projectId: newProject.id,
    userId,
    role: 'owner',
    acceptedAt: new Date(),
  });

  revalidatePath('/dashboard');

  return { success: true, data: { id: newProject.id } };
}

/**
 * Actualiza un proyecto existente
 */
export async function updateProject(
  projectId: string,
  userId: string,
  input: UpdateProjectInput
): Promise<ActionResult> {
  const parsed = updateProjectSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  await db
    .update(projects)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  revalidatePath('/dashboard');

  return { success: true, data: undefined };
}

/**
 * Archiva un proyecto
 */
export async function archiveProject(
  projectId: string,
  userId: string
): Promise<ActionResult> {
  await db
    .update(projects)
    .set({
      isArchived: true,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  revalidatePath('/dashboard');

  return { success: true, data: undefined };
}

/**
 * Restaura un proyecto archivado
 */
export async function restoreProject(
  projectId: string,
  userId: string
): Promise<ActionResult> {
  await db
    .update(projects)
    .set({
      isArchived: false,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  revalidatePath('/dashboard');

  return { success: true, data: undefined };
}

/**
 * Obtiene el ID del proyecto actual desde la cookie
 */
export async function getCurrentProjectId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CURRENT_PROJECT_COOKIE)?.value ?? null;
}

/**
 * Guarda el ID del proyecto actual en la cookie
 */
export async function setCurrentProjectId(projectId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CURRENT_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 año
  });
  revalidatePath('/dashboard');
}
