import { db } from '@/lib/db';
import { accounts, entities, projectMembers } from '@/lib/db/schema';
import { eq, and, desc, isNotNull } from 'drizzle-orm';
import { cachedQuery, CACHE_TAGS } from '@/lib/cache';
import type { Account, AccountsSummary, AccountWithEntity } from './types';

/**
 * Query interna para obtener cuentas del proyecto (sin caché)
 * Verifica membresía del usuario al proyecto
 */
async function _getAccounts(
  projectId: string,
  userId: string
): Promise<AccountWithEntity[]> {
  const result = await db
    .select({
      account: accounts,
      entity: entities,
    })
    .from(accounts)
    .innerJoin(
      projectMembers,
      eq(accounts.projectId, projectMembers.projectId)
    )
    .leftJoin(entities, eq(accounts.entityId, entities.id))
    .where(
      and(
        eq(accounts.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt),
        eq(accounts.isArchived, false)
      )
    )
    .orderBy(desc(accounts.isDefault), accounts.name);

  return result.map((row) => ({
    ...row.account,
    entity: row.entity,
  }));
}

/**
 * Get all accounts for a project (with entity data)
 * Verifica membresía del usuario
 * Cacheada por 60 segundos
 */
export const getAccounts = cachedQuery(
  _getAccounts,
  ['accounts', 'list'],
  { tags: [CACHE_TAGS.accounts] }
);

/**
 * Query interna para obtener todas las cuentas incluyendo archivadas (sin caché)
 */
async function _getAllAccounts(
  projectId: string,
  userId: string
): Promise<AccountWithEntity[]> {
  const result = await db
    .select({
      account: accounts,
      entity: entities,
    })
    .from(accounts)
    .innerJoin(
      projectMembers,
      eq(accounts.projectId, projectMembers.projectId)
    )
    .leftJoin(entities, eq(accounts.entityId, entities.id))
    .where(
      and(
        eq(accounts.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .orderBy(desc(accounts.isDefault), accounts.name);

  return result.map((row) => ({
    ...row.account,
    entity: row.entity,
  }));
}

/**
 * Get all accounts including archived (with entity data)
 * Cacheada por 60 segundos
 */
export const getAllAccounts = cachedQuery(
  _getAllAccounts,
  ['accounts', 'all'],
  { tags: [CACHE_TAGS.accounts] }
);

/**
 * Get account by ID (with entity data)
 * Verifica membresía del usuario al proyecto
 * No cacheada porque es una consulta puntual
 */
export async function getAccountById(
  accountId: string,
  userId: string
): Promise<AccountWithEntity | null> {
  const result = await db
    .select({
      account: accounts,
      entity: entities,
    })
    .from(accounts)
    .innerJoin(
      projectMembers,
      eq(accounts.projectId, projectMembers.projectId)
    )
    .leftJoin(entities, eq(accounts.entityId, entities.id))
    .where(
      and(
        eq(accounts.id, accountId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!result[0]) return null;

  return {
    ...result[0].account,
    entity: result[0].entity,
  };
}

/**
 * Get default account for a project
 * No cacheada porque se usa poco y puede cambiar frecuentemente
 */
export async function getDefaultAccount(
  projectId: string,
  userId: string
): Promise<Account | null> {
  const result = await db
    .select({ account: accounts })
    .from(accounts)
    .innerJoin(
      projectMembers,
      eq(accounts.projectId, projectMembers.projectId)
    )
    .where(
      and(
        eq(accounts.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt),
        eq(accounts.isDefault, true),
        eq(accounts.isArchived, false)
      )
    )
    .limit(1);

  return result[0]?.account ?? null;
}

/**
 * Query interna para resumen de cuentas del proyecto
 */
async function _getAccountsSummary(
  projectId: string,
  userId: string
): Promise<AccountsSummary> {
  const projectAccounts = await _getAccounts(projectId, userId);

  let totalDebitBalance = 0;
  let totalCreditBalance = 0;

  for (const account of projectAccounts) {
    const balance = parseFloat(account.currentBalance);

    if (account.type === 'credit_card') {
      // For credit cards, the balance represents what you owe
      totalCreditBalance += Math.abs(balance);
    } else {
      // For debit accounts (checking, savings, cash)
      totalDebitBalance += balance;
    }
  }

  return {
    totalAccounts: projectAccounts.length,
    totalDebitBalance,
    totalCreditBalance,
    netWorth: totalDebitBalance - totalCreditBalance,
  };
}

/**
 * Get accounts summary for a project
 * Cacheada por 60 segundos
 */
export const getAccountsSummary = cachedQuery(
  _getAccountsSummary,
  ['accounts', 'summary'],
  { tags: [CACHE_TAGS.accounts, CACHE_TAGS.summary] }
);

/**
 * Query interna para obtener resumen Y lista de cuentas en una sola llamada
 * Optimización para el dashboard que necesita ambos datos
 */
async function _getAccountsSummaryWithAccounts(
  projectId: string,
  userId: string
): Promise<{ summary: AccountsSummary; accounts: AccountWithEntity[] }> {
  const projectAccounts = await _getAccounts(projectId, userId);

  let totalDebitBalance = 0;
  let totalCreditBalance = 0;

  for (const account of projectAccounts) {
    const balance = parseFloat(account.currentBalance);

    if (account.type === 'credit_card') {
      totalCreditBalance += Math.abs(balance);
    } else {
      totalDebitBalance += balance;
    }
  }

  return {
    summary: {
      totalAccounts: projectAccounts.length,
      totalDebitBalance,
      totalCreditBalance,
      netWorth: totalDebitBalance - totalCreditBalance,
    },
    accounts: projectAccounts,
  };
}

/**
 * Get accounts summary AND accounts list in a single call
 * Optimizado para el dashboard - evita llamadas duplicadas
 * Cacheada por 60 segundos
 */
export const getAccountsSummaryWithAccounts = cachedQuery(
  _getAccountsSummaryWithAccounts,
  ['accounts', 'summary-with-list'],
  { tags: [CACHE_TAGS.accounts, CACHE_TAGS.summary] }
);
