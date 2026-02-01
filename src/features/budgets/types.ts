import type { InferSelectModel } from 'drizzle-orm';
import type { budgets } from '@/lib/db/schema';

export type Budget = InferSelectModel<typeof budgets>;

export type BudgetWithCategory = Budget & {
  categoryName: string | null;
  categoryColor: string | null;
};
