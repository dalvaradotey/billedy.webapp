'use server';

import { db } from '@/lib/db';
import { projects, currencies, projectMembers, users } from '@/lib/db/schema';
import { eq, and, isNotNull, isNull } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import { cookies } from 'next/headers';
import { createProjectSchema, updateProjectSchema, inviteMemberSchema } from './schemas';
import type { CreateProjectInput, UpdateProjectInput, InviteMemberInput } from './schemas';

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

  invalidateRelatedCache('projects');

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

  invalidateRelatedCache('projects');

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

  invalidateRelatedCache('projects');

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

  invalidateRelatedCache('projects');

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
  invalidateRelatedCache('projects');
}

// ============================================================================
// PROJECT MEMBERS & INVITATIONS
// ============================================================================

/**
 * Invita a un usuario a un proyecto por email
 */
export async function inviteMember(
  projectId: string,
  inviterId: string,
  input: InviteMemberInput
): Promise<ActionResult> {
  const parsed = inviteMemberSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar que el invitador sea owner del proyecto
  const isOwner = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, inviterId),
        eq(projectMembers.role, 'owner'),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!isOwner[0]) {
    return { success: false, error: 'No tienes permisos para invitar miembros' };
  }

  // Buscar el usuario por email
  const targetUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email.toLowerCase()))
    .limit(1);

  if (!targetUser[0]) {
    return { success: false, error: 'No se encontró un usuario con ese correo' };
  }

  // Verificar que no sea el mismo usuario
  if (targetUser[0].id === inviterId) {
    return { success: false, error: 'No puedes invitarte a ti mismo' };
  }

  // Verificar que no exista ya una invitación o membresía
  const existingMember = await db
    .select({ id: projectMembers.id, acceptedAt: projectMembers.acceptedAt })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, targetUser[0].id)
      )
    )
    .limit(1);

  if (existingMember[0]) {
    if (existingMember[0].acceptedAt) {
      return { success: false, error: 'Este usuario ya es miembro del proyecto' };
    }
    return { success: false, error: 'Ya existe una invitación pendiente para este usuario' };
  }

  // Crear la invitación
  await db.insert(projectMembers).values({
    projectId,
    userId: targetUser[0].id,
    role: parsed.data.role,
    invitedBy: inviterId,
  });

  invalidateRelatedCache('projects');

  return { success: true, data: undefined };
}

/**
 * Acepta una invitación a un proyecto
 */
export async function acceptInvitation(
  invitationId: string,
  userId: string
): Promise<ActionResult> {
  // Verificar que la invitación exista y pertenezca al usuario
  const invitation = await db
    .select({ id: projectMembers.id, acceptedAt: projectMembers.acceptedAt })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.id, invitationId),
        eq(projectMembers.userId, userId)
      )
    )
    .limit(1);

  if (!invitation[0]) {
    return { success: false, error: 'Invitación no encontrada' };
  }

  if (invitation[0].acceptedAt) {
    return { success: false, error: 'Esta invitación ya fue aceptada' };
  }

  // Aceptar la invitación
  await db
    .update(projectMembers)
    .set({
      acceptedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(projectMembers.id, invitationId));

  invalidateRelatedCache('projects');

  return { success: true, data: undefined };
}

/**
 * Rechaza una invitación a un proyecto
 */
export async function rejectInvitation(
  invitationId: string,
  userId: string
): Promise<ActionResult> {
  // Verificar que la invitación exista y pertenezca al usuario
  const invitation = await db
    .select({ id: projectMembers.id, acceptedAt: projectMembers.acceptedAt })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.id, invitationId),
        eq(projectMembers.userId, userId),
        isNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!invitation[0]) {
    return { success: false, error: 'Invitación no encontrada' };
  }

  // Eliminar la invitación
  await db
    .delete(projectMembers)
    .where(eq(projectMembers.id, invitationId));

  invalidateRelatedCache('projects');

  return { success: true, data: undefined };
}

/**
 * Elimina un miembro de un proyecto (solo el owner puede hacerlo)
 */
export async function removeMember(
  projectId: string,
  memberId: string,
  ownerId: string
): Promise<ActionResult> {
  // Verificar que el solicitante sea owner
  const isOwner = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, ownerId),
        eq(projectMembers.role, 'owner'),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!isOwner[0]) {
    return { success: false, error: 'No tienes permisos para eliminar miembros' };
  }

  // Verificar que el miembro exista y no sea el owner
  const member = await db
    .select({ id: projectMembers.id, role: projectMembers.role, userId: projectMembers.userId })
    .from(projectMembers)
    .where(eq(projectMembers.id, memberId))
    .limit(1);

  if (!member[0]) {
    return { success: false, error: 'Miembro no encontrado' };
  }

  if (member[0].role === 'owner') {
    return { success: false, error: 'No puedes eliminar al dueño del proyecto' };
  }

  // Eliminar el miembro
  await db
    .delete(projectMembers)
    .where(eq(projectMembers.id, memberId));

  invalidateRelatedCache('projects');

  return { success: true, data: undefined };
}

/**
 * Busca usuarios por email para el selector de invitación
 */
export async function searchUsersForInvite(
  query: string,
  currentUserId: string
): Promise<ActionResult<{ id: string; name: string | null; email: string; image: string | null }[]>> {
  // Importar la query dinámicamente para evitar imports circulares
  const { searchUsersByEmail } = await import('./queries');

  try {
    const results = await searchUsersByEmail(query, currentUserId, 5);
    return { success: true, data: results };
  } catch {
    return { success: false, error: 'Error al buscar usuarios' };
  }
}
