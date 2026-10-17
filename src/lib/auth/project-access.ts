import { and, eq, inArray, isNotNull, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts, budgets, categories, credits, projectMembers, savingsGoals } from '@/lib/db/schema';

/**
 * Acceso a proyectos. Las server actions son endpoints públicos y la BD no tiene
 * RLS: cada action verifica la sesión (guards.ts), la membresía al proyecto y
 * que todo id que llega en el input pertenezca a ese proyecto.
 *
 * No es una server action: no debe quedar expuesto como endpoint.
 */

/** Roles que pueden modificar datos; 'viewer' solo lee */
export const WRITE_ROLES = ['owner', 'editor'] as const;

export const NO_PROJECT_ACCESS = 'No tienes acceso a este proyecto';
export const READ_ONLY_ERROR = 'Tu rol en este proyecto es solo de lectura';

/**
 * Condición de membresía aceptada para usar en joins con `projectMembers`.
 * Con `write`, además exige un rol que pueda modificar.
 */
export function memberCondition(userId: string, options: { write?: boolean } = {}): SQL {
  return and(
    eq(projectMembers.userId, userId),
    isNotNull(projectMembers.acceptedAt),
    options.write ? inArray(projectMembers.role, [...WRITE_ROLES]) : undefined
  )!;
}

async function hasMembership(projectId: string, userId: string, write: boolean): Promise<boolean> {
  const member = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), memberCondition(userId, { write })))
    .limit(1);
  return member.length > 0;
}

/** Miembro aceptado del proyecto (cualquier rol): para lecturas */
export function verifyProjectAccess(projectId: string, userId: string): Promise<boolean> {
  return hasMembership(projectId, userId, false);
}

/** Miembro aceptado con rol owner o editor: para modificaciones */
export function verifyProjectWriteAccess(projectId: string, userId: string): Promise<boolean> {
  return hasMembership(projectId, userId, true);
}

export type ProjectRefs = {
  accountIds?: (string | null | undefined)[];
  categoryIds?: (string | null | undefined)[];
  budgetIds?: (string | null | undefined)[];
  savingsGoalIds?: (string | null | undefined)[];
  creditIds?: (string | null | undefined)[];
};

const REF_TABLES = {
  accountIds: { table: accounts, label: 'La cuenta' },
  categoryIds: { table: categories, label: 'La categoría' },
  budgetIds: { table: budgets, label: 'El presupuesto' },
  savingsGoalIds: { table: savingsGoals, label: 'La meta de ahorro' },
  creditIds: { table: credits, label: 'El crédito' },
} as const;

/**
 * Verifica que los ids referenciados (cuentas, categorías, presupuestos, metas,
 * créditos) sean del proyecto. Ignora vacíos. Devuelve el error o null.
 */
export async function projectRefsError(projectId: string, refs: ProjectRefs): Promise<string | null> {
  const checks = (Object.keys(REF_TABLES) as (keyof ProjectRefs)[]).flatMap((key) => {
    const ids = [...new Set((refs[key] ?? []).filter((id): id is string => Boolean(id)))];
    if (!ids.length) return [];
    const { table, label } = REF_TABLES[key];
    return [
      db
        .select({ id: table.id })
        .from(table)
        .where(and(inArray(table.id, ids), eq(table.projectId, projectId)))
        .then((rows) => (rows.length === ids.length ? null : `${label} no pertenece a este proyecto`)),
    ];
  });
  const errors = await Promise.all(checks);
  return errors.find(Boolean) ?? null;
}
