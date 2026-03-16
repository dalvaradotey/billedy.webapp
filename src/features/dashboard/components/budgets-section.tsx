'use client';

import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { ResponsiveDrawer } from '@/components/ui/drawer';
import { BudgetProgressSlider } from '@/features/budgets/components/budget-progress-slider';
import { TransactionDialogContent } from '@/features/transactions';
import { useRegisterPageActions, type PageAction } from '@/components/layout/bottom-nav-context';
import { useDashboard } from '../hooks';
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

interface SavingsGoal {
  id: string;
  name: string;
}

interface DashboardBudgetsSectionProps {
  categories: Category[];
  accounts: AccountWithEntity[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  entities: Entity[];
  projectId: string;
  userId: string;
  defaultCurrency: string;
}

export function DashboardBudgetsSection({
  categories,
  accounts,
  budgets,
  savingsGoals,
  entities,
  projectId,
  userId,
  defaultCurrency,
}: DashboardBudgetsSectionProps) {
  const { budgetsProgress, applyOptimisticTransaction } = useDashboard();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [initialValues, setInitialValues] = useState<TransactionInitialValues | undefined>();
  // Key para forzar remontaje del componente al abrir el drawer (resetea estados internos como isPending)
  const [drawerKey, setDrawerKey] = useState(0);

  // Mapa de cuentas para buscar tipo rápidamente
  const accountsMap = useMemo(() => {
    const map = new Map<string, AccountWithEntity>();
    accounts.forEach((acc) => map.set(acc.id, acc));
    return map;
  }, [accounts]);

  const onMutationStart = useCallback(() => {
    // No-op
  }, []);

  const onMutationSuccess = useCallback((toastId: string | number, message: string) => {
    toast.success(message, { id: toastId });
  }, []);

  const onMutationError = useCallback((toastId: string | number, error: string) => {
    toast.error(error, { id: toastId });
  }, []);

  // Callback cuando se crea una transacción exitosamente
  const handleTransactionCreated = useCallback(
    (data: {
      type: 'expense' | 'income';
      amount: number;
      budgetId?: string;
      accountId: string;
      isPaid: boolean;
    }) => {
      const account = accountsMap.get(data.accountId);
      if (!account) return;

      applyOptimisticTransaction({
        type: data.type,
        amount: data.amount,
        budgetId: data.budgetId,
        accountId: data.accountId,
        accountType: account.type as 'checking' | 'savings' | 'cash' | 'credit_card',
        isPaid: data.isPaid,
      });
    },
    [accountsMap, applyOptimisticTransaction]
  );

  const handleAddTransaction = (budgetId: string) => {
    // Incrementar key para forzar remontaje del componente (resetea isPending y otros estados)
    setDrawerKey((k) => k + 1);
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

  // Abrir drawer sin presupuesto específico (desde el botón flotante o bottom nav)
  const handleOpenNewTransaction = useCallback(() => {
    setDrawerKey((k) => k + 1);
    setInitialValues(undefined);
    setIsDrawerOpen(true);
  }, []);

  // Registrar acción en el bottom nav móvil
  const pageActions = useMemo<PageAction[]>(() => [
    { label: 'Nueva transacción', icon: Plus, onClick: handleOpenNewTransaction },
  ], [handleOpenNewTransaction]);

  useRegisterPageActions(pageActions);

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
          key={drawerKey}
          projectId={projectId}
          userId={userId}
          categories={categories}
          accounts={accounts}
          budgets={budgets}
          savingsGoals={savingsGoals}
          entities={entities}
          transaction={null}
          defaultCurrency={defaultCurrency}
          onSuccess={handleDrawerClose}
          onMutationStart={onMutationStart}
          onMutationSuccess={onMutationSuccess}
          onMutationError={onMutationError}
          initialValues={initialValues}
          onTransactionCreated={handleTransactionCreated}
        />
      </ResponsiveDrawer>
    </>
  );
}
