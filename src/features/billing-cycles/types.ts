import type { InferSelectModel } from 'drizzle-orm';
import type { billingCycles } from '@/lib/db/schema';
import type { CycleBalance } from './lib/cycle-balance';

export type { Amounts, CycleBalance, CycleWarning } from './lib/cycle-balance';

export type BillingCycle = InferSelectModel<typeof billingCycles>;

export type BillingCycleStatus = 'open' | 'closed';

export type BillingCycleWithTotals = BillingCycle & {
  // Saldo de caja (cascada única, calculado en vivo para abiertos y cerrados)
  balance: CycleBalance;
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
