import { db } from '@/lib/db';
import { projects, currencies, projectMembers } from '@/lib/db/schema';
import { eq, desc, and, isNotNull } from 'drizzle-orm';
import type { Project, ProjectWithCurrency } from './types';

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
      defaultIncomeAmount: projects.defaultIncomeAmount,
      maxInstallmentAmount: projects.maxInstallmentAmount,
      debitAvailable: projects.debitAvailable,
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
      defaultIncomeAmount: projects.defaultIncomeAmount,
      maxInstallmentAmount: projects.maxInstallmentAmount,
      debitAvailable: projects.debitAvailable,
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
      defaultIncomeAmount: projects.defaultIncomeAmount,
      maxInstallmentAmount: projects.maxInstallmentAmount,
      debitAvailable: projects.debitAvailable,
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
      defaultIncomeAmount: projects.defaultIncomeAmount,
      maxInstallmentAmount: projects.maxInstallmentAmount,
      debitAvailable: projects.debitAvailable,
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
