import type { InferSelectModel } from 'drizzle-orm';
import type { savingsFunds, savingsMovements } from '@/lib/db/schema';

export type SavingsFund = InferSelectModel<typeof savingsFunds>;
export type SavingsMovement = InferSelectModel<typeof savingsMovements>;

export type SavingsFundType = 'emergency' | 'investment' | 'goal' | 'other';
export type SavingsMovementType = 'deposit' | 'withdrawal';

export type SavingsFundWithProgress = SavingsFund & {
  currencyCode: string;
  progressPercentage: number;
  monthlyDeposited: number;
  monthlyPercentage: number;
  recentMovements: SavingsMovement[];
};

export type SavingsSummary = {
  totalFunds: number;
  activeFunds: number;
  totalBalance: number;
  totalTargetAmount: number;
  monthlyTargetTotal: number;
  monthlyDepositedTotal: number;
  overallProgress: number;
};
