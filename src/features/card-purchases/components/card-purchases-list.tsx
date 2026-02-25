'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { CreditCard, Receipt } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';

import { chargeAllPendingInstallments } from '../actions';
import type { CardPurchaseWithDetails, CardPurchasesSummary, DebtCapacityReport } from '../types';
import type { AccountWithEntity } from '@/features/accounts/types';
import type { Category } from '@/features/categories/types';
import type { Entity } from '@/features/entities/types';

import { SummaryCards } from './summary-cards';
import { CardPurchaseCard } from './card-purchase-card';
import { CardPurchaseCardSkeleton } from './card-purchase-card-skeleton';
import { CreatePurchaseDialog } from './create-purchase-dialog';

interface CardPurchasesListProps {
  purchases: CardPurchaseWithDetails[];
  summary: CardPurchasesSummary;
  debtCapacity: DebtCapacityReport;
  accounts: AccountWithEntity[];
  categories: Category[];
  entities: Entity[];
  projectId: string;
  userId: string;
}

export function CardPurchasesList({
  purchases,
  summary,
  debtCapacity,
  accounts,
  categories,
  entities,
  projectId,
  userId,
}: CardPurchasesListProps) {
  const router = useRouter();
  const [showActive, setShowActive] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingToast, setPendingToast] = useState<{
    id: string | number;
    message: string;
  } | null>(null);

  const prevPurchasesRef = useRef(purchases);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const dataChanged =
      purchases !== prevPurchasesRef.current ||
      purchases.length !== prevPurchasesRef.current.length;

    if (isRefreshing && dataChanged) {
      if (pendingToast) {
        toast.success(pendingToast.message, { id: pendingToast.id });
        setPendingToast(null);
      }
      setIsRefreshing(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    prevPurchasesRef.current = purchases;
  }, [purchases, isRefreshing, pendingToast]);

  useEffect(() => {
    if (isRefreshing && !timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        if (pendingToast) {
          toast.success(pendingToast.message, { id: pendingToast.id });
          setPendingToast(null);
        }
        setIsRefreshing(false);
        timeoutRef.current = null;
      }, 5000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isRefreshing, pendingToast]);

  const onMutationStart = useCallback(() => {
    setIsRefreshing(true);
  }, []);

  const onMutationSuccess = useCallback((toastId: string | number, message: string) => {
    setPendingToast({ id: toastId, message });
    router.refresh();
  }, [router]);

  const onMutationError = useCallback((toastId: string | number, error: string) => {
    toast.error(error, { id: toastId });
    setIsRefreshing(false);
    setPendingToast(null);
  }, []);

  const handleRefresh = () => {
    router.refresh();
  };

  const handleChargeAll = async () => {
    const toastId = toast.loading('Cobrando cuotas pendientes...');
    onMutationStart();
    const result = await chargeAllPendingInstallments(projectId, userId);
    if (result.success) {
      onMutationSuccess(toastId, 'Cuotas cobradas');
    } else {
      onMutationError(toastId, 'Error al cobrar cuotas');
    }
  };

  const filteredPurchases = showActive
    ? purchases.filter((p) => p.isActive)
    : purchases;

  const activePurchases = purchases.filter((p) => p.isActive);
  const hasPendingCharges = activePurchases.some(
    (p) => p.nextChargeDate && new Date(p.nextChargeDate) <= new Date()
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <SummaryCards summary={summary} debtCapacity={debtCapacity} />

      {/* Pending charges banner */}
      {hasPendingCharges && (
        <button
          onClick={handleChargeAll}
          className="w-full flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400 transition-colors active:bg-amber-500/20"
        >
          <Receipt className="h-4 w-4 shrink-0" />
          <span className="font-medium">Hay cuotas pendientes de cobro</span>
          <span className="ml-auto text-xs opacity-70">Cobrar</span>
        </button>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border bg-muted/50 p-0.5">
          <button
            onClick={() => setShowActive(true)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              showActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Activas
            <span className="ml-1 tabular-nums opacity-60">{activePurchases.length}</span>
          </button>
          <button
            onClick={() => setShowActive(false)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              !showActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Todas
            <span className="ml-1 tabular-nums opacity-60">{purchases.length}</span>
          </button>
        </div>

        <CreatePurchaseDialog
          projectId={projectId}
          userId={userId}
          accounts={accounts}
          categories={categories}
          entities={entities}
          onSuccess={handleRefresh}
        />
      </div>

      {/* Purchases List */}
      <div>
        {isRefreshing ? (
          <div className="space-y-3">
            {Array.from({ length: Math.max(1, filteredPurchases.length) }).map((_, i) => (
              <CardPurchaseCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredPurchases.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title={showActive ? 'No hay compras activas' : 'No hay compras registradas'}
            description="Registra tus compras en cuotas para hacer seguimiento de los pagos y saber cuánto estás pagando en intereses."
          />
        ) : (
          <div className="space-y-3">
            {filteredPurchases.map((purchase) => (
              <CardPurchaseCard
                key={purchase.id}
                purchase={purchase}
                userId={userId}
                onUpdate={handleRefresh}
                onMutationStart={onMutationStart}
                onMutationSuccess={onMutationSuccess}
                onMutationError={onMutationError}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
