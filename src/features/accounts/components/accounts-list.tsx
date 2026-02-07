'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ResponsiveDrawer, DrawerTrigger } from '@/components/ui/drawer';
import { EmptyState } from '@/components/empty-state';

import { formatCurrency } from '@/lib/formatting';
import type { Account, AccountsSummary, AccountWithEntity } from '../types';
import type { Entity } from '@/features/entities/types';
import { SummaryCard } from './summary-card';
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
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Disponible"
          value={formatCurrency(summary.totalDebitBalance)}
          subtitle="En cuentas de débito"
          className="text-emerald-600 dark:text-emerald-400"
        />
        <SummaryCard
          title="Deuda TC"
          value={formatCurrency(summary.totalCreditBalance)}
          subtitle="En tarjetas de crédito"
          className="text-red-600 dark:text-red-400"
        />
        <SummaryCard
          title="Patrimonio Neto"
          value={formatCurrency(summary.netWorth)}
          subtitle="Disponible - Deuda"
          className={summary.netWorth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
        />
        <SummaryCard title="Cuentas" value={String(summary.totalAccounts)} subtitle="Activas" />
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">{accounts.length} cuentas</div>

        <div className="flex gap-2">
          <RecalculateButton
            userId={userId}
            onMutationStart={onMutationStart}
            onMutationSuccess={onMutationSuccess}
            onMutationError={onMutationError}
          />
          <ResponsiveDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DrawerTrigger asChild>
              <Button size="sm" className="gap-2" onClick={handleOpenDialog}>
                <Plus className="h-4 w-4" />
                Nueva cuenta
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
