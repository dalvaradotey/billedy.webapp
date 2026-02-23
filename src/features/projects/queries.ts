import { db } from '@/lib/db';
import { projects, currencies, projectMembers, users } from '@/lib/db/schema';
import { eq, desc, and, isNotNull, isNull, asc, inArray, sql } from 'drizzle-orm';
import type { Project, ProjectWithCurrency, Currency, ProjectMemberWithUser, PendingInvitation } from './types';

/**
 * Obtiene todos los proyectos donde el usuario es miembro (aceptado)
 */
export async function getProjects(userId: string): Promise<Project[]> {
  return db
    .select({
      id: projects.id,
      userId: projects.userId,
      name: projects.name,
      description: projects.description,
      baseCurrencyId: projects.baseCurrencyId,
      currency: projects.currency,
      maxInstallmentAmount: projects.maxInstallmentAmount,
      isArchived: projects.isArchived,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
    .where(
      and(
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .orderBy(desc(projects.createdAt));
}

/**
 * Obtiene todos los proyectos activos donde el usuario es miembro
 */
export async function getActiveProjects(userId: string): Promise<Project[]> {
  return db
    .select({
      id: projects.id,
      userId: projects.userId,
      name: projects.name,
      description: projects.description,
      baseCurrencyId: projects.baseCurrencyId,
      currency: projects.currency,
      maxInstallmentAmount: projects.maxInstallmentAmount,
      isArchived: projects.isArchived,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
    .where(
      and(
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt),
        eq(projects.isArchived, false)
      )
    )
    .orderBy(desc(projects.createdAt));
}

/**
 * Obtiene un proyecto por ID si el usuario es miembro
 */
export async function getProjectById(
  projectId: string,
  userId: string
): Promise<ProjectWithCurrency | null> {
  const result = await db
    .select({
      id: projects.id,
      userId: projects.userId,
      name: projects.name,
      description: projects.description,
      baseCurrencyId: projects.baseCurrencyId,
      currency: projects.currency,
      maxInstallmentAmount: projects.maxInstallmentAmount,
      isArchived: projects.isArchived,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      currencySymbol: currencies.symbol,
      currencyName: currencies.name,
    })
    .from(projects)
    .innerJoin(currencies, eq(projects.baseCurrencyId, currencies.id))
    .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
    .where(
      and(
        eq(projects.id, projectId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * Obtiene el proyecto más reciente donde el usuario es miembro
 */
export async function getLatestProject(userId: string): Promise<Project | null> {
  const result = await db
    .select({
      id: projects.id,
      userId: projects.userId,
      name: projects.name,
      description: projects.description,
      baseCurrencyId: projects.baseCurrencyId,
      currency: projects.currency,
      maxInstallmentAmount: projects.maxInstallmentAmount,
      isArchived: projects.isArchived,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
    .where(
      and(
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt),
        eq(projects.isArchived, false)
      )
    )
    .orderBy(desc(projects.createdAt))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Obtiene todas las monedas disponibles
 */
export async function getCurrencies(): Promise<Currency[]> {
  return db
    .select()
    .from(currencies)
    .orderBy(asc(currencies.code));
}

// ============================================================================
// PROJECT MEMBERS & INVITATIONS
// ============================================================================

/**
 * Obtiene los miembros de un proyecto (aceptados y pendientes)
 */
export async function getProjectMembers(
  projectId: string,
  userId: string
): Promise<ProjectMemberWithUser[]> {
  // Verificar que el usuario tenga acceso al proyecto (debe ser miembro aceptado)
  const hasAccess = await db
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

  if (!hasAccess[0]) {
    return [];
  }

  const result = await db
    .select({
      id: projectMembers.id,
      projectId: projectMembers.projectId,
      userId: projectMembers.userId,
      role: projectMembers.role,
      invitedBy: projectMembers.invitedBy,
      invitedAt: projectMembers.invitedAt,
      acceptedAt: projectMembers.acceptedAt,
      createdAt: projectMembers.createdAt,
      updatedAt: projectMembers.updatedAt,
      userName: users.name,
      userEmail: users.email,
      userImage: users.image,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(
      // Primero aceptados, luego pendientes
      sql`CASE WHEN ${projectMembers.acceptedAt} IS NOT NULL THEN 0 ELSE 1 END`,
      // Luego por rol (owner primero)
      desc(projectMembers.role),
      // Finalmente por nombre
      asc(users.name)
    );

  return result;
}

/**
 * Obtiene las invitaciones pendientes para un usuario
 */
export async function getPendingInvitations(userId: string): Promise<PendingInvitation[]> {
  const invitedByAlias = db.$with('inviter').as(
    db.select({
      id: users.id,
      name: users.name,
      email: users.email,
    }).from(users)
  );

  const result = await db
    .select({
      id: projectMembers.id,
      projectId: projectMembers.projectId,
      projectName: projects.name,
      role: projectMembers.role,
      invitedBy: projectMembers.invitedBy,
      invitedAt: projectMembers.invitedAt,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(
      and(
        eq(projectMembers.userId, userId),
        isNull(projectMembers.acceptedAt)
      )
    )
    .orderBy(desc(projectMembers.invitedAt));

  // Obtener info de quién invitó
  const inviterIds = [...new Set(result.filter(r => r.invitedBy).map(r => r.invitedBy!))];
  const inviters = inviterIds.length > 0
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, inviterIds))
    : [];

  const inviterMap = new Map(inviters.map(i => [i.id, i]));

  return result.map(r => ({
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName,
    role: r.role as PendingInvitation['role'],
    invitedByName: r.invitedBy ? inviterMap.get(r.invitedBy)?.name ?? null : null,
    invitedByEmail: r.invitedBy ? inviterMap.get(r.invitedBy)?.email ?? null : null,
    invitedAt: r.invitedAt,
  }));
}

/**
 * Cuenta las invitaciones pendientes para un usuario
 */
export async function countPendingInvitations(userId: string): Promise<number> {
  const result = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        isNull(projectMembers.acceptedAt)
      )
    );

  return result.length;
}

/**
 * Busca un usuario por email
 */
export async function findUserByEmail(email: string): Promise<{ id: string; name: string | null; email: string } | null> {
  const result = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Verifica si un usuario es owner de un proyecto
 */
export async function isProjectOwner(projectId: string, userId: string): Promise<boolean> {
  const result = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        eq(projectMembers.role, 'owner'),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  return !!result[0];
}

/**
 * Busca usuarios por email parcial (para selector de invitación)
 */
export async function searchUsersByEmail(
  query: string,
  excludeUserId: string,
  limit: number = 5
): Promise<{ id: string; name: string | null; email: string; image: string | null }[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const searchPattern = `%${query.toLowerCase()}%`;

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(users)
    .where(
      and(
        sql`LOWER(${users.email}) LIKE ${searchPattern}`,
        sql`${users.id} != ${excludeUserId}`
      )
    )
    .orderBy(asc(users.email))
    .limit(limit);
}
