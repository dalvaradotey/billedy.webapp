import type { InferSelectModel } from 'drizzle-orm';
import type { savingsGoals } from '@/lib/db/schema';

export type SavingsGoal = InferSelectModel<typeof savingsGoals>;

export type SavingsGoalType = 'emergency' | 'investment' | 'goal' | 'other';

export type SavingsGoalWithProgress = SavingsGoal & {
  currencyCode: string;
  progressPercentage: number;
  currentBalance: number;
};

export type SavingsFilter = 'active' | 'completed' | 'archived';

export type SavingsSummary = {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  totalBalance: number;
  totalTargetAmount: number;
  overallProgress: number;
};
