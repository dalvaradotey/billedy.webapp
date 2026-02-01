import type { InferSelectModel } from 'drizzle-orm';
import type { billingCycles } from '@/lib/db/schema';

export type BillingCycle = InferSelectModel<typeof billingCycles>;

export type BillingCycleStatus = 'open' | 'closed';

export type BillingCycleWithTotals = BillingCycle & {
  // Calculados en tiempo real (para ciclos abiertos)
  currentIncome: number;
  currentExpenses: number;
  currentSavings: number;
  currentBalance: number;
  // Días
  daysTotal: number;
  daysElapsed: number;
  daysRemaining: number;
};

export type BillingCycleSummary = {
  totalCycles: number;
  openCycles: number;
  closedCycles: number;
  currentCycle: BillingCycleWithTotals | null;
};
