'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { ArrowRight, Wallet, TrendingUp, CreditCard, Scale, Hash } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ResponsiveDrawer, DrawerTrigger } from '@/components/ui/drawer';
import { EmptyState } from '@/components/empty-state';

import { formatCurrency } from '@/lib/formatting';
import type { Account, AccountsSummary, AccountWithEntity } from '../types';
import type { Entity } from '@/features/entities/types';
import { SummaryCard } from './summary-card';
import { SummaryCardsSlider } from './summary-cards-slider';
import { AccountCard } from './account-card';
import { AccountCardSkeleton } from './account-card-skeleton';
import { AccountDialogContent } from './account-dialog';
import { RecalculateButton } from './recalculate-button';

interface AccountsListProps {
  accounts: AccountWithEntity[];
  summary: AccountsSummary;
  userId: string;
  currencies: { id: string; code: string; name: string }[];
  entities: Entity[];
}

export function AccountsList({
  accounts,
  summary,
  userId,
  currencies,
  entities,
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

  const handleOpenDialog = () => {
    setEditingAccount(null);
    setIsDialogOpen(true);
  };

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
          subtitle="Tarjetas de crédito"
          icon={<CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="danger"
        />
        <SummaryCard
          title="Patrimonio"
          value={formatCurrency(summary.netWorth)}
          subtitle="Disponible - Deuda"
          icon={<Scale className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant={summary.netWorth >= 0 ? 'success' : 'danger'}
        />
        <SummaryCard
          title="Cuentas"
          value={String(summary.totalAccounts)}
          subtitle="Activas"
          icon={<Hash className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="info"
        />
      </SummaryCardsSlider>

      {/* Actions */}
      <div className="space-y-3 sm:space-y-0 sm:flex sm:justify-between sm:items-center">
        <div className="text-sm text-muted-foreground hidden sm:block">
          {accounts.length} cuentas
        </div>

        <div className="flex gap-2">
          <RecalculateButton
            userId={userId}
            onMutationStart={onMutationStart}
            onMutationSuccess={onMutationSuccess}
            onMutationError={onMutationError}
          />
          <ResponsiveDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DrawerTrigger asChild>
              <Button variant="cta-sm" className="flex-1 sm:flex-none" onClick={handleOpenDialog}>
                Nueva cuenta
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DrawerTrigger>
            <AccountDialogContent
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
        </div>
      </div>

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
