'use client';

import type { ReactNode } from 'react';
import { DashboardProvider } from './dashboard-context';
import type { BudgetProgress } from '@/features/budgets/types';
import type { BillingCycleWithTotals } from '@/features/billing-cycles/types';
import type { AccountsSummary } from '@/features/accounts/types';

interface DashboardClientWrapperProps {
  children: ReactNode;
  budgetsProgress: BudgetProgress[];
  cycle: BillingCycleWithTotals | null;
  accountsSummary: AccountsSummary;
}

/**
 * Wrapper del cliente que envuelve el contenido del dashboard
 * Proporciona el contexto para estado optimista y animaciones
 */
export function DashboardClientWrapper({
  children,
  budgetsProgress,
  cycle,
  accountsSummary,
}: DashboardClientWrapperProps) {
  return (
    <DashboardProvider
      initialBudgetsProgress={budgetsProgress}
      initialCycle={cycle}
      initialAccountsSummary={accountsSummary}
    >
      {children}
    </DashboardProvider>
  );
}
