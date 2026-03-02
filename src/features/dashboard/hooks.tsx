'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useTransition,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { BudgetProgress } from '@/features/budgets/types';
import type { BillingCycleWithTotals } from '@/features/billing-cycles/types';
import type { AccountsSummary } from '@/features/accounts/types';
import type { OptimisticTransaction, DashboardContextValue, DashboardState } from './types';

// ============================================================================
// CONTEXT
// ============================================================================

const DashboardContext = createContext<DashboardContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

interface DashboardProviderProps {
  children: ReactNode;
  initialBudgetsProgress: BudgetProgress[];
  initialCycle: BillingCycleWithTotals | null;
  initialAccountsSummary: AccountsSummary;
  initialTotalExternalDebt: number;
}

export function DashboardProvider({
  children,
  initialBudgetsProgress,
  initialCycle,
  initialAccountsSummary,
  initialTotalExternalDebt,
}: DashboardProviderProps) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();

  // Estado optimista
  const [state, setState] = useState<DashboardState>({
    budgetsProgress: initialBudgetsProgress,
    cycle: initialCycle,
    accountsSummary: initialAccountsSummary,
    totalExternalDebt: initialTotalExternalDebt,
  });

  // Aplicar transacción optimistamente
  const applyOptimisticTransaction = useCallback(
    (transaction: OptimisticTransaction) => {
      setState((prev) => {
        const { type, amount, budgetId, accountType, isPaid } = transaction;

        // Solo actualizar si la transacción afecta balances (isPaid o es tarjeta de crédito)
        const affectsBalance = isPaid || accountType === 'credit_card';

        // 1. Actualizar presupuestos si hay budgetId
        let newBudgetsProgress = prev.budgetsProgress;
        if (budgetId && type === 'expense') {
          newBudgetsProgress = prev.budgetsProgress.map((budget) => {
            if (budget.id !== budgetId) return budget;

            const newSpentAmount = budget.spentAmount + amount;
            const newRemainingAmount = budget.budgetedAmount - newSpentAmount;
            const newProgressPercentage =
              budget.budgetedAmount > 0
                ? Math.min(100, Math.round((newSpentAmount / budget.budgetedAmount) * 100))
                : 0;

            return {
              ...budget,
              spentAmount: newSpentAmount,
              remainingAmount: newRemainingAmount,
              progressPercentage: newProgressPercentage,
            };
          });
        }

        // 2. Actualizar ciclo
        let newCycle = prev.cycle;
        if (prev.cycle && affectsBalance) {
          const incomeChange = type === 'income' ? amount : 0;
          const expenseChange = type === 'expense' ? amount : 0;

          newCycle = {
            ...prev.cycle,
            currentIncome: prev.cycle.currentIncome + incomeChange,
            currentExpenses: prev.cycle.currentExpenses + expenseChange,
            paidIncome: prev.cycle.paidIncome + (type === 'income' && isPaid ? amount : 0),
            pendingIncome: prev.cycle.pendingIncome + (type === 'income' && !isPaid ? amount : 0),
            paidExpenses: prev.cycle.paidExpenses + (type === 'expense' && isPaid ? amount : 0),
            pendingExpenses: prev.cycle.pendingExpenses + (type === 'expense' && !isPaid ? amount : 0),
            currentBalance: isPaid
              ? prev.cycle.currentBalance + (type === 'income' ? amount : -amount)
              : prev.cycle.currentBalance,
          };
        }

        // 3. Actualizar resumen de cuentas
        let newAccountsSummary = prev.accountsSummary;
        if (affectsBalance) {
          const balanceChange = type === 'income' ? amount : -amount;

          if (accountType === 'credit_card') {
            // Para tarjetas de crédito, los gastos aumentan la deuda
            newAccountsSummary = {
              ...prev.accountsSummary,
              totalCreditBalance:
                prev.accountsSummary.totalCreditBalance + (type === 'expense' ? amount : -amount),
              netWorth:
                prev.accountsSummary.netWorth - (type === 'expense' ? amount : -amount),
            };
          } else {
            // Para cuentas de débito
            newAccountsSummary = {
              ...prev.accountsSummary,
              totalDebitBalance: prev.accountsSummary.totalDebitBalance + balanceChange,
              netWorth: prev.accountsSummary.netWorth + balanceChange,
            };
          }
        }

        return {
          budgetsProgress: newBudgetsProgress,
          cycle: newCycle,
          accountsSummary: newAccountsSummary,
          totalExternalDebt: prev.totalExternalDebt,
        };
      });

      // Refrescar datos del servidor en background
      startTransition(() => {
        router.refresh();
      });
    },
    [router]
  );

  // Refrescar dashboard manualmente
  const refreshDashboard = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  // Track si hubo una actualización optimista pendiente de sincronizar
  const pendingSync = useRef(false);

  // Marcar que hay una actualización pendiente cuando aplicamos optimistic update
  const applyOptimisticTransactionWithSync = useCallback(
    (transaction: OptimisticTransaction) => {
      pendingSync.current = true;
      applyOptimisticTransaction(transaction);
    },
    [applyOptimisticTransaction]
  );

  // Sincronizar estado cuando cambian los props iniciales (después de router.refresh)
  useEffect(() => {
    // Solo sincronizar si hubo una actualización optimista pendiente
    // o si los datos del servidor son diferentes
    if (pendingSync.current) {
      setState({
        budgetsProgress: initialBudgetsProgress,
        cycle: initialCycle,
        accountsSummary: initialAccountsSummary,
        totalExternalDebt: initialTotalExternalDebt,
      });
      pendingSync.current = false;
    }
  }, [initialBudgetsProgress, initialCycle, initialAccountsSummary, initialTotalExternalDebt]);

  const value: DashboardContextValue = {
    budgetsProgress: state.budgetsProgress,
    cycle: state.cycle,
    accountsSummary: state.accountsSummary,
    totalExternalDebt: state.totalExternalDebt,
    applyOptimisticTransaction: applyOptimisticTransactionWithSync,
    refreshDashboard,
    isRefreshing,
  };

  return (
    <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
