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
      className={`rounded-lg border p-4 flex items-center justify-between ${account.isArchived ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-3">
        {account.entity?.imageUrl ? (
          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
            <Image
              src={account.entity.imageUrl}
              alt={account.entity.name}
              width={40}
              height={40}
              className="object-cover"
            />
          </div>
        ) : (
          <div
            className={`p-2.5 rounded-lg ${
              isCredit
                ? 'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400'
                : 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
            }`}
          >
            <AccountTypeIcon type={account.type as AccountType} className="h-5 w-5" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{account.name}</p>
            {account.isDefault && (
              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {ACCOUNT_TYPE_LABELS[account.type as AccountType]}
            {account.entity
              ? ` · ${account.entity.name}`
              : account.bankName && ` · ${account.bankName}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p
            className={`text-lg font-semibold ${
              isCredit
                ? balance > 0
                  ? 'text-red-600'
                  : 'text-muted-foreground'
                : balance >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
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
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Acciones</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            {account.isArchived ? (
              <DropdownMenuItem onClick={handleRestore}>
                <ArchiveRestore className="mr-2 h-4 w-4" />
                Restaurar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="mr-2 h-4 w-4" />
                Archivar
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
    </div>
  );
}
