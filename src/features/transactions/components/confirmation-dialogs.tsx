'use client';

import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { TransactionWithCategory } from '../types';

// ============================================================================
// DELETE TRANSACTION DIALOG
// ============================================================================

interface DeleteTransactionDialogProps {
  transaction: TransactionWithCategory | null;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteTransactionDialog({
  transaction,
  isPending,
  onConfirm,
  onClose,
}: DeleteTransactionDialogProps) {
  return (
    <ConfirmDialog
      open={!!transaction}
      onOpenChange={(open) => !open && onClose()}
      title="Eliminar transacción"
      description="¿Estás seguro de eliminar esta transacción? Esta acción no se puede deshacer."
      confirmText={isPending ? 'Eliminando...' : 'Eliminar'}
      variant="destructive"
      isPending={isPending}
      onConfirm={onConfirm}
    />
  );
}

// ============================================================================
// TOGGLE PAID DIALOG
// ============================================================================

interface TogglePaidDialogProps {
  transaction: TransactionWithCategory | null;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function TogglePaidDialog({
  transaction,
  isPending,
  onConfirm,
  onClose,
}: TogglePaidDialogProps) {
  const isPaid = transaction?.isPaid;

  return (
    <ConfirmDialog
      open={!!transaction}
      onOpenChange={(open) => !open && onClose()}
      title={isPaid ? 'Marcar como pendiente' : 'Marcar como pagado'}
      description={
        isPaid
          ? '¿Estás seguro de marcar esta transacción como pendiente?'
          : '¿Estás seguro de marcar esta transacción como pagada?'
      }
      confirmText={isPending ? 'Procesando...' : 'Confirmar'}
      isPending={isPending}
      onConfirm={onConfirm}
    />
  );
}

// ============================================================================
// BULK DELETE DIALOG
// ============================================================================

interface BulkDeleteDialogProps {
  open: boolean;
  count: number;
  isPending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function BulkDeleteDialog({
  open,
  count,
  isPending,
  onConfirm,
  onOpenChange,
}: BulkDeleteDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Eliminar transacciones"
      description={`¿Estás seguro de eliminar ${count} transaccion${count > 1 ? 'es' : ''}? Esta acción no se puede deshacer.`}
      confirmText={isPending ? 'Eliminando...' : 'Eliminar'}
      variant="destructive"
      isPending={isPending}
      onConfirm={onConfirm}
    />
  );
}

// ============================================================================
// HISTORICALLY PAID DIALOG
// (Can't use ConfirmDialog - has 3 buttons with custom actions)
// ============================================================================

interface HistoricallyPaidDialogProps {
  open: boolean;
  count: number;
  isPending: boolean;
  onMark: () => void;
  onUnmark: () => void;
  onOpenChange: (open: boolean) => void;
}

export function HistoricallyPaidDialog({
  open,
  count,
  isPending,
  onMark,
  onUnmark,
  onOpenChange,
}: HistoricallyPaidDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Marcar como históricamente pagadas</AlertDialogTitle>
          <AlertDialogDescription>
            Selecciona una opción para las {count} transaccion{count > 1 ? 'es' : ''} seleccionada{count > 1 ? 's' : ''}.
            <br /><br />
            <strong>Marcar:</strong> Indica que estas cuotas fueron pagadas antes de usar la app.
            <br />
            <strong>Desmarcar:</strong> Indica que estas cuotas aún no han sido pagadas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <Button
            variant="outline"
            onClick={onUnmark}
            disabled={isPending}
          >
            <X className="mr-2 h-4 w-4" />
            Desmarcar
          </Button>
          <Button
            onClick={onMark}
            disabled={isPending}
          >
            <Check className="mr-2 h-4 w-4" />
            Marcar como histórico
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
