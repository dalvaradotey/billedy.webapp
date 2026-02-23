'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { ResponsiveDrawer } from '@/components/ui/drawer';
import { BudgetProgressSlider } from '@/features/budgets/components/budget-progress-slider';
import { TransactionDialogContent } from '@/features/transactions';
import type { BudgetProgress } from '@/features/budgets/types';
import type { TransactionInitialValues } from '@/features/transactions';
import type { Category } from '@/features/categories/types';
import type { AccountWithEntity } from '@/features/accounts/types';
import type { Entity } from '@/features/entities/types';

interface Budget {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  defaultAccountId?: string | null;
}

interface DashboardBudgetsSectionProps {
  budgetsProgress: BudgetProgress[];
  categories: Category[];
  accounts: AccountWithEntity[];
  budgets: Budget[];
  entities: Entity[];
  projectId: string;
  userId: string;
  defaultCurrency: string;
}

export function DashboardBudgetsSection({
  budgetsProgress,
  categories,
  accounts,
  budgets,
  entities,
  projectId,
  userId,
  defaultCurrency,
}: DashboardBudgetsSectionProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [initialValues, setInitialValues] = useState<TransactionInitialValues | undefined>();

  const onMutationStart = useCallback(() => {
    // No-op
  }, []);

  const onMutationSuccess = useCallback((toastId: string | number, message: string) => {
    toast.success(message, { id: toastId });
  }, []);

  const onMutationError = useCallback((toastId: string | number, error: string) => {
    toast.error(error, { id: toastId });
  }, []);

  const handleAddTransaction = (budgetId: string) => {
    // Find the budget to get its category and account
    const budget = budgetsProgress.find((b) => b.id === budgetId);
    if (budget) {
      setInitialValues({
        budgetId,
        categoryId: budget.categoryId ?? undefined,
        accountId: budget.defaultAccountId ?? undefined,
        type: 'expense',
      });
    } else {
      setInitialValues({ budgetId, type: 'expense' });
    }
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setInitialValues(undefined);
  };

  return (
    <>
      <BudgetProgressSlider
        budgets={budgetsProgress}
        onAddTransaction={handleAddTransaction}
      />

      <ResponsiveDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <TransactionDialogContent
          projectId={projectId}
          userId={userId}
          categories={categories}
          accounts={accounts}
          budgets={budgets}
          entities={entities}
          transaction={null}
          defaultCurrency={defaultCurrency}
          onSuccess={handleDrawerClose}
          onMutationStart={onMutationStart}
          onMutationSuccess={onMutationSuccess}
          onMutationError={onMutationError}
          initialValues={initialValues}
        />
      </ResponsiveDrawer>
    </>
  );
}
