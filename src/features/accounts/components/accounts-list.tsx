'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Wallet, Plus, RefreshCw } from 'lucide-react';

import { ResponsiveDrawer } from '@/components/ui/drawer';
import { EmptyState } from '@/components/empty-state';

import { formatCurrency } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import type { Account, AccountsSummary, AccountWithEntity, AccountDebtBreakdown } from '../types';
import type { Entity } from '@/features/entities/types';
import { useRegisterPageActions, type PageAction } from '@/components/layout/bottom-nav-context';
import { recalculateAllAccountBalances } from '../actions';
import { AccountDetailPanel } from './account-detail';
import { WalletCard, WalletChip, accountKindLabel } from './wallet-card';
import { AccountCardSkeleton } from './account-card-skeleton';
import { AccountDialogContent } from './account-dialog';
import type { AccountFund } from '../lib/funds';

interface AccountsListProps {
  accounts: AccountWithEntity[];
  summary: AccountsSummary;
  projectId: string;
  userId: string;
  currencies: { id: string; code: string; name: string }[];
  entities: Entity[];
  debtBreakdown?: Record<string, AccountDebtBreakdown>;
  funds?: AccountFund[];
}

export function AccountsList({
  accounts,
  summary,
  projectId,
  userId,
  currencies,
  entities,
  debtBreakdown,
  funds = [],
}: AccountsListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountWithEntity | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  // Orden de billetera: principal primero, luego por tipo; las archivadas al final
  const TYPE_ORDER = ['checking', 'cash', 'savings', 'credit_card', 'pension', 'unemployment'];
  const ordered = useMemo(
    () =>
      [...accounts].sort(
        (a, b) =>
          Number(a.isArchived) - Number(b.isArchived) ||
          Number(b.isDefault) - Number(a.isDefault) ||
          TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts]
  );
  const selected = ordered.find((a) => a.id === selectedId) ?? ordered[0] ?? null;

  const GROUPS: { key: string; title: string; types: string[] }[] = [
    { key: 'liquid', title: 'Corrientes y efectivo', types: ['checking', 'cash'] },
    { key: 'savings', title: 'Ahorro', types: ['savings'] },
    { key: 'credit', title: 'Tarjetas', types: ['credit_card'] },
    { key: 'provision', title: 'Previsión', types: ['pension', 'unemployment'] },
  ];
  const groups = GROUPS.map((g) => {
    const list = ordered.filter((a) => g.types.includes(a.type) && !a.isArchived);
    const total = list.reduce((acc, a) => acc + parseFloat(a.currentBalance), 0);
    return { ...g, list, total };
  }).filter((g) => g.list.length > 0);
  const archived = ordered.filter((a) => a.isArchived);

  const free = summary.freeLiquidBalance ?? summary.totalDebitBalance;
  const funds_ = summary.fundsBalance ?? 0;
  const savingsOnly = Math.max(0, summary.totalDebitBalance - free - funds_);
  const composition = [
    { label: 'Libre', value: free, color: 'bg-jade' },
    { label: 'Fondos', value: funds_, color: 'bg-violet' },
    { label: 'Ahorro', value: savingsOnly, color: 'bg-sky' },
    { label: 'Deuda', value: summary.totalCreditBalance, color: 'bg-coral', debt: true },
  ].filter((c) => c.value > 0);

  const selectAccount = (id: string) => {
    setSelectedId(id);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      document.getElementById('account-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-6">
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

      {isRefreshing ? (
        <div className="space-y-3">
          {Array.from({ length: Math.max(1, Math.min(3, accounts.length)) }).map((_, i) => (
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
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_380px] md:items-start md:gap-5">
          {/* Patrimonio */}
          <section className="md:col-start-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="text-[13px] text-muted-foreground">Patrimonio</span>
              <span className="text-xs text-faint">
                {totalExternalDebt > 0 ? 'sin deuda de otros, previsión ni terceros' : 'sin previsión ni terceros'}
              </span>
            </div>
            <p className={cn('num text-[40px] font-extrabold leading-tight', personalNetWorth < 0 && 'text-coral-text')}>
              {formatCurrency(personalNetWorth)}
            </p>
            {composition.length > 0 && (
              <>
                <div aria-hidden className="mt-3 flex h-2 gap-[3px]">
                  {composition.map((c) => (
                    <span key={c.label} className={cn('rounded-full', c.color)} style={{ flex: c.value }} />
                  ))}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1.5">
                  {composition.map((c) => (
                    <span key={c.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span aria-hidden className={cn('h-2 w-2 rounded-full', c.color)} />
                      {c.label}
                      <span className={cn('num font-bold', c.debt ? 'text-coral-text' : 'text-foreground')}>
                        {c.debt ? '−' : ''}
                        {formatCurrency(c.value)}
                      </span>
                    </span>
                  ))}
                  {summary.totalProvisionBalance > 0 && (
                    <span className="flex items-center gap-1.5 text-xs text-faint">
                      Previsión <span className="num font-bold text-muted-foreground">{formatCurrency(summary.totalProvisionBalance)}</span>
                    </span>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Carrusel (móvil) */}
          <section aria-label="Tus cuentas" className="-mx-4 md:hidden">
            <div className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
              {ordered.filter((a) => !a.isArchived).map((account) => (
                <div key={account.id} className="w-[300px] flex-none snap-center">
                  <WalletCard account={account} selected={selected?.id === account.id} onSelect={() => setSelectedId(account.id)} />
                </div>
              ))}
            </div>
          </section>

          {/* Detalle de la cuenta elegida */}
          {selected && (
            <div id="account-detail" className="scroll-mt-20 md:sticky md:top-6 md:col-start-2 md:row-span-2 md:row-start-1">
              <AccountDetailPanel
                key={selected.id}
                account={selected}
                userId={userId}
                debtBreakdown={debtBreakdown?.[selected.id]}
                projectId={projectId}
                funds={funds.filter((f) => f.accountId === selected.id)}
                fundMoveTargets={accounts
                  .filter((a) => a.id !== selected.id && a.type !== 'credit_card' && !a.isArchived)
                  .map((a) => ({ id: a.id, name: a.name }))}
                onEdit={() => handleEdit(selected)}
                onMutationStart={onMutationStart}
                onMutationSuccess={onMutationSuccess}
                onMutationError={onMutationError}
              />
            </div>
          )}

          {/* Todas las cuentas por grupo */}
          <div className="space-y-6 md:col-start-1">
            {groups.map((g) => (
              <section key={g.key} aria-label={g.title}>
                <div className="flex items-baseline justify-between px-0.5 pb-2.5">
                  <h2 className="text-base font-extrabold tracking-[-0.02em]">{g.title}</h2>
                  <span className={cn('num text-[13px] font-bold', g.key === 'credit' ? 'text-coral-text' : 'text-muted-foreground')}>
                    {g.key === 'credit' && g.total > 0 ? '−' : ''}
                    {formatCurrency(Math.abs(g.total))}
                  </span>
                </div>

                {/* Desktop: tarjetas */}
                <div className="hidden gap-3.5 md:grid md:grid-cols-2 2xl:grid-cols-3">
                  {g.list.map((account) => (
                    <WalletCard
                      key={account.id}
                      account={account}
                      selected={selected?.id === account.id}
                      onSelect={() => setSelectedId(account.id)}
                    />
                  ))}
                </div>

                {/* Móvil: lista con mini tarjetas */}
                <ul className="rounded-[22px] border border-line bg-surface px-3.5 py-0.5 md:hidden">
                  {g.list.map((account) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      active={selected?.id === account.id}
                      onSelect={() => selectAccount(account.id)}
                    />
                  ))}
                </ul>
              </section>
            ))}

            {archived.length > 0 && (
              <section aria-label="Archivadas">
                <h2 className="px-0.5 pb-2.5 text-base font-extrabold tracking-[-0.02em] text-muted-foreground">Archivadas</h2>
                <ul className="rounded-[22px] border border-line bg-surface px-3.5 py-0.5">
                  {archived.map((account) => (
                    <AccountRow key={account.id} account={account} active={selected?.id === account.id} onSelect={() => selectAccount(account.id)} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AccountRow({
  account,
  active,
  onSelect,
}: {
  account: AccountWithEntity;
  active: boolean;
  onSelect: () => void;
}) {
  const balance = parseFloat(account.currentBalance);
  const isCredit = account.type === 'credit_card';
  return (
    <li className="border-b border-surface-3 last:border-0">
      <button type="button" onClick={onSelect} aria-pressed={active} className={cn('flex min-h-[60px] w-full items-center gap-3 text-left', account.isArchived && 'opacity-60')}>
        <WalletChip account={account} />
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-sm font-bold', active && 'text-jade-text')}>{account.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {accountKindLabel(account.type).toLowerCase()}
            {account.entity?.name || account.bankName ? ` · ${account.entity?.name ?? account.bankName}` : ''}
          </span>
        </span>
        <span className={cn('num text-[15px] font-extrabold', isCredit && balance > 0 && 'text-coral-text')}>
          {isCredit && balance > 0 ? '−' : ''}
          {formatCurrency(Math.abs(balance), account.currency)}
        </span>
        <ChevronRight className="h-4 w-4 text-faint" />
      </button>
    </li>
  );
}
