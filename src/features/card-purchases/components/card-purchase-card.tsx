'use client';

import { useState, useTransition } from 'react';
import { useIsMobile } from '@/hooks';
import { toast } from 'sonner';
import {
  CreditCard,
  Store,
  Trash2,
  Archive,
  Receipt,
  Users,
  RefreshCw,
} from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CardActions } from '@/components/card-actions';

import { formatCurrency, formatDateLong } from '@/lib/formatting';
import { chargeInstallment, archiveCardPurchase, deleteCardPurchase, regenerateInstallments } from '../actions';
import type { CardPurchaseWithDetails } from '../types';

interface CardPurchaseCardProps {
  purchase: CardPurchaseWithDetails;
  userId: string;
  onUpdate: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

export function CardPurchaseCard({
  purchase,
  userId,
  onUpdate,
  onMutationStart,
  onMutationError,
  onMutationSuccess,
}: CardPurchaseCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [showActionsDrawer, setShowActionsDrawer] = useState(false);
  const [showInlineActions, setShowInlineActions] = useState(false);
  const isMobile = useIsMobile();

  const hasInterest = parseFloat(purchase.interestAmount) > 0;
  const isOverdue = purchase.nextChargeDate && new Date(purchase.nextChargeDate) < new Date();

  const handleChargeInstallment = () => {
    const toastId = toast.loading('Cobrando cuota...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await chargeInstallment(purchase.id, userId);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Cuota cobrada');
        onUpdate();
      } else {
        onMutationError?.(toastId, result.error ?? 'Error al cobrar cuota');
      }
    });
  };

  const handleArchive = () => {
    setShowArchiveDialog(false);
    const toastId = toast.loading('Archivando compra...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await archiveCardPurchase(purchase.id, userId);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Compra archivada');
        onUpdate();
      } else {
        onMutationError?.(toastId, result.error ?? 'Error al archivar');
      }
    });
  };

  const handleDelete = () => {
    const toastId = toast.loading('Eliminando compra...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await deleteCardPurchase(purchase.id, userId);
      setShowDeleteDialog(false);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Compra eliminada');
        onUpdate();
      } else {
        onMutationError?.(toastId, result.error ?? 'Error al eliminar');
      }
    });
  };

  const handleRegenerate = () => {
    const toastId = toast.loading('Regenerando cuotas...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await regenerateInstallments(purchase.id, userId);
      setShowRegenerateDialog(false);
      if (result.success) {
        onMutationSuccess?.(toastId, `${result.regenerated} cuotas regeneradas`);
        onUpdate();
      } else {
        onMutationError?.(toastId, result.error ?? 'Error al regenerar cuotas');
      }
    });
  };

  // Build description line
  const descriptionParts: string[] = [];
  if (purchase.entityName) descriptionParts.push(purchase.entityName);
  else if (purchase.storeName) descriptionParts.push(purchase.storeName);
  if (purchase.categoryName) descriptionParts.push(purchase.categoryName);
  const description = descriptionParts.join(' · ') || formatDateLong(purchase.purchaseDate);

  const actions = [
    ...(purchase.isActive && purchase.remainingInstallments > 0
      ? [{
          key: 'charge',
          label: 'Cobrar cuota',
          icon: <Receipt />,
          onClick: handleChargeInstallment,
        }]
      : []),
    {
      key: 'regenerate',
      label: 'Regenerar cuotas',
      icon: <RefreshCw />,
      onClick: () => setShowRegenerateDialog(true),
      closeOnClick: false,
    },
    ...(purchase.isActive
      ? [{
          key: 'archive',
          label: 'Archivar',
          icon: <Archive />,
          onClick: () => setShowArchiveDialog(true),
          closeOnClick: false,
        }]
      : []),
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
        className={`rounded-2xl border bg-card p-4 transition-colors cursor-pointer active:bg-muted/50 ${!purchase.isActive ? 'opacity-60' : ''}`}
      >
        {/* Top row: Icon + Info + Actions */}
        <div className="flex items-start gap-3">
          {/* Icon */}
          {purchase.entityImageUrl ? (
            <div className="w-12 h-12 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-border">
              <img
                src={purchase.entityImageUrl}
                alt={purchase.entityName ?? ''}
                className="object-contain w-full h-full bg-white"
              />
            </div>
          ) : (
            <div className="p-3 sm:p-2.5 rounded-xl flex-shrink-0 bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
              <Store className="h-6 w-6 sm:h-5 sm:w-5" />
            </div>
          )}

          {/* Info + Amount (desktop) */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-base truncate">{purchase.description}</p>
                  {purchase.isExternalDebt && (
                    <Badge variant="outline" className="gap-1 shrink-0 text-[10px] px-1.5 py-0">
                      <Users className="h-3 w-3" />
                      Externa
                    </Badge>
                  )}
                  {!purchase.isActive && (
                    <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">Completada</Badge>
                  )}
                  {isOverdue && purchase.isActive && (
                    <Badge variant="destructive" className="shrink-0 text-[10px] px-1.5 py-0">Pendiente</Badge>
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
                  title={purchase.description}
                  description={description}
                  isPending={isPending}
                  showInline={showInlineActions}
                  onToggleInline={() => setShowInlineActions(!showInlineActions)}
                  drawerOpen={showActionsDrawer}
                  onDrawerOpenChange={setShowActionsDrawer}
                >
                  <div className="text-right min-w-[140px]">
                    <p className="text-lg font-bold tabular-nums text-foreground">
                      {formatCurrency(parseFloat(purchase.installmentAmount))}
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        /mes
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {purchase.chargedInstallments}/{purchase.installments} cuotas
                    </p>
                  </div>
                </CardActions>
              </div>
            </div>

            {/* Mobile: Amount row */}
            <div className="flex items-center justify-between mt-2 sm:hidden">
              <p className="text-xl font-bold tabular-nums text-foreground">
                {formatCurrency(parseFloat(purchase.installmentAmount))}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  /mes
                </span>
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {purchase.chargedInstallments}/{purchase.installments} cuotas
              </p>
              {/* Mobile actions trigger */}
              <CardActions
                actions={actions}
                title={purchase.description}
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
          <Progress value={purchase.progressPercentage} className="h-3" />
          <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground gap-3">
            <div className="flex items-center gap-1.5 min-w-0">
              {purchase.accountEntityImageUrl ? (
                <img
                  src={purchase.accountEntityImageUrl}
                  alt={purchase.accountEntityName ?? purchase.accountName}
                  className="h-4 w-4 rounded object-contain bg-white shrink-0"
                />
              ) : (
                <CreditCard className="h-3 w-3 shrink-0" />
              )}
              <span className="truncate">{purchase.accountName}</span>
            </div>
            <span className="shrink-0 tabular-nums">
              {hasInterest ? (
                <span className="text-red-500 dark:text-red-400">
                  +{formatCurrency(parseFloat(purchase.interestAmount))}
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400">Sin interés</span>
              )}
            </span>
            <span className="shrink-0 tabular-nums">
              {formatCurrency(purchase.remainingAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Archive Confirmation */}
      <ConfirmDialog
        open={showArchiveDialog}
        onOpenChange={setShowArchiveDialog}
        icon={<Archive className="h-7 w-7" />}
        iconVariant="default"
        title="Archivar compra"
        description={
          <>
            ¿Archivar <span className="font-medium text-foreground">{purchase.description}</span>?
            La compra no aparecerá en el listado activo pero podrás verla desde &quot;Todas&quot;.
          </>
        }
        confirmText={isPending ? 'Archivando...' : 'Archivar'}
        size="sm"
        isPending={isPending}
        onConfirm={handleArchive}
      />

      {/* Regenerate Confirmation */}
      <ConfirmDialog
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
        icon={<RefreshCw className="h-7 w-7" />}
        iconVariant="info"
        title="Regenerar cuotas"
        description={
          <>
            Se eliminarán todas las transacciones asociadas a{' '}
            <span className="font-medium text-foreground">{purchase.description}</span>{' '}
            y se volverán a crear las {purchase.installments} cuotas desde cero.
          </>
        }
        confirmText={isPending ? 'Regenerando...' : 'Regenerar cuotas'}
        size="sm"
        isPending={isPending}
        onConfirm={handleRegenerate}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        icon={<Trash2 className="h-7 w-7" />}
        iconVariant="destructive"
        title="Eliminar compra"
        description={
          <>
            ¿Eliminar <span className="font-medium text-foreground">{purchase.description}</span> permanentemente?
            Se eliminarán las <strong>{purchase.chargedInstallments} transacciones</strong> asociadas.
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
