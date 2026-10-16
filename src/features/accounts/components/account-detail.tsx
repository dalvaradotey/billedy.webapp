'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import Image from 'next/image';
import { Pencil, Trash2, Archive, ArchiveRestore, MoreVertical } from 'lucide-react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { formatCurrency } from '@/lib/formatting';
import { archiveAccount, restoreAccount, deleteAccount } from '../actions';
import type { AccountWithEntity, AccountType, AccountDebtBreakdown } from '../types';
import { ACCOUNT_TYPE_LABELS } from '../types';
import { WalletChip } from './wallet-card';
import { AccountFundsSection } from './account-funds';
import { PensionQuotaSection } from '@/features/pensions/components/pension-quota-section';
import type { AccountFund } from '../lib/funds';

interface AccountDetailPanelProps {
  account: AccountWithEntity;
  userId: string;
  debtBreakdown?: AccountDebtBreakdown;
  /** Fondos de esta cuenta (si se pasa projectId, se muestra la sección de fondos) */
  projectId?: string;
  funds?: AccountFund[];
  fundMoveTargets?: Array<{ id: string; name: string }>;
  onEdit: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

export function AccountDetailPanel({
  account,
  userId,
  debtBreakdown,
  projectId,
  funds = [],
  fundMoveTargets = [],
  onEdit,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: AccountDetailPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  const balance = parseFloat(account.currentBalance);
  const isCredit = account.type === 'credit_card';

  const handleArchive = () => {
    setShowArchiveDialog(false);
    const toastId = toast.loading('Archivando cuenta...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await archiveAccount(account.id, userId);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Cuenta archivada');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleRestore = () => {
    const toastId = toast.loading('Restaurando cuenta...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await restoreAccount(account.id, userId);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Cuenta restaurada');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleDelete = () => {
    const toastId = toast.loading('Eliminando cuenta...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await deleteAccount(account.id, userId);
      setShowDeleteDialog(false);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Cuenta eliminada');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const description = `${ACCOUNT_TYPE_LABELS[account.type as AccountType]}${
    account.entity
      ? ` · ${account.entity.name}`
      : account.bankName
        ? ` · ${account.bankName}`
        : ''
  }`;

  const actions = [
    {
      key: 'edit',
      label: 'Editar',
      icon: <Pencil />,
      onClick: onEdit,
    },
    account.isArchived
      ? {
          key: 'restore',
          label: 'Restaurar',
          icon: <ArchiveRestore />,
          onClick: handleRestore,
        }
      : {
          key: 'archive',
          label: 'Archivar',
          icon: <Archive />,
          onClick: () => setShowArchiveDialog(true),
          closeOnClick: false,
        },
    {
      key: 'delete',
      label: 'Eliminar',
      icon: <Trash2 />,
      onClick: () => setShowDeleteDialog(true),
      variant: 'destructive' as const,
    },
  ];

  // Desglose: personalDebt = saldo total - deuda externa
  const externalDebt = debtBreakdown?.externalDebt ?? 0;
  const personalDebt = isCredit && externalDebt > 0 ? Math.abs(balance) - externalDebt : 0;
  const hasDebtBreakdown = isCredit && externalDebt > 0;

  const limit = account.creditLimit ? parseFloat(account.creditLimit) : null;

  return (
    <>
      <section
        aria-label={`Detalle de ${account.name}`}
        className={cn('rounded-[26px] border border-line bg-surface p-4', account.isArchived && 'opacity-70')}
      >
        <div className="flex items-center gap-3">
          {account.entity?.imageUrl ? (
            <span className="h-[30px] w-[44px] shrink-0 overflow-hidden rounded-[7px] bg-white">
              <Image src={account.entity.imageUrl} alt="" width={44} height={30} className="h-full w-full object-contain p-0.5" />
            </span>
          ) : (
            <WalletChip account={account} />
          )}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-base font-extrabold">{account.name}</span>
              {account.isDefault && (
                <span className="shrink-0 rounded-full bg-jade px-1.5 py-px text-[10px] font-extrabold tracking-[0.04em] text-jade-ink">
                  PRINCIPAL
                </span>
              )}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{description}</span>
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={isPending}
                aria-label={`Acciones de ${account.name}`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              {actions.map((action) => (
                <DropdownMenuItem
                  key={action.key}
                  onClick={action.onClick}
                  className={cn('[&>svg]:h-4 [&>svg]:w-4', action.variant === 'destructive' && 'text-coral-text focus:text-coral-text')}
                >
                  {action.icon}
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isCredit ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <span className="block text-xs text-muted-foreground">Deuda</span>
                <span className={cn('num text-[28px] font-extrabold', balance > 0 ? 'text-coral-text' : 'text-foreground')}>
                  {balance > 0 && '−'}
                  {formatCurrency(Math.abs(balance), account.currency)}
                </span>
              </div>
              {limit != null && (
                <span className="text-right text-xs text-muted-foreground">
                  cupo <span className="num font-bold text-foreground">{formatCurrency(limit, account.currency)}</span>
                  <br />
                  disponible <span className="num font-bold text-foreground">{formatCurrency(limit - balance, account.currency)}</span>
                </span>
              )}
            </div>
            {limit != null && limit > 0 && (
              <span aria-hidden className="block h-1.5 rounded-full bg-surface-3">
                <span className="block h-1.5 rounded-full bg-amber" style={{ width: `${Math.min(100, Math.round((balance / limit) * 100))}%` }} />
              </span>
            )}
            {hasDebtBreakdown && (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-background p-3">
                  <span className="block text-[11px] text-muted-foreground">Propia</span>
                  <span className="num text-[15px] font-extrabold">{formatCurrency(personalDebt, account.currency)}</span>
                </div>
                <div className="rounded-2xl bg-sky-soft p-3">
                  <span className="block text-[11px] text-sky-text">De otras personas</span>
                  <span className="num text-[15px] font-extrabold">{formatCurrency(externalDebt, account.currency)}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4">
            {projectId && !account.isArchived ? (
              <>
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Saldo de la cuenta</span>
                  <span className="num text-base font-extrabold">{formatCurrency(balance, account.currency)}</span>
                </div>
                {(account.type === 'pension' || account.type === 'unemployment') && (
                  <PensionQuotaSection userId={userId} accountId={account.id} accountType={account.type} />
                )}
                <AccountFundsSection
                  projectId={projectId}
                  userId={userId}
                  accountId={account.id}
                  accountBalance={balance}
                  funds={funds}
                  moveTargets={fundMoveTargets}
                />
              </>
            ) : (
              <div>
                <span className="block text-xs text-muted-foreground">Saldo</span>
                <span className={cn('num text-[28px] font-extrabold', balance < 0 && 'text-coral-text')}>
                  {formatCurrency(balance, account.currency)}
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Archive Confirmation */}
      <ConfirmDialog
        open={showArchiveDialog}
        onOpenChange={setShowArchiveDialog}
        icon={<Archive className="h-7 w-7" />}
        iconVariant="default"
        title="Archivar cuenta"
        description={
          <>
            ¿Archivar <span className="font-medium text-foreground">{account.name}</span>?
            La cuenta no aparecerá en tus listados activos pero podrás restaurarla en cualquier momento.
          </>
        }
        confirmText={isPending ? 'Archivando...' : 'Archivar'}
        size="sm"
        isPending={isPending}
        onConfirm={handleArchive}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        icon={<Trash2 className="h-7 w-7" />}
        iconVariant="destructive"
        title="Eliminar cuenta"
        description={
          <>
            ¿Eliminar <span className="font-medium text-foreground">{account.name}</span> permanentemente?
            Las transacciones asociadas perderán la referencia a esta cuenta.
          </>
        }
        confirmText={isPending ? 'Eliminando...' : 'Eliminar'}
        variant="destructive"
        size="sm"
        requireConfirmText="ELIMINAR"
        isPending={isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
