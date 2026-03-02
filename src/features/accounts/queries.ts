import { db } from '@/lib/db';
import { accounts, entities, projectMembers, cardPurchases, transactions } from '@/lib/db/schema';
import { eq, and, desc, isNotNull, or, sql } from 'drizzle-orm';
import { cachedQuery, CACHE_TAGS } from '@/lib/cache';
import type { Account, AccountsSummary, AccountWithEntity, AccountDebtBreakdown } from './types';

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

/**
 * Query interna para obtener desglose de deuda por cuenta TC
 * Calcula deuda personal vs externa desde card_purchases
 */
async function _getAccountDebtBreakdown(
  projectId: string,
  userId: string
): Promise<Record<string, AccountDebtBreakdown>> {
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

  if (hasAccess.length === 0) return {};

  const purchases = await db
    .select({
      id: cardPurchases.id,
      accountId: cardPurchases.accountId,
      isExternalDebt: cardPurchases.isExternalDebt,
      installments: cardPurchases.installments,
      installmentAmount: cardPurchases.installmentAmount,
    })
    .from(cardPurchases)
    .where(
      and(
        eq(cardPurchases.projectId, projectId),
        eq(cardPurchases.isActive, true)
      )
    );

  if (purchases.length === 0) return {};

  const paidByPurchase = await db
    .select({
      cardPurchaseId: transactions.cardPurchaseId,
      paidCount: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.projectId, projectId),
        isNotNull(transactions.cardPurchaseId),
        or(
          eq(transactions.isHistoricallyPaid, true),
          isNotNull(transactions.paidByTransferId)
        )
      )
    )
    .groupBy(transactions.cardPurchaseId);

  const paidMap = new Map<string, number>();
  for (const row of paidByPurchase) {
    if (row.cardPurchaseId) {
      paidMap.set(row.cardPurchaseId, Number(row.paidCount));
    }
  }

  const result: Record<string, AccountDebtBreakdown> = {};

  for (const p of purchases) {
    const paidInstallments = paidMap.get(p.id) ?? 0;
    const remaining = p.installments - paidInstallments;
    if (remaining <= 0) continue;

    const remainingAmount = remaining * parseFloat(p.installmentAmount);

    if (!result[p.accountId]) {
      result[p.accountId] = { personalDebt: 0, externalDebt: 0 };
    }

    // Solo rastreamos externalDebt desde card_purchases
    // personalDebt se calcula en el componente como: saldo total - externalDebt
    if (p.isExternalDebt) {
      result[p.accountId].externalDebt += remainingAmount;
    }
  }

  for (const key of Object.keys(result)) {
    result[key].externalDebt = Math.round(result[key].externalDebt);
  }

  return result;
}

/**
 * Desglose de deuda personal vs externa por cuenta TC
 * Cacheada por 60 segundos
 */
export const getAccountDebtBreakdown = cachedQuery(
  _getAccountDebtBreakdown,
  ['accounts', 'debt-breakdown'],
  { tags: [CACHE_TAGS.cardPurchases, CACHE_TAGS.transactions] }
);
