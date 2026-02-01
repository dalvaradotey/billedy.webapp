import { db } from '@/lib/db';
import { accounts, entities } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { Account, AccountsSummary, AccountWithEntity } from './types';

/**
 * Get all accounts for a user (with entity data)
 */
export async function getAccounts(userId: string): Promise<AccountWithEntity[]> {
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
 * Get all accounts including archived (with entity data)
 */
export async function getAllAccounts(userId: string): Promise<AccountWithEntity[]> {
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
 * Get account by ID (with entity data)
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
 * Get accounts summary for a user
 */
export async function getAccountsSummary(userId: string): Promise<AccountsSummary> {
  const userAccounts = await getAccounts(userId);

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
