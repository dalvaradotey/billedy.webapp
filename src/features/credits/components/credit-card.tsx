'use client';

import { useState, useTransition } from 'react';
import { useIsMobile } from '@/hooks';
import { toast } from 'sonner';
import {
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Calendar,
  Receipt,
  CreditCard as CreditCardIcon,
} from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CardActions } from '@/components/card-actions';

import { formatCurrency, formatDateLong } from '@/lib/formatting';
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
  const [showActionsDrawer, setShowActionsDrawer] = useState(false);
  const [showInlineActions, setShowInlineActions] = useState(false);
  const isMobile = useIsMobile();

  const interestAmount = parseFloat(credit.baseTotalAmount) - parseFloat(credit.basePrincipalAmount);

  const handleDelete = () => {
    const toastId = toast.loading('Eliminando crédito...');
    onMutationStart?.(toastId);
    startTransition(async () => {
      const result = await deleteCredit(credit.id, userId);
      setShowDeleteDialog(false);
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

  // Build description line
  const descriptionParts: string[] = [];
  if (credit.entityName) descriptionParts.push(credit.entityName);
  if (credit.categoryName) descriptionParts.push(credit.categoryName);
  descriptionParts.push(FREQUENCY_LABELS[credit.frequency]);
  const description = descriptionParts.join(' · ');

  const actions = [
    {
      key: 'edit',
      label: 'Editar',
      icon: <Pencil />,
      onClick: onEdit,
    },
    {
      key: 'generate',
      label: 'Generar cuotas',
      icon: <Receipt />,
      onClick: () => setShowGenerateDialog(true),
      closeOnClick: false,
    },
    {
      key: 'archive',
      label: credit.isArchived ? 'Restaurar' : 'Archivar',
      icon: credit.isArchived ? <ArchiveRestore /> : <Archive />,
      onClick: handleArchive,
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
        className={`rounded-2xl border bg-card p-4 transition-colors cursor-pointer active:bg-muted/50 ${credit.isArchived ? 'opacity-60' : ''}`}
      >
        {/* Top row: Icon + Info + Actions */}
        <div className="flex items-start gap-3">
          {/* Entity Icon */}
          {credit.entityImageUrl ? (
            <div className="w-12 h-12 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-border">
              <img
                src={credit.entityImageUrl}
                alt={credit.entityName ?? ''}
                className="object-contain w-full h-full bg-white"
              />
            </div>
          ) : (
            <div className="p-3 sm:p-2.5 rounded-xl flex-shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <CreditCardIcon className="h-6 w-6 sm:h-5 sm:w-5" />
            </div>
          )}

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-base truncate">{credit.name}</p>
                  {credit.categoryColor && (
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: credit.categoryColor }}
                    />
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {description}
                </p>
              </div>

              {/* Desktop: Amount + Actions inline */}
              <div className="hidden sm:flex items-center gap-3">
                <CardActions
                  actions={actions}
                  title={credit.name}
                  description={description}
                  isPending={isPending}
                  showInline={showInlineActions}
                  onToggleInline={() => setShowInlineActions(!showInlineActions)}
                  drawerOpen={showActionsDrawer}
                  onDrawerOpenChange={setShowActionsDrawer}
                >
                  <div className="text-right min-w-[120px]">
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      {formatCurrency(credit.installmentAmount)}
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        /cuota
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {credit.paidInstallments}/{credit.installments} cuotas
                    </p>
                  </div>
                </CardActions>
              </div>
            </div>

            {/* Mobile: Amount row */}
            <div className="flex items-center justify-between mt-2 sm:hidden">
              <p className="text-xl font-bold tabular-nums text-foreground">
                {formatCurrency(credit.installmentAmount)}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  /cuota
                </span>
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {credit.paidInstallments}/{credit.installments} cuotas
              </p>
              {/* Mobile actions trigger */}
              <CardActions
                actions={actions}
                title={credit.name}
                description={description}
                isPending={isPending}
                showInline={false}
                onToggleInline={() => {}}
                drawerOpen={showActionsDrawer}
                onDrawerOpenChange={setShowActionsDrawer}
              />
            </div>
          </div>
        </div>

        {/* Progress bar - full width */}
        <div className="mt-3">
          <Progress value={Math.min(credit.progressPercentage, 100)} className="h-3" />
          <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
            <span>
              {credit.paidInstallments} de {credit.installments} cuotas
            </span>
            <span className="tabular-nums">
              {formatCurrency(credit.paidAmount)} de {formatCurrency(credit.baseTotalAmount)}
            </span>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mt-3">
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
              {formatCurrency(interestAmount)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Restante:</span>{' '}
            <span className="font-medium">{formatCurrency(credit.remainingAmount)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">1ª cuota:</span>{' '}
            <span>{formatDateLong(credit.startDate)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Próximo:</span>{' '}
            <span>{formatDateLong(credit.nextPaymentDate)}</span>
          </div>
          <div className="flex items-center gap-1 col-span-2">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Vencimiento:</span>{' '}
            <span>{formatDateLong(credit.endDate)}</span>
          </div>
        </div>

        {credit.description && (
          <p className="text-sm text-muted-foreground mt-2">{credit.description}</p>
        )}
      </div>

      {/* Generate Installments Confirmation */}
      <ConfirmDialog
        open={showGenerateDialog}
        onOpenChange={setShowGenerateDialog}
        icon={<Receipt className="h-7 w-7" />}
        iconVariant="info"
        title="Generar cuotas"
        description="¿Generar todas las cuotas pendientes como transacciones? Esto creará las transacciones correspondientes a las cuotas restantes del crédito."
        confirmText={isPending ? 'Generando...' : 'Generar cuotas'}
        size="sm"
        isPending={isPending}
        onConfirm={handleGenerateInstallments}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        icon={<Trash2 className="h-7 w-7" />}
        iconVariant="destructive"
        title="Eliminar crédito"
        description={
          <>
            ¿Eliminar <span className="font-medium text-foreground">{credit.name}</span> permanentemente?
            Se eliminarán las <strong>{credit.paidInstallments} transacciones</strong> asociadas.
          </>
        }
        confirmText={isPending ? 'Eliminando...' : 'Eliminar crédito'}
        variant="destructive"
        size="sm"
        requireConfirmText={CONFIRM_DELETE_TEXT}
        isPending={isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
