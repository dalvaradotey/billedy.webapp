import type { BudgetProgress } from '@/features/budgets/types';
import type { BillingCycleWithTotals } from '@/features/billing-cycles/types';
import type { AccountsSummary } from '@/features/accounts/types';

export interface OptimisticTransaction {
  type: 'expense' | 'income';
  amount: number;
  budgetId?: string;
  accountId: string;
  accountType: 'checking' | 'savings' | 'cash' | 'credit_card' | 'pension' | 'unemployment';
  isPaid: boolean;
}

export interface DashboardState {
  budgetsProgress: BudgetProgress[];
  cycle: BillingCycleWithTotals | null;
  accountsSummary: AccountsSummary;
  totalExternalDebt: number;
}

export interface DashboardContextValue {
  // State
  budgetsProgress: BudgetProgress[];
  cycle: BillingCycleWithTotals | null;
  accountsSummary: AccountsSummary;
  totalExternalDebt: number;

  // Actions
  applyOptimisticTransaction: (transaction: OptimisticTransaction) => void;
  refreshDashboard: () => void;
  isRefreshing: boolean;
}
