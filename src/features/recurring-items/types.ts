import type { InferSelectModel } from 'drizzle-orm';
import type { recurringItems } from '@/lib/db/schema';

export type RecurringItem = InferSelectModel<typeof recurringItems>;

export type RecurringItemType = 'income' | 'expense';

export type RecurringItemWithCategory = RecurringItem & {
  categoryName: string;
  categoryColor: string;
};

export type RecurringItemSummary = {
  totalIncome: number;
  totalExpense: number;
  activeCount: number;
  inactiveCount: number;
};
