'use client';

import type { ReactNode } from 'react';
import { DashboardProvider } from '../hooks';
import type { BudgetProgress } from '@/features/budgets/types';
import type { BillingCycleWithTotals } from '@/features/billing-cycles/types';
import type { AccountsSummary } from '@/features/accounts/types';

interface DashboardClientWrapperProps {
  children: ReactNode;
  budgetsProgress: BudgetProgress[];
  cycle: BillingCycleWithTotals | null;
  accountsSummary: AccountsSummary;
  totalExternalDebt: number;
}

export function DashboardClientWrapper({
  children,
  budgetsProgress,
  cycle,
  accountsSummary,
  totalExternalDebt,
}: DashboardClientWrapperProps) {
  return (
    <DashboardProvider
      initialBudgetsProgress={budgetsProgress}
      initialCycle={cycle}
      initialAccountsSummary={accountsSummary}
      initialTotalExternalDebt={totalExternalDebt}
    >
      {children}
    </DashboardProvider>
  );
}
