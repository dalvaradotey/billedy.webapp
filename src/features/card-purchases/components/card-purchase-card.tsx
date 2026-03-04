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
  Calendar,
  ChevronDown,
  MoreVertical,
  X,
} from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { cardStyles } from '@/components/card-styles';

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
  const [showDetails, setShowDetails] = useState(false);
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

  const isCompleted = purchase.progressPercentage >= 100;

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
          }
        }}
        className={cn(
          cardStyles.base,
          isMobile && 'cursor-pointer',
          !purchase.isActive && cardStyles.inactive
        )}
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

          {/* Info */}
          <div className="min-w-0 flex-1">
            {/* Row 1: Title + badges + Amount + actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-base truncate">{purchase.description}</p>
                  {purchase.isExternalDebt && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
                      <Users className="h-3 w-3" />
                      Externa
                    </span>
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

              {/* Desktop: Amount */}
              <p className="hidden sm:block text-2xl font-bold tabular-nums text-foreground shrink-0">
                {formatCurrency(parseFloat(purchase.installmentAmount))}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  /mes
                </span>
              </p>
              {/* Actions toggle (mobile: opens drawer, desktop: toggles inline) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isMobile) {
                    setShowActionsDrawer(true);
                  } else {
                    setShowInlineActions(!showInlineActions);
                  }
                }}
                disabled={isPending}
                className={cn(
                  cardStyles.actionsButton,
                  showInlineActions && 'sm:rotate-90'
                )}
              >
                {showInlineActions && !isMobile ? (
                  <X className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="sr-only">Acciones</span>
              </button>
            </div>

            {/* Mobile: Amount below description */}
            <p className="text-2xl font-bold tabular-nums text-foreground mt-1 sm:hidden">
              {formatCurrency(parseFloat(purchase.installmentAmount))}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                /mes
              </span>
            </p>

            {/* Mobile actions drawer */}
            <Drawer open={showActionsDrawer} onOpenChange={setShowActionsDrawer}>
              <DrawerContent>
                <DrawerHeader className="text-left pb-2">
                  <DrawerTitle>{purchase.description}</DrawerTitle>
                  {description && <DrawerDescription>{description}</DrawerDescription>}
                </DrawerHeader>
                <div className="px-2 pb-2">
                  {actions.map((action) => (
                    <DrawerClose key={action.key} asChild>
                      <button
                        onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                        disabled={isPending}
                        className={cn(
                          cardStyles.drawerAction,
                          action.variant === 'destructive' ? 'active:bg-red-500/10' : 'active:bg-muted'
                        )}
                      >
                        <div className={cn(
                          cardStyles.drawerActionIconBox,
                          action.variant === 'destructive' ? 'bg-red-500/10' : 'bg-muted'
                        )}>
                          <span className={cn(
                            '[&>svg]:h-5 [&>svg]:w-5',
                            action.variant === 'destructive' ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'
                          )}>
                            {action.icon}
                          </span>
                        </div>
                        <span className={cn(
                          'text-base font-medium',
                          action.variant === 'destructive' && 'text-red-500 dark:text-red-400'
                        )}>
                          {action.label}
                        </span>
                      </button>
                    </DrawerClose>
                  ))}
                </div>
                <div className="px-4 pb-4 pt-2 border-t">
                  <DrawerClose asChild>
                    <button className={cardStyles.drawerCancelButton}>
                      Cancelar
                    </button>
                  </DrawerClose>
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </div>

        {/* Swappable content: Details ↔ Actions (desktop) */}
        <div className={cn('mt-3', cardStyles.overlayGrid)}>
          {/* Details panel */}
          <div className={cn(
            'transition-all duration-300',
            showInlineActions ? 'opacity-0 scale-95 pointer-events-none h-0 overflow-hidden' : 'opacity-100 scale-100'
          )}>
            {/* Progress section */}
            <div className={isCompleted ? cardStyles.progressSectionCompleted : cardStyles.progressSection}>
              <div className="flex items-baseline justify-between mb-2.5">
                <p className="text-sm">
                  <span className={isCompleted ? cardStyles.progressLabelCompleted : cardStyles.progressLabel}>{purchase.chargedInstallments}</span>
                  <span className={isCompleted ? cardStyles.progressSecondaryCompleted : cardStyles.progressSecondary}> de {purchase.installments} cuotas</span>
                </p>
                <p className="text-sm text-right">
                  <span className={cn(isCompleted ? cardStyles.progressLabelCompleted : cardStyles.progressLabel, 'font-semibold')}>
                    {formatCurrency(Math.max(0, parseFloat(purchase.totalAmount) - purchase.remainingAmount))}
                  </span>
                  <span className={isCompleted ? cardStyles.progressSecondaryCompleted : cardStyles.progressSecondary}> / {formatCurrency(parseFloat(purchase.totalAmount))}</span>
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <Progress value={purchase.progressPercentage} className={cardStyles.progressBar} indicatorClassName={isCompleted ? cardStyles.progressIndicatorCompleted : cardStyles.progressIndicator} />
                <span className={cn('text-lg', isCompleted ? cardStyles.progressPercentageCompleted : cardStyles.progressPercentage)}>
                  {Math.round(purchase.progressPercentage)}%
                </span>
              </div>
            </div>
            {/* Details toggle + Account chip row */}
            <div className="flex items-center justify-between mt-3">
              <button
                onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
                className={cardStyles.toggleButton}
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', showDetails && 'rotate-180')} />
                <span>{showDetails ? 'Ocultar detalle' : 'Ver detalle'}</span>
              </button>
              {/* Account chip */}
              <div className={cardStyles.chipBase}>
                {purchase.accountEntityImageUrl ? (
                  <div className="w-5 h-5 rounded overflow-hidden ring-1 ring-white/20 shrink-0">
                    <img
                      src={purchase.accountEntityImageUrl}
                      alt={purchase.accountEntityName ?? purchase.accountName}
                      className="object-contain w-full h-full bg-white"
                    />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded bg-blue-500/15 flex items-center justify-center shrink-0">
                    <CreditCard className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <span className="text-xs font-medium truncate">{purchase.accountName}</span>
              </div>
            </div>
            {/* Collapsible details */}
            {showDetails && (
              <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className={cardStyles.detailsContainer}>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className={cardStyles.detailsLabel}>Original</p>
                      <p className={cardStyles.detailsValue}>{formatCurrency(parseFloat(purchase.originalAmount))}</p>
                    </div>
                    <div>
                      <p className={cardStyles.detailsLabel}>Total</p>
                      <p className={cardStyles.detailsValue}>{formatCurrency(parseFloat(purchase.totalAmount))}</p>
                    </div>
                    <div>
                      <p className={cardStyles.detailsLabel}>Intereses</p>
                      {hasInterest ? (
                        <p className="text-sm font-semibold tabular-nums text-red-500 dark:text-red-400">{formatCurrency(parseFloat(purchase.interestAmount))}</p>
                      ) : (
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Sin interés</p>
                      )}
                    </div>
                  </div>
                  <div className={cardStyles.detailsDivider} />
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className={cardStyles.detailsLabel}>Restante</p>
                      <p className={cardStyles.detailsValue}>{formatCurrency(purchase.remainingAmount)}</p>
                    </div>
                    <div>
                      <p className={cardStyles.detailsLabel}>Próximo pago</p>
                      <p className="text-sm font-medium">{purchase.nextChargeDate ? formatDateLong(purchase.nextChargeDate) : '—'}</p>
                    </div>
                    <div>
                      <p className={cardStyles.detailsLabel}>Fecha compra</p>
                      <p className="text-sm font-medium">{formatDateLong(purchase.purchaseDate)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions panel */}
          <div className={cn(
            'transition-all duration-300 flex items-center',
            showInlineActions ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none h-0 overflow-hidden'
          )}>
            <div className={cardStyles.inlineActionsGrid}>
              {actions.map((action) => (
                <button
                  key={action.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                  }}
                  disabled={isPending}
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-colors disabled:opacity-50',
                    action.variant === 'destructive'
                      ? cardStyles.inlineActionDestructive
                      : cardStyles.inlineActionDefault
                  )}
                >
                  <span className={cn(
                    '[&>svg]:h-5 [&>svg]:w-5',
                    action.variant === 'destructive'
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-muted-foreground'
                  )}>
                    {action.icon}
                  </span>
                  <span className="text-sm font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile-only: Details (always visible) */}
        <div className="mt-3 sm:hidden">
          <div className={isCompleted ? cardStyles.progressSectionCompleted : cardStyles.progressSection}>
            <div className="flex items-baseline justify-between mb-2.5">
              <p className="text-base">
                <span className={isCompleted ? cardStyles.progressLabelCompleted : cardStyles.progressLabel}>{purchase.chargedInstallments}</span>
                <span className={isCompleted ? cardStyles.progressSecondaryCompleted : cardStyles.progressSecondary}> de {purchase.installments} cuotas</span>
              </p>
              <p className="text-base text-right">
                <span className={cn(isCompleted ? cardStyles.progressLabelCompleted : cardStyles.progressLabel, 'font-semibold')}>
                  {formatCurrency(Math.max(0, parseFloat(purchase.totalAmount) - purchase.remainingAmount))}
                </span>
                <span className={isCompleted ? cardStyles.progressSecondaryCompleted : cardStyles.progressSecondary}> / {formatCurrency(parseFloat(purchase.totalAmount))}</span>
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Progress value={purchase.progressPercentage} className={cardStyles.progressBar} indicatorClassName={isCompleted ? cardStyles.progressIndicatorCompleted : cardStyles.progressIndicator} />
              <span className={cn('text-xl', isCompleted ? cardStyles.progressPercentageCompleted : cardStyles.progressPercentage)}>
                {Math.round(purchase.progressPercentage)}%
              </span>
            </div>
          </div>
          {/* Details toggle + Account chip row */}
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
              className={cardStyles.toggleButton}
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', showDetails && 'rotate-180')} />
              <span>{showDetails ? 'Ocultar detalle' : 'Ver detalle'}</span>
            </button>
            {/* Account chip */}
            <div className={cardStyles.chipBase}>
              {purchase.accountEntityImageUrl ? (
                <div className="w-5 h-5 rounded overflow-hidden ring-1 ring-white/20 shrink-0">
                  <img
                    src={purchase.accountEntityImageUrl}
                    alt={purchase.accountEntityName ?? purchase.accountName}
                    className="object-contain w-full h-full bg-white"
                  />
                </div>
              ) : (
                <div className="w-5 h-5 rounded bg-blue-500/15 flex items-center justify-center shrink-0">
                  <CreditCard className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
              <span className="text-xs font-medium truncate">{purchase.accountName}</span>
            </div>
          </div>
          {/* Collapsible details */}
          {showDetails && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className={cardStyles.detailsContainer}>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className={cardStyles.detailsLabel}>Original</p>
                    <p className={cardStyles.detailsValue}>{formatCurrency(parseFloat(purchase.originalAmount))}</p>
                  </div>
                  <div>
                    <p className={cardStyles.detailsLabel}>Total</p>
                    <p className={cardStyles.detailsValue}>{formatCurrency(parseFloat(purchase.totalAmount))}</p>
                  </div>
                  <div>
                    <p className={cardStyles.detailsLabel}>Intereses</p>
                    {hasInterest ? (
                      <p className="text-sm font-semibold tabular-nums text-red-500 dark:text-red-400">{formatCurrency(parseFloat(purchase.interestAmount))}</p>
                    ) : (
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Sin interés</p>
                    )}
                  </div>
                </div>
                <div className={cardStyles.detailsDivider} />
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className={cardStyles.detailsLabel}>Restante</p>
                    <p className={cardStyles.detailsValue}>{formatCurrency(purchase.remainingAmount)}</p>
                  </div>
                  <div>
                    <p className={cardStyles.detailsLabel}>Próximo pago</p>
                    <p className="text-sm font-medium">{purchase.nextChargeDate ? formatDateLong(purchase.nextChargeDate) : '—'}</p>
                  </div>
                  <div>
                    <p className={cardStyles.detailsLabel}>Fecha compra</p>
                    <p className="text-sm font-medium">{formatDateLong(purchase.purchaseDate)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
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
