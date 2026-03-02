'use client';

import { useState, useTransition } from 'react';
import { useIsMobile } from '@/hooks';
import { toast } from 'sonner';
import {
  Pencil,
  Trash2,
  Lock,
  Unlock,
  RefreshCw,
  CheckCircle2,
  Clock,
  MoreVertical,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  ResponsiveDrawer,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { cardStyles } from '@/components/card-styles';

import { formatCurrency, formatDate } from '@/lib/formatting';
import {
  closeBillingCycle,
  reopenBillingCycle,
  deleteBillingCycle,
  recalculateSnapshot,
} from '../actions';
import type { BillingCycleWithTotals } from '../types';
import { formatDateInput } from './utils';

interface BillingCycleCardProps {
  cycle: BillingCycleWithTotals;
  userId: string;
  onEdit: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

export function BillingCycleCard({
  cycle,
  userId,
  onEdit,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: BillingCycleCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeEndDate, setCloseEndDate] = useState<Date>(new Date(cycle.endDate));
  const [showActionsDrawer, setShowActionsDrawer] = useState(false);
  const [showInlineActions, setShowInlineActions] = useState(false);
  const isMobile = useIsMobile();

  const isOpen = cycle.status === 'open';
  const progressPercentage =
    cycle.daysTotal > 0 ? Math.round((cycle.daysElapsed / cycle.daysTotal) * 100) : 0;

  const handleOpenCloseDialog = () => {
    setCloseEndDate(new Date(cycle.endDate));
    setShowCloseDialog(true);
  };

  const handleClose = () => {
    const toastId = toast.loading('Cerrando ciclo...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await closeBillingCycle(cycle.id, userId, { endDate: closeEndDate });
      setShowCloseDialog(false);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Ciclo cerrado');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleReopen = () => {
    const toastId = toast.loading('Reabriendo ciclo...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await reopenBillingCycle(cycle.id, userId);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Ciclo reabierto');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleDelete = () => {
    const toastId = toast.loading('Eliminando ciclo...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await deleteBillingCycle(cycle.id, userId);
      setShowDeleteDialog(false);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Ciclo eliminado');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleRecalculate = () => {
    const toastId = toast.loading('Recalculando snapshot...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await recalculateSnapshot(cycle.id, userId);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Snapshot recalculado');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const actions = [
    ...(isOpen
      ? [
          {
            key: 'edit',
            label: 'Editar',
            icon: <Pencil />,
            onClick: onEdit,
          },
          {
            key: 'close',
            label: 'Cerrar ciclo',
            icon: <Lock />,
            onClick: handleOpenCloseDialog,
            closeOnClick: false,
          },
        ]
      : [
          {
            key: 'reopen',
            label: 'Reabrir',
            icon: <Unlock />,
            onClick: handleReopen,
          },
          {
            key: 'recalculate',
            label: 'Recalcular snapshot',
            icon: <RefreshCw />,
            onClick: handleRecalculate,
          },
        ]),
    {
      key: 'delete',
      label: 'Eliminar',
      icon: <Trash2 />,
      onClick: () => setShowDeleteDialog(true),
      variant: 'destructive' as const,
    },
  ];

  const description = `${formatDate(cycle.startDate)} - ${formatDate(cycle.endDate)}`;

  const balanceColor = cycle.currentBalance >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';

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
          !isOpen && 'opacity-75'
        )}
      >
        {/* Header: Icon + Info + Actions */}
        <div className="flex items-start gap-3">
          {/* Status Icon */}
          {isOpen ? (
            <div className="p-3 sm:p-2.5 rounded-xl flex-shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Clock className="h-6 w-6 sm:h-5 sm:w-5" />
            </div>
          ) : (
            <div className="p-3 sm:p-2.5 rounded-xl flex-shrink-0 bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6 sm:h-5 sm:w-5" />
            </div>
          )}

          {/* Info */}
          <div className="min-w-0 flex-1">
            {/* Row 1: Title + Balance + actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-base truncate">{cycle.name}</p>
                  <Badge
                    variant={isOpen ? 'default' : 'secondary'}
                    className="shrink-0 text-[10px] px-1.5 py-0"
                  >
                    {isOpen ? 'Abierto' : 'Cerrado'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {description}
                </p>
              </div>

              {/* Desktop: Balance */}
              <p className={cn('hidden sm:block text-2xl font-bold tabular-nums shrink-0', balanceColor)}>
                {formatCurrency(cycle.currentBalance)}
              </p>

              {/* Actions toggle */}
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

            {/* Mobile: Balance below description */}
            <p className={cn('text-2xl font-bold tabular-nums mt-1 sm:hidden', balanceColor)}>
              {formatCurrency(cycle.currentBalance)}
            </p>

            {/* Mobile actions drawer */}
            <Drawer open={showActionsDrawer} onOpenChange={setShowActionsDrawer}>
              <DrawerContent>
                <DrawerHeader className="text-left pb-2">
                  <DrawerTitle>{cycle.name}</DrawerTitle>
                  <DrawerDescription>{description}</DrawerDescription>
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

        {/* Progress (for open cycles) */}
        {isOpen && (
          <div className={cn('mt-3', cardStyles.progressSection)}>
            <div className="flex items-baseline justify-between mb-2.5">
              <p className="text-sm">
                <span className={cardStyles.progressLabel}>{cycle.daysElapsed}</span>
                <span className={cardStyles.progressSecondary}> de {cycle.daysTotal} días</span>
              </p>
              <p className="text-sm text-right">
                <span className={cn(cardStyles.progressLabel, 'font-semibold')}>
                  {cycle.daysRemaining}
                </span>
                <span className={cardStyles.progressSecondary}> días restantes</span>
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Progress value={progressPercentage} className={cardStyles.progressBar} indicatorClassName={cardStyles.progressIndicator} />
              <span className={cn('text-lg', cardStyles.progressPercentage)}>
                {progressPercentage}%
              </span>
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <div className="text-center p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40">
            <p className="text-xs text-muted-foreground">Ingresos</p>
            <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(cycle.currentIncome)}
            </p>
            {cycle.pendingIncome > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Pagado: {formatCurrency(cycle.paidIncome)} · Pend: {formatCurrency(cycle.pendingIncome)}
              </p>
            )}
          </div>
          <div className="text-center p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40">
            <p className="text-xs text-muted-foreground">Gastos</p>
            <p className="font-semibold tabular-nums text-red-600 dark:text-red-400">
              {formatCurrency(cycle.currentExpenses)}
            </p>
            {cycle.pendingExpenses > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Pagado: {formatCurrency(cycle.paidExpenses)} · Pend: {formatCurrency(cycle.pendingExpenses)}
              </p>
            )}
          </div>
          <div className="text-center p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40">
            <p className="text-xs text-muted-foreground">Ahorro</p>
            <p className="font-semibold tabular-nums text-blue-600 dark:text-blue-400">
              {formatCurrency(cycle.currentSavings)}
            </p>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className={cn('font-semibold tabular-nums', balanceColor)}>
              {formatCurrency(cycle.currentBalance)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">en base a pagados</p>
          </div>
        </div>

        {cycle.notes && (
          <p className="text-sm text-muted-foreground mt-2">{cycle.notes}</p>
        )}

        {/* Desktop: Inline actions */}
        {showInlineActions && (
          <div className="mt-3 hidden sm:block animate-in fade-in slide-in-from-top-2 duration-200">
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
        )}
      </div>

      {/* Close Cycle Drawer */}
      <ResponsiveDrawer open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-lg">
            <DrawerHeader>
              <DrawerTitle>Cerrar ciclo</DrawerTitle>
              <DrawerDescription>
                Ajusta la fecha de cierre si es necesario. Se guardará un snapshot de los
                totales.
              </DrawerDescription>
            </DrawerHeader>
            <div className="space-y-4 px-4 pb-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha de cierre</label>
                <Input
                  type="date"
                  value={formatDateInput(closeEndDate)}
                  onChange={(e) =>
                    setCloseEndDate(
                      e.target.value
                        ? new Date(e.target.value + 'T12:00:00')
                        : new Date(cycle.endDate)
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Fecha original: {formatDate(cycle.endDate)}
                </p>
              </div>
              <DrawerFooter className="pt-4">
                <Button onClick={handleClose} disabled={isPending} className="w-full">
                  {isPending ? 'Cerrando...' : 'Cerrar ciclo'}
                </Button>
              </DrawerFooter>
            </div>
          </div>
        </DrawerContent>
      </ResponsiveDrawer>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        icon={<Trash2 className="h-7 w-7" />}
        iconVariant="destructive"
        title="Eliminar ciclo"
        description="¿Eliminar este ciclo? Esta acción no se puede deshacer."
        confirmText={isPending ? 'Eliminando...' : 'Eliminar'}
        variant="destructive"
        size="sm"
        isPending={isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
