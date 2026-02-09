'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import Image from 'next/image';
import {
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Star,
  MoreVertical,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

  const balance = parseFloat(account.currentBalance);
  const isCredit = account.type === 'credit_card';

  const handleArchive = () => {
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

  return (
    <div
      className={`rounded-xl border bg-card p-4 transition-colors active:bg-muted/50 ${account.isArchived ? 'opacity-60' : ''}`}
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
              {ACCOUNT_TYPE_LABELS[account.type as AccountType]}
              {account.entity
                ? ` · ${account.entity.name}`
                : account.bankName && ` · ${account.bankName}`}
            </p>
          </div>
        </div>

        {/* Balance & Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-3 ml-[60px] sm:ml-0">
          <div className="sm:text-right">
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 sm:h-8 sm:w-8 -mr-2"
                disabled={isPending}
              >
                <MoreVertical className="h-5 w-5 sm:h-4 sm:w-4" />
                <span className="sr-only">Acciones</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit} className="py-3 sm:py-2">
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              {account.isArchived ? (
                <DropdownMenuItem onClick={handleRestore} className="py-3 sm:py-2">
                  <ArchiveRestore className="mr-2 h-4 w-4" />
                  Restaurar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={handleArchive} className="py-3 sm:py-2">
                  <Archive className="mr-2 h-4 w-4" />
                  Archivar
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive py-3 sm:py-2"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar cuenta</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar esta cuenta permanentemente? Las transacciones asociadas perderán
              la referencia a esta cuenta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
