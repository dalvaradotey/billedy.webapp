import type { InferSelectModel } from 'drizzle-orm';
import type { transactions } from '@/lib/db/schema';

export type Transaction = InferSelectModel<typeof transactions>;

export type TransactionType = 'income' | 'expense';

export type TransactionWithCategory = Transaction & {
  categoryName: string | null;
  categoryColor: string | null;
  accountName: string | null;
  budgetName: string | null;
  entityName: string | null;
  entityImageUrl: string | null;
};

export type TransactionFilters = {
  type?: TransactionType;
  categoryId?: string;
  isPaid?: boolean;
  isReconciled?: boolean;
  nature?: import('./nature').TransactionNature;
  startDate?: Date;
  endDate?: Date;
  search?: string;
};

export type TransactionSummary = {
  totalIncome: number;
  totalExpense: number;
  paidIncome: number;
  pendingIncome: number;
  paidExpense: number;
  pendingExpense: number;
  /** Saldo de caja del período (misma cascada que los ciclos) */
  balance: number;
  paidCount: number;
  pendingCount: number;
};

export type { ActionResult } from '@/types/action-result';
