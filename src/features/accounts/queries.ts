import { db } from '@/lib/db';
import { accounts, entities } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { cachedQuery, CACHE_TAGS } from '@/lib/cache';
import type { Account, AccountsSummary, AccountWithEntity } from './types';

/**
 * Query interna para obtener cuentas (sin caché)
 */
async function _getAccounts(userId: string): Promise<AccountWithEntity[]> {
  const result = await db
    .select({
      account: accounts,
      entity: entities,
    })
    .from(accounts)
    .leftJoin(entities, eq(accounts.entityId, entities.id))
    .where(and(eq(accounts.userId, userId), eq(accounts.isArchived, false)))
    .orderBy(desc(accounts.isDefault), accounts.name);

  return result.map((row) => ({
    ...row.account,
    entity: row.entity,
  }));
}

/**
 * Get all accounts for a user (with entity data)
 * Cacheada por 60 segundos
 */
export const getAccounts = cachedQuery(
  _getAccounts,
  ['accounts', 'list'],
  { tags: [CACHE_TAGS.accounts] }
);

/**
 * Query interna para obtener todas las cuentas (sin caché)
 */
async function _getAllAccounts(userId: string): Promise<AccountWithEntity[]> {
  const result = await db
    .select({
      account: accounts,
      entity: entities,
    })
    .from(accounts)
    .leftJoin(entities, eq(accounts.entityId, entities.id))
    .where(eq(accounts.userId, userId))
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
    .leftJoin(entities, eq(accounts.entityId, entities.id))
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);

  if (!result[0]) return null;

  return {
    ...result[0].account,
    entity: result[0].entity,
  };
}

/**
 * Get default account for a user
 * No cacheada porque se usa poco y puede cambiar frecuentemente
 */
export async function getDefaultAccount(userId: string): Promise<Account | null> {
  const result = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.isDefault, true),
        eq(accounts.isArchived, false)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * Query interna para resumen de cuentas
 */
async function _getAccountsSummary(userId: string): Promise<AccountsSummary> {
  const userAccounts = await _getAccounts(userId);

  let totalDebitBalance = 0;
  let totalCreditBalance = 0;

  for (const account of userAccounts) {
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
    totalAccounts: userAccounts.length,
    totalDebitBalance,
    totalCreditBalance,
    netWorth: totalDebitBalance - totalCreditBalance,
  };
}

/**
 * Get accounts summary for a user
 * Cacheada por 60 segundos
 */
export const getAccountsSummary = cachedQuery(
  _getAccountsSummary,
  ['accounts', 'summary'],
  { tags: [CACHE_TAGS.accounts, CACHE_TAGS.summary] }
);
