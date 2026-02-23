'use client';

import { useState, useTransition } from 'react';
import { useIsMobile } from '@/hooks';
import { toast } from 'sonner';
import Image from 'next/image';
import {
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Star,
} from 'lucide-react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CardActions } from '@/components/card-actions';

import { formatCurrency } from '@/lib/formatting';
import { archiveAccount, restoreAccount, deleteAccount } from '../actions';
import type { AccountWithEntity, AccountType } from '../types';
import { ACCOUNT_TYPE_LABELS } from '../types';
import { AccountTypeIcon } from './account-type-icon';

interface AccountCardProps {
  account: AccountWithEntity;
  userId: string;
  onEdit: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

export function AccountCard({
  account,
  userId,
  onEdit,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: AccountCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showActionsDrawer, setShowActionsDrawer] = useState(false);
  const [showInlineActions, setShowInlineActions] = useState(false);
  const isMobile = useIsMobile();

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

  return (
    <>
      {/* Card */}
      <div
        onClick={() => {
          if (isMobile) {
            setShowActionsDrawer(true);
          } else {
            setShowInlineActions(!showInlineActions);
          }
        }}
        className={`rounded-2xl border bg-card p-4 transition-colors cursor-pointer active:bg-muted/50 ${account.isArchived ? 'opacity-60' : ''}`}
      >
        {/* Mobile: Stack vertical, Desktop: Horizontal */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Account Info */}
          <div className="flex items-center gap-3 min-w-0">
            {account.entity?.imageUrl ? (
              <div className="w-12 h-12 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-border">
                <Image
                  src={account.entity.imageUrl}
                  alt={account.entity.name}
                  width={48}
                  height={48}
                  className="object-cover w-full h-full"
                />
              </div>
            ) : (
              <div
                className={`p-3 sm:p-2.5 rounded-xl flex-shrink-0 ${
                  isCredit
                    ? 'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400'
                    : 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                }`}
              >
                <AccountTypeIcon type={account.type as AccountType} className="h-6 w-6 sm:h-5 sm:w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-base truncate">{account.name}</p>
                {account.isDefault && (
                  <Star className="h-4 w-4 flex-shrink-0 text-amber-500 fill-amber-500" />
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {description}
              </p>
            </div>
          </div>

          {/* Balance & Actions */}
          <div className="flex items-center justify-between sm:justify-end gap-3 ml-[60px] sm:ml-0">
            <CardActions
              actions={actions}
              title={account.name}
              description={description}
              isPending={isPending}
              showInline={showInlineActions}
              onToggleInline={() => setShowInlineActions(!showInlineActions)}
              drawerOpen={showActionsDrawer}
              onDrawerOpenChange={setShowActionsDrawer}
            >
              <div className="sm:text-right sm:min-w-[140px]">
                <p
                  className={`text-xl sm:text-lg font-bold tabular-nums ${
                    isCredit
                      ? balance > 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-muted-foreground'
                      : balance >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {isCredit && balance > 0 && '-'}
                  {formatCurrency(Math.abs(balance))}
                </p>
                {isCredit && account.creditLimit && (
                  <p className="text-xs text-muted-foreground">
                    Disponible: {formatCurrency(parseFloat(account.creditLimit) - balance)}
                  </p>
                )}
              </div>
            </CardActions>
          </div>
        </div>
      </div>

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
