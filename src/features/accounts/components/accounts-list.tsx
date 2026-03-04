'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Wallet, TrendingUp, CreditCard, Scale, Hash, Plus, RefreshCw } from 'lucide-react';

import { ResponsiveDrawer } from '@/components/ui/drawer';
import { EmptyState } from '@/components/empty-state';

import { formatCurrency } from '@/lib/formatting';
import { SummaryCard } from '@/components/ui/summary-card';
import { SummaryCardsSlider } from '@/components/ui/summary-cards-slider';
import type { Account, AccountsSummary, AccountWithEntity, AccountDebtBreakdown } from '../types';
import type { Entity } from '@/features/entities/types';
import { useRegisterPageActions, type PageAction } from '@/components/layout/bottom-nav-context';
import { recalculateAllAccountBalances } from '../actions';
import { AccountCard } from './account-card';
import { AccountCardSkeleton } from './account-card-skeleton';
import { AccountDialogContent } from './account-dialog';

interface AccountsListProps {
  accounts: AccountWithEntity[];
  summary: AccountsSummary;
  projectId: string;
  userId: string;
  currencies: { id: string; code: string; name: string }[];
  entities: Entity[];
  debtBreakdown?: Record<string, AccountDebtBreakdown>;
}

export function AccountsList({
  accounts,
  summary,
  projectId,
  userId,
  currencies,
  entities,
  debtBreakdown,
}: AccountsListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountWithEntity | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingToast, setPendingToast] = useState<{
    id: string | number;
    message: string;
  } | null>(null);

  const prevAccountsRef = useRef<Account[]>(accounts);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const dataChanged =
      accounts !== prevAccountsRef.current ||
      accounts.length !== prevAccountsRef.current.length ||
      JSON.stringify(accounts.map((a) => a.id + a.currentBalance)) !==
        JSON.stringify(prevAccountsRef.current.map((a) => a.id + a.currentBalance));

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

    prevAccountsRef.current = accounts;
  }, [accounts, isRefreshing, pendingToast]);

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
  }, []);

  const onMutationError = useCallback((toastId: string | number, error: string) => {
    toast.error(error, { id: toastId });
    setIsRefreshing(false);
    setPendingToast(null);
  }, []);

  const handleEdit = (account: AccountWithEntity) => {
    setEditingAccount(account);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingAccount(null);
  };

  const handleOpenDialog = useCallback(() => {
    setEditingAccount(null);
    setIsDialogOpen(true);
  }, []);

  const handleRecalculate = useCallback(() => {
    const toastId = toast.loading('Recalculando saldos...');
    onMutationStart();
    recalculateAllAccountBalances(projectId, userId).then((result) => {
      if (result.success) {
        onMutationSuccess(toastId, `${result.data.updated} cuentas actualizadas`);
      } else {
        onMutationError(toastId, result.error);
      }
    });
  }, [projectId, userId, onMutationStart, onMutationSuccess, onMutationError]);

  // Registrar acciones en bottom nav / desktop FAB
  const pageActions = useMemo<PageAction[]>(() => [
    { label: 'Nueva cuenta', icon: Plus, onClick: handleOpenDialog },
    { label: 'Recalcular saldos', icon: RefreshCw, onClick: handleRecalculate },
  ], [handleOpenDialog, handleRecalculate]);

  useRegisterPageActions(pageActions);

  // Calcular deuda externa total desde el mapa de desglose
  const totalExternalDebt = debtBreakdown
    ? Object.values(debtBreakdown).reduce((sum, d) => sum + d.externalDebt, 0)
    : 0;
  const totalPersonalDebt = summary.totalCreditBalance - totalExternalDebt;
  const personalNetWorth = summary.totalDebitBalance - totalPersonalDebt;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <SummaryCardsSlider>
        <SummaryCard
          title="Disponible"
          value={formatCurrency(summary.totalDebitBalance)}
          subtitle="Cuentas de débito"
          icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="success"
        />
        <SummaryCard
          title="Deuda TC"
          value={formatCurrency(summary.totalCreditBalance)}
          subtitle={totalExternalDebt > 0
            ? `Propia: ${formatCurrency(totalPersonalDebt)} · Externa: ${formatCurrency(totalExternalDebt)}`
            : 'Tarjetas de crédito'
          }
          icon={<CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="danger"
        />
        <SummaryCard
          title="Saldo"
          value={formatCurrency(personalNetWorth)}
          subtitle={totalExternalDebt > 0
            ? 'Disponible - Deuda propia'
            : 'Disponible - Deuda'
          }
          icon={<Scale className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant={personalNetWorth >= 0 ? 'success' : 'danger'}
        />
        <SummaryCard
          title="Cuentas"
          value={String(summary.totalAccounts)}
          subtitle="Activas"
          icon={<Hash className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="info"
        />
      </SummaryCardsSlider>

      {/* Dialog (se abre desde page actions) */}
      <ResponsiveDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AccountDialogContent
          projectId={projectId}
          userId={userId}
          account={editingAccount}
          currencies={currencies}
          entities={entities}
          onSuccess={handleDialogClose}
          onMutationStart={onMutationStart}
          onMutationSuccess={onMutationSuccess}
          onMutationError={onMutationError}
        />
      </ResponsiveDrawer>

      {/* Accounts List */}
      <div>
        {isRefreshing ? (
          <div className="space-y-3">
            {Array.from({ length: Math.max(1, accounts.length) }).map((_, i) => (
              <AccountCardSkeleton key={i} />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No hay cuentas registradas"
            description="Crea una cuenta para comenzar a registrar tus transacciones."
          />
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                userId={userId}
                debtBreakdown={debtBreakdown?.[account.id]}
                onEdit={() => handleEdit(account)}
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
