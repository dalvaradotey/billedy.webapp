import type { InferSelectModel } from 'drizzle-orm';
import type { budgets } from '@/lib/db/schema';

export type Budget = InferSelectModel<typeof budgets>;

export type BudgetWithProgress = Budget & {
  categoryName: string;
  categoryColor: string;
  categoryType: 'income' | 'expense';
  spent: number;
  remaining: number;
  percentage: number;
  isOverBudget: boolean;
};

export type BudgetSummary = {
  totalBudgeted: number;
  totalSpent: number;
  totalRemaining: number;
  categoriesOverBudget: number;
  categoriesOnTrack: number;
};

export type BudgetPeriod = {
  year: number;
  month: number;
};
