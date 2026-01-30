import type { InferSelectModel } from 'drizzle-orm';
import type { transactions, categories } from '@/lib/db/schema';

export type Transaction = InferSelectModel<typeof transactions>;

export type TransactionType = 'income' | 'expense';

export type TransactionWithCategory = Transaction & {
  categoryName: string;
  categoryColor: string;
};

export type TransactionFilters = {
  type?: TransactionType;
  categoryId?: string;
  isPaid?: boolean;
  startDate?: Date;
  endDate?: Date;
  search?: string;
};

export type TransactionSummary = {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  paidCount: number;
  pendingCount: number;
};
