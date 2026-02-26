'use client';

import { useState, useTransition } from 'react';
import { useIsMobile } from '@/hooks';
import { toast } from 'sonner';
import {
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Receipt,
  CreditCard as CreditCardIcon,
  ChevronDown,
  MoreVertical,
  X,
} from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { cardStyles } from '@/components/card-styles';

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
  const [showDetails, setShowDetails] = useState(false);
  const isMobile = useIsMobile();

  const interestAmount = parseFloat(credit.baseTotalAmount) - parseFloat(credit.basePrincipalAmount);
  const hasInterest = interestAmount > 0;

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

  const progressPercentage = Math.min(credit.progressPercentage, 100);

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
          credit.isArchived && cardStyles.inactive
        )}
      >
        {/* Top row: Icon + Info + Actions */}
        <div className="flex items-start gap-3">
          {/* Icon */}
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
            {/* Row 1: Title + Amount + actions */}
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

              {/* Desktop: Amount */}
              <p className="hidden sm:block text-2xl font-bold tabular-nums text-foreground shrink-0">
                {formatCurrency(credit.installmentAmount)}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  /cuota
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
              {formatCurrency(credit.installmentAmount)}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                /cuota
              </span>
            </p>

            {/* Mobile actions drawer */}
            <Drawer open={showActionsDrawer} onOpenChange={setShowActionsDrawer}>
              <DrawerContent>
                <DrawerHeader className="text-left pb-2">
                  <DrawerTitle>{credit.name}</DrawerTitle>
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
            <div className={cardStyles.progressSection}>
              <div className="flex items-baseline justify-between mb-2.5">
                <p className="text-sm">
                  <span className={cardStyles.progressLabel}>{credit.paidInstallments}</span>
                  <span className={cardStyles.progressSecondary}> de {credit.installments} cuotas</span>
                </p>
                <p className="text-sm text-right">
                  <span className={cn(cardStyles.progressLabel, 'font-semibold')}>
                    {formatCurrency(Math.max(0, credit.paidAmount))}
                  </span>
                  <span className={cardStyles.progressSecondary}> / {formatCurrency(credit.baseTotalAmount)}</span>
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <Progress value={progressPercentage} className={cardStyles.progressBar} indicatorClassName={cardStyles.progressIndicator} />
                <span className={cn('text-lg', cardStyles.progressPercentage)}>
                  {Math.round(progressPercentage)}%
                </span>
              </div>
            </div>
            {/* Details toggle row */}
            <div className="flex items-center justify-between mt-3">
              <button
                onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
                className={cardStyles.toggleButton}
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', showDetails && 'rotate-180')} />
                <span>{showDetails ? 'Ocultar detalle' : 'Ver detalle'}</span>
              </button>
            </div>
            {/* Collapsible details */}
            {showDetails && (
              <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className={cardStyles.detailsContainer}>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className={cardStyles.detailsLabel}>Capital</p>
                      <p className={cardStyles.detailsValue}>{formatCurrency(credit.basePrincipalAmount)}</p>
                    </div>
                    <div>
                      <p className={cardStyles.detailsLabel}>Total</p>
                      <p className={cardStyles.detailsValue}>{formatCurrency(credit.baseTotalAmount)}</p>
                    </div>
                    <div>
                      <p className={cardStyles.detailsLabel}>Intereses</p>
                      {hasInterest ? (
                        <p className={cn(cardStyles.detailsValue, 'text-red-500 dark:text-red-400')}>{formatCurrency(interestAmount)}</p>
                      ) : (
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Sin interés</p>
                      )}
                    </div>
                  </div>
                  <div className={cardStyles.detailsDivider} />
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className={cardStyles.detailsLabel}>Restante</p>
                      <p className={cardStyles.detailsValue}>{formatCurrency(Math.max(0, credit.remainingAmount))}</p>
                    </div>
                    <div>
                      <p className={cardStyles.detailsLabel}>Próximo pago</p>
                      <p className="text-sm font-medium">{credit.nextPaymentDate ? formatDateLong(credit.nextPaymentDate) : '—'}</p>
                    </div>
                    <div>
                      <p className={cardStyles.detailsLabel}>Vencimiento</p>
                      <p className="text-sm font-medium">{formatDateLong(credit.endDate)}</p>
                    </div>
                  </div>
                  {credit.description && (
                    <>
                      <div className={cardStyles.detailsDivider} />
                      <p className="text-sm text-muted-foreground">{credit.description}</p>
                    </>
                  )}
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

        {/* Mobile-only: Details */}
        <div className="mt-3 sm:hidden">
          <div className={cardStyles.progressSection}>
            <div className="flex items-baseline justify-between mb-2.5">
              <p className="text-base">
                <span className={cardStyles.progressLabel}>{credit.paidInstallments}</span>
                <span className={cardStyles.progressSecondary}> de {credit.installments} cuotas</span>
              </p>
              <p className="text-base text-right">
                <span className={cn(cardStyles.progressLabel, 'font-semibold')}>
                  {formatCurrency(Math.max(0, credit.paidAmount))}
                </span>
                <span className={cardStyles.progressSecondary}> / {formatCurrency(credit.baseTotalAmount)}</span>
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Progress value={progressPercentage} className={cardStyles.progressBar} indicatorClassName={cardStyles.progressIndicator} />
              <span className={cn('text-xl', cardStyles.progressPercentage)}>
                {Math.round(progressPercentage)}%
              </span>
            </div>
          </div>
          {/* Details toggle row */}
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
              className={cardStyles.toggleButton}
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', showDetails && 'rotate-180')} />
              <span>{showDetails ? 'Ocultar detalle' : 'Ver detalle'}</span>
            </button>
          </div>
          {/* Collapsible details */}
          {showDetails && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className={cardStyles.detailsContainer}>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className={cardStyles.detailsLabel}>Capital</p>
                    <p className={cardStyles.detailsValue}>{formatCurrency(credit.basePrincipalAmount)}</p>
                  </div>
                  <div>
                    <p className={cardStyles.detailsLabel}>Total</p>
                    <p className={cardStyles.detailsValue}>{formatCurrency(credit.baseTotalAmount)}</p>
                  </div>
                  <div>
                    <p className={cardStyles.detailsLabel}>Intereses</p>
                    {hasInterest ? (
                      <p className={cn(cardStyles.detailsValue, 'text-red-500 dark:text-red-400')}>{formatCurrency(interestAmount)}</p>
                    ) : (
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Sin interés</p>
                    )}
                  </div>
                </div>
                <div className={cardStyles.detailsDivider} />
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className={cardStyles.detailsLabel}>Restante</p>
                    <p className={cardStyles.detailsValue}>{formatCurrency(Math.max(0, credit.remainingAmount))}</p>
                  </div>
                  <div>
                    <p className={cardStyles.detailsLabel}>Próximo pago</p>
                    <p className="text-sm font-medium">{credit.nextPaymentDate ? formatDateLong(credit.nextPaymentDate) : '—'}</p>
                  </div>
                  <div>
                    <p className={cardStyles.detailsLabel}>Vencimiento</p>
                    <p className="text-sm font-medium">{formatDateLong(credit.endDate)}</p>
                  </div>
                </div>
                {credit.description && (
                  <>
                    <div className={cardStyles.detailsDivider} />
                    <p className="text-sm text-muted-foreground">{credit.description}</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
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
