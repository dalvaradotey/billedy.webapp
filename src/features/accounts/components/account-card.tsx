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
  MoreVertical,
} from 'lucide-react';

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
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
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showActionsDrawer, setShowActionsDrawer] = useState(false);
  const [showInlineActions, setShowInlineActions] = useState(false);
  const isMobile = useIsMobile();

  const balance = parseFloat(account.currentBalance);
  const isCredit = account.type === 'credit_card';

  const handleArchive = () => {
    setShowActionsDrawer(false);
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
    setShowActionsDrawer(false);
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

  const handleEdit = () => {
    setShowActionsDrawer(false);
    onEdit();
  };

  const handleDeleteClick = () => {
    setShowActionsDrawer(false);
    setShowDeleteDialog(true);
  };

  const handleArchiveClick = () => {
    setShowActionsDrawer(false);
    setShowArchiveDialog(true);
  };

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
                {ACCOUNT_TYPE_LABELS[account.type as AccountType]}
                {account.entity
                  ? ` · ${account.entity.name}`
                  : account.bankName && ` · ${account.bankName}`}
              </p>
            </div>
          </div>

          {/* Balance & Actions */}
          <div className="flex items-center justify-between sm:justify-end gap-3 ml-[60px] sm:ml-0">
            {/* Inline action buttons - Toggle on desktop */}
            <div
              className={`hidden sm:flex items-center gap-2 transition-all duration-300 ease-out ${
                showInlineActions
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 translate-x-4 pointer-events-none'
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInlineActions(false);
                  onEdit();
                }}
                disabled={isPending}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors disabled:opacity-50"
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Editar</span>
              </button>
              {account.isArchived ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInlineActions(false);
                    handleRestore();
                  }}
                  disabled={isPending}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <ArchiveRestore className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Restaurar</span>
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInlineActions(false);
                    handleArchiveClick();
                  }}
                  disabled={isPending}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <Archive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Archivar</span>
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInlineActions(false);
                  setShowDeleteDialog(true);
                }}
                disabled={isPending}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
                <span className="text-sm font-medium text-red-500 dark:text-red-400">Eliminar</span>
              </button>
            </div>

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

            {/* Options indicator - Only visible on mobile */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted/50 sm:hidden">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Toggle button for inline actions - Only visible on desktop */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowInlineActions(!showInlineActions);
              }}
              disabled={isPending}
              className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-muted/50 hover:bg-muted transition-colors disabled:opacity-50"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">Acciones</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Actions Drawer */}
      <Drawer open={showActionsDrawer} onOpenChange={setShowActionsDrawer}>
        <DrawerContent>
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle>{account.name}</DrawerTitle>
            <DrawerDescription>
              {ACCOUNT_TYPE_LABELS[account.type as AccountType]}
              {account.entity
                ? ` · ${account.entity.name}`
                : account.bankName && ` · ${account.bankName}`}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-2 pb-2">
            <DrawerClose asChild>
              <button
                onClick={handleEdit}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl active:bg-muted transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Pencil className="h-5 w-5 text-muted-foreground" />
                </div>
                <span className="text-base font-medium">Editar cuenta</span>
              </button>
            </DrawerClose>
            {account.isArchived ? (
              <DrawerClose asChild>
                <button
                  onClick={handleRestore}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl active:bg-muted transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <ArchiveRestore className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span className="text-base font-medium">Restaurar cuenta</span>
                </button>
              </DrawerClose>
            ) : (
              <button
                onClick={handleArchiveClick}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl active:bg-muted transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Archive className="h-5 w-5 text-muted-foreground" />
                </div>
                <span className="text-base font-medium">Archivar cuenta</span>
              </button>
            )}
            <DrawerClose asChild>
              <button
                onClick={handleDeleteClick}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl active:bg-red-500/10 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-500 dark:text-red-400" />
                </div>
                <span className="text-base font-medium text-red-500 dark:text-red-400">Eliminar cuenta</span>
              </button>
            </DrawerClose>
          </div>
          <div className="px-4 pb-4 pt-2 border-t">
            <DrawerClose asChild>
              <button className="w-full py-3 text-base font-medium text-muted-foreground active:text-foreground transition-colors">
                Cancelar
              </button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Archive Confirmation */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent size="sm" className="rounded-2xl">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
              <Archive className="h-7 w-7 text-muted-foreground" />
            </div>
            <AlertDialogTitle className="text-center">
              Archivar cuenta
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              ¿Archivar <span className="font-medium text-foreground">{account.name}</span>?
              La cuenta no aparecerá en tus listados activos pero podrás restaurarla en cualquier momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel
              disabled={isPending}
              className="flex-1"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isPending}
              className="flex-1"
            >
              {isPending ? 'Archivando...' : 'Archivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent size="sm" className="rounded-2xl">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Trash2 className="h-7 w-7 text-red-500 dark:text-red-400" />
            </div>
            <AlertDialogTitle className="text-center">
              Eliminar cuenta
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              ¿Eliminar <span className="font-medium text-foreground">{account.name}</span> permanentemente?
              Las transacciones asociadas perderán la referencia a esta cuenta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel
              disabled={isPending}
              className="flex-1"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="flex-1 !bg-red-500/10 !text-red-500 dark:!text-red-400 hover:!bg-red-500/20"
            >
              {isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
