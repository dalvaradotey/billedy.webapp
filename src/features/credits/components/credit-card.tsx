'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Calendar,
  Receipt,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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

import { formatCurrency, formatDate } from '@/lib/formatting';
import { archiveCredit, deleteCredit, generateAllCreditInstallments } from '../actions';
import type { CreditWithProgress } from '../types';
import { CONFIRM_DELETE_TEXT, FREQUENCY_LABELS } from './constants';

interface CreditCardProps {
  credit: CreditWithProgress;
  userId: string;
  onEdit: () => void;
  onMutationStart?: (toastId: string | number) => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

export function CreditCard({
  credit,
  userId,
  onEdit,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: CreditCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const canDelete = confirmText === CONFIRM_DELETE_TEXT;

  const handleCloseDeleteDialog = (open: boolean) => {
    setShowDeleteDialog(open);
    if (!open) {
      setConfirmText('');
    }
  };

  const handleDelete = () => {
    if (!canDelete) return;
    const toastId = toast.loading('Eliminando crédito...');
    onMutationStart?.(toastId);
    startTransition(async () => {
      const result = await deleteCredit(credit.id, userId);
      setShowDeleteDialog(false);
      setConfirmText('');
      if (result.success) {
        onMutationSuccess?.(toastId, 'Crédito eliminado');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleArchive = () => {
    const toastId = toast.loading(
      credit.isArchived ? 'Restaurando crédito...' : 'Archivando crédito...'
    );
    onMutationStart?.(toastId);
    startTransition(async () => {
      const result = await archiveCredit(credit.id, userId, !credit.isArchived);
      if (result.success) {
        onMutationSuccess?.(
          toastId,
          credit.isArchived ? 'Crédito restaurado' : 'Crédito archivado'
        );
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleGenerateInstallments = () => {
    const toastId = toast.loading('Generando cuotas...');
    onMutationStart?.(toastId);
    startTransition(async () => {
      const result = await generateAllCreditInstallments(credit.id, userId);
      setShowGenerateDialog(false);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Cuotas generadas');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const progressColor =
    credit.progressPercentage >= 100
      ? 'bg-green-500'
      : credit.progressPercentage >= 50
        ? 'bg-blue-500'
        : 'bg-orange-500';

  return (
    <div
      className={`rounded-lg border p-4 space-y-3 ${credit.isArchived ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {credit.entityImageUrl && (
            <img
              src={credit.entityImageUrl}
              alt={credit.entityName ?? ''}
              className="h-8 w-8 rounded-full object-cover"
            />
          )}
          <div>
            <p className="font-medium">{credit.name}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              {credit.entityName && <span>{credit.entityName} • </span>}
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: credit.categoryColor }}
              />
              {credit.categoryName} • {FREQUENCY_LABELS[credit.frequency]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {credit.progressPercentage}%
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
                <span className="sr-only">Acciones</span>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v.01M12 12v.01M12 18v.01"
                  />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowGenerateDialog(true)}>
                <Receipt className="mr-2 h-4 w-4" />
                Generar cuotas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchive}>
                {credit.isArchived ? (
                  <>
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    Restaurar
                  </>
                ) : (
                  <>
                    <Archive className="mr-2 h-4 w-4" />
                    Archivar
                  </>
                )}
              </DropdownMenuItem>
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

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={showDeleteDialog} onOpenChange={handleCloseDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive">
                  ¿Eliminar crédito permanentemente?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <span className="block">
                    Esta acción <strong>no se puede deshacer</strong>. Se eliminará el
                    crédito &quot;{credit.name}&quot; junto con todas las{' '}
                    <strong>{credit.paidInstallments} transacciones</strong> asociadas.
                  </span>
                  <span className="block">
                    Para confirmar, escribe <strong>{CONFIRM_DELETE_TEXT}</strong> a
                    continuación:
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                <Input
                  placeholder={`Escribe ${CONFIRM_DELETE_TEXT} para confirmar`}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  className={confirmText && !canDelete ? 'border-destructive' : ''}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={!canDelete || isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {isPending ? 'Eliminando...' : 'Eliminar crédito y transacciones'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Generate Installments Confirmation Dialog */}
          <AlertDialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Generar cuotas</AlertDialogTitle>
                <AlertDialogDescription>
                  ¿Generar todas las cuotas pendientes como transacciones? Esto creará las
                  transacciones correspondientes a las cuotas restantes del crédito.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleGenerateInstallments} disabled={isPending}>
                  {isPending ? 'Generando...' : 'Generar cuotas'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <Progress
          value={Math.min(credit.progressPercentage, 100)}
          className="h-2"
          indicatorClassName={progressColor}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {credit.paidInstallments} de {credit.installments} cuotas
          </span>
          <span>
            {formatCurrency(credit.paidAmount)} de {formatCurrency(credit.baseTotalAmount)}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">Capital:</span>{' '}
          <span className="font-medium">{formatCurrency(credit.basePrincipalAmount)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Total:</span>{' '}
          <span className="font-medium">{formatCurrency(credit.baseTotalAmount)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Intereses:</span>{' '}
          <span className="font-medium text-red-500">
            {formatCurrency(
              parseFloat(credit.baseTotalAmount) - parseFloat(credit.basePrincipalAmount)
            )}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Cuota:</span>{' '}
          <span className="font-medium">{formatCurrency(credit.installmentAmount)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Restante:</span>{' '}
          <span className="font-medium">{formatCurrency(credit.remainingAmount)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Próximo:</span>{' '}
          <span>{formatDate(credit.nextPaymentDate)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Vencimiento:</span>{' '}
          <span>{formatDate(credit.endDate)}</span>
        </div>
      </div>

      {credit.description && (
        <p className="text-sm text-muted-foreground">{credit.description}</p>
      )}
    </div>
  );
}
