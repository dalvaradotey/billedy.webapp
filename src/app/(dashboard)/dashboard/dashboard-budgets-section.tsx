'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResponsiveDrawer } from '@/components/ui/drawer';
import { BudgetProgressSlider } from '@/features/budgets/components/budget-progress-slider';
import { TransactionDialogContent } from '@/features/transactions';
import { useDashboard } from './dashboard-context';
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
  categories: Category[];
  accounts: AccountWithEntity[];
  budgets: Budget[];
  entities: Entity[];
  projectId: string;
  userId: string;
  defaultCurrency: string;
}

export function DashboardBudgetsSection({
  categories,
  accounts,
  budgets,
  entities,
  projectId,
  userId,
  defaultCurrency,
}: DashboardBudgetsSectionProps) {
  const { budgetsProgress, applyOptimisticTransaction } = useDashboard();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [initialValues, setInitialValues] = useState<TransactionInitialValues | undefined>();
  // Key para forzar remontaje del componente al abrir el drawer (resetea estados internos como isPending)
  const drawerKeyRef = useRef(0);

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
    drawerKeyRef.current += 1;
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

  // Abrir drawer sin presupuesto específico (desde el botón flotante)
  const handleOpenNewTransaction = () => {
    drawerKeyRef.current += 1;
    setInitialValues(undefined);
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

      {/* Floating Action Button - Aurora Glow */}
      <div
        className="fixed bottom-6 right-4 md:bottom-8 md:right-8 z-40"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Pulsing glow rings - subtle */}
        <div className="absolute inset-1 md:inset-2 rounded-full bg-gradient-to-r from-blue-500 via-emerald-400 to-cyan-400 opacity-90 blur-md md:blur-lg animate-pulse" />
        <div className="absolute inset-0 md:inset-1 rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-500 opacity-90 blur-sm md:blur-md animate-fab-glow" />

        {/* Button with animated gradient border */}
        <button
          onClick={handleOpenNewTransaction}
          className="relative w-14 h-14 md:w-16 md:h-16 rounded-full bg-slate-900 flex items-center justify-center active:scale-90 transition-transform"
        >
          {/* Rotating gradient border */}
          <div className="absolute inset-0 rounded-full bg-gradient-conic animate-spin-slow" />

          {/* Inner circle */}
          <div className="absolute inset-[2px] md:inset-[3px] rounded-full bg-slate-900 flex items-center justify-center">
            <Plus className="w-7 h-7 md:w-8 md:h-8 text-white" strokeWidth={2.5} />
          </div>
        </button>
      </div>

      <ResponsiveDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <TransactionDialogContent
          key={drawerKeyRef.current}
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
          onTransactionCreated={handleTransactionCreated}
        />
      </ResponsiveDrawer>
    </>
  );
}
