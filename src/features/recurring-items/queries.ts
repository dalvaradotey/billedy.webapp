import { db } from '@/lib/db';
import { recurringItems, categories, projectMembers } from '@/lib/db/schema';
import { eq, and, desc, sql, isNotNull } from 'drizzle-orm';
import type {
  RecurringItem,
  RecurringItemWithCategory,
  RecurringItemSummary,
} from './types';

/**
 * Obtiene todos los items recurrentes del proyecto
 */
export async function getRecurringItems(
  projectId: string,
  userId: string
): Promise<RecurringItemWithCategory[]> {
  const result = await db
    .select({
      id: recurringItems.id,
      userId: recurringItems.userId,
      projectId: recurringItems.projectId,
      categoryId: recurringItems.categoryId,
      accountId: recurringItems.accountId,
      type: recurringItems.type,
      name: recurringItems.name,
      amount: recurringItems.amount,
      currencyId: recurringItems.currencyId,
      dayOfMonth: recurringItems.dayOfMonth,
      isActive: recurringItems.isActive,
      createdAt: recurringItems.createdAt,
      updatedAt: recurringItems.updatedAt,
      categoryName: categories.name,
      categoryColor: categories.color,
    })
    .from(recurringItems)
    .innerJoin(categories, eq(recurringItems.categoryId, categories.id))
    .innerJoin(projectMembers, eq(recurringItems.projectId, projectMembers.projectId))
    .where(
      and(
        eq(recurringItems.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .orderBy(desc(recurringItems.isActive), recurringItems.name);

  return result;
}

/**
 * Obtiene items recurrentes activos del proyecto
 */
export async function getActiveRecurringItems(
  projectId: string,
  userId: string
): Promise<RecurringItemWithCategory[]> {
  const result = await db
    .select({
      id: recurringItems.id,
      userId: recurringItems.userId,
      projectId: recurringItems.projectId,
      categoryId: recurringItems.categoryId,
      accountId: recurringItems.accountId,
      type: recurringItems.type,
      name: recurringItems.name,
      amount: recurringItems.amount,
      currencyId: recurringItems.currencyId,
      dayOfMonth: recurringItems.dayOfMonth,
      isActive: recurringItems.isActive,
      createdAt: recurringItems.createdAt,
      updatedAt: recurringItems.updatedAt,
      categoryName: categories.name,
      categoryColor: categories.color,
    })
    .from(recurringItems)
    .innerJoin(categories, eq(recurringItems.categoryId, categories.id))
    .innerJoin(projectMembers, eq(recurringItems.projectId, projectMembers.projectId))
    .where(
      and(
        eq(recurringItems.projectId, projectId),
        eq(recurringItems.isActive, true),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .orderBy(recurringItems.name);

  return result;
}

/**
 * Obtiene un item recurrente por ID
 */
export async function getRecurringItemById(
  itemId: string,
  userId: string
): Promise<RecurringItemWithCategory | null> {
  const result = await db
    .select({
      id: recurringItems.id,
      userId: recurringItems.userId,
      projectId: recurringItems.projectId,
      categoryId: recurringItems.categoryId,
      accountId: recurringItems.accountId,
      type: recurringItems.type,
      name: recurringItems.name,
      amount: recurringItems.amount,
      currencyId: recurringItems.currencyId,
      dayOfMonth: recurringItems.dayOfMonth,
      isActive: recurringItems.isActive,
      createdAt: recurringItems.createdAt,
      updatedAt: recurringItems.updatedAt,
      categoryName: categories.name,
      categoryColor: categories.color,
    })
    .from(recurringItems)
    .innerJoin(categories, eq(recurringItems.categoryId, categories.id))
    .innerJoin(projectMembers, eq(recurringItems.projectId, projectMembers.projectId))
    .where(
      and(
        eq(recurringItems.id, itemId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * Obtiene resumen de items recurrentes del proyecto
 */
export async function getRecurringItemsSummary(
  projectId: string,
  userId: string
): Promise<RecurringItemSummary> {
  const result = await db
    .select({
      type: recurringItems.type,
      isActive: recurringItems.isActive,
      totalAmount: sql<string>`SUM(${recurringItems.amount})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(recurringItems)
    .innerJoin(projectMembers, eq(recurringItems.projectId, projectMembers.projectId))
    .where(
      and(
        eq(recurringItems.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .groupBy(recurringItems.type, recurringItems.isActive);

  let totalIncome = 0;
  let totalExpense = 0;
  let activeCount = 0;
  let inactiveCount = 0;

  for (const row of result) {
    const amount = parseFloat(row.totalAmount ?? '0');
    const count = Number(row.count);

    if (row.isActive) {
      if (row.type === 'income') {
        totalIncome += amount;
      } else {
        totalExpense += amount;
      }
      activeCount += count;
    } else {
      inactiveCount += count;
    }
  }

  return {
    totalIncome,
    totalExpense,
    activeCount,
    inactiveCount,
  };
}
