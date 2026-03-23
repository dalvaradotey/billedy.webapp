'use server';

import { db } from '@/lib/db';
import {
  projectMembers,
  transactions,
  accounts,
} from '@/lib/db/schema';
import { eq, and, isNotNull, gte, lte, sql } from 'drizzle-orm';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Verifica que el usuario tenga acceso al proyecto
 */
export async function verifyProjectAccess(
  projectId: string,
  userId: string
): Promise<boolean> {
  const member = await db
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

  return member.length > 0;
}

/**
 * Calcula totales de transacciones para un rango de fechas
 * Los ahorros se calculan desde transacciones con savingsGoalId (income)
 */
export async function calculateTotalsForRange(
  projectId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  income: number;
  expenses: number;
  savings: number;
  balance: number;
}> {
  // Excluir income de cuentas previsionales (pension, unemployment, savings) del conteo de ingresos
  const provisionTypes = ['pension', 'unemployment', 'savings'];
  const isNotProvision = sql`(${accounts.type} IS NULL OR ${accounts.type} NOT IN (${sql.join(provisionTypes.map(t => sql`${t}`), sql`, `)}))`;

  const transactionTotals = await db
    .select({
      totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' AND ${isNotProvision} THEN ${transactions.baseAmount} ELSE 0 END), 0)`,
      totalExpenses: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.baseAmount} ELSE 0 END), 0)`,
      totalSavings: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.savingsGoalId} IS NOT NULL AND ${transactions.type} = 'income' THEN ABS(${transactions.baseAmount}) ELSE 0 END), 0)`,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(transactions.projectId, projectId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    );

  const income = parseFloat(transactionTotals[0]?.totalIncome ?? '0');
  const expenses = parseFloat(transactionTotals[0]?.totalExpenses ?? '0');
  const savings = parseFloat(transactionTotals[0]?.totalSavings ?? '0');
  const balance = income - expenses - savings;

  return { income, expenses, savings, balance };
}
