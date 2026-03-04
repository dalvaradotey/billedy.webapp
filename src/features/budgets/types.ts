import type { InferSelectModel } from 'drizzle-orm';
import type { budgets } from '@/lib/db/schema';

export type Budget = InferSelectModel<typeof budgets>;

export type BudgetWithCategory = Budget & {
  categoryName: string | null;
  categoryColor: string | null;
  accountName: string | null;
};

export type BudgetProgress = {
  id: string;
  name: string;
  budgetedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  progressPercentage: number;
  categoryName: string | null;
  categoryColor: string | null;
  categoryId: string | null;
  defaultAccountId: string | null;
  startDate: Date | null;
  endDate: Date | null;
};
