'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { toast } from 'sonner';
import { Unlink, Receipt } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cardStyles } from '@/components/card-styles';
import { formatCurrency, formatDate } from '@/lib/formatting';
import { cn } from '@/lib/utils';

import { fetchGoalTransactions, unlinkTransactionFromGoal } from '../actions';
import type { TransactionWithCategory } from '@/features/transactions/types';

interface SavingsGoalTransactionsProps {
  goalId: string;
  userId: string;
  currencyCode: string;
}

export function SavingsGoalTransactions({
  goalId,
  userId,
  currencyCode,
}: SavingsGoalTransactionsProps) {
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadTransactions = useCallback(() => {
    startTransition(async () => {
      const result = await fetchGoalTransactions(goalId, userId);
      if (result.success) {
        setTransactions(result.data);
      }
      setIsLoading(false);
    });
  }, [goalId, userId]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleUnlink = (transactionId: string, description: string) => {
    const toastId = toast.loading('Desvinculando transacción...');
    startTransition(async () => {
      const result = await unlinkTransactionFromGoal(transactionId, userId);
      if (result.success) {
        toast.success(`"${description}" desvinculada`, { id: toastId });
        setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
      } else {
        toast.error(result.error, { id: toastId });
      }
    });
  };

  if (isLoading) {
    return (
      <div className={cardStyles.detailsContainer}>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3.5 w-40" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className={cardStyles.detailsContainer}>
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <Receipt className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No hay transacciones vinculadas</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cardStyles.detailsContainer}>
      <div className="flex items-center justify-between mb-1">
        <p className={cardStyles.detailsLabel}>
          {transactions.length} transacci{transactions.length === 1 ? 'ón' : 'ones'}
        </p>
      </div>
      <div className="space-y-0.5">
        {transactions.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 py-2 px-1 rounded-lg group"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {formatDate(t.date)}
                </span>
                <span className="text-sm truncate">{t.description}</span>
              </div>
              {t.categoryName && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: t.categoryColor ?? undefined }}
                  />
                  <span className="text-xs text-muted-foreground truncate">{t.categoryName}</span>
                </div>
              )}
            </div>
            <span
              className={cn(
                'text-sm font-semibold tabular-nums shrink-0',
                t.type === 'income'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              )}
            >
              {t.type === 'income' ? '+' : '-'}
              {formatCurrency(Math.abs(parseFloat(t.originalAmount)), currencyCode)}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUnlink(t.id, t.description);
              }}
              disabled={isPending}
              className="shrink-0 p-1.5 rounded-md text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              title="Desvincular de esta meta"
            >
              <Unlink className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
