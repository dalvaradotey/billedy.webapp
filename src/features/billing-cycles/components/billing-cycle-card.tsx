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
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  ResponsiveDrawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CardActions } from '@/components/card-actions';

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
        className={`rounded-2xl border bg-card p-4 transition-colors cursor-pointer active:bg-muted/50 ${!isOpen ? 'opacity-75' : ''}`}
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
                  {formatDate(cycle.startDate)} - {formatDate(cycle.endDate)}
                </p>
              </div>

              {/* Desktop: Balance + Actions inline */}
              <div className="hidden sm:flex items-center gap-3">
                <CardActions
                  actions={actions}
                  title={cycle.name}
                  description={`${formatDate(cycle.startDate)} - ${formatDate(cycle.endDate)}`}
                  isPending={isPending}
                  showInline={showInlineActions}
                  onToggleInline={() => setShowInlineActions(!showInlineActions)}
                  drawerOpen={showActionsDrawer}
                  onDrawerOpenChange={setShowActionsDrawer}
                >
                  <div className="text-right min-w-[120px]">
                    <p
                      className={`text-lg font-bold tabular-nums ${
                        cycle.currentBalance >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatCurrency(cycle.currentBalance)}
                    </p>
                    <p className="text-xs text-muted-foreground">balance</p>
                  </div>
                </CardActions>
              </div>
            </div>

            {/* Mobile: Balance row */}
            <div className="flex items-center justify-between mt-2 sm:hidden">
              <p
                className={`text-xl font-bold tabular-nums ${
                  cycle.currentBalance >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {formatCurrency(cycle.currentBalance)}
              </p>
              <p className="text-sm text-muted-foreground">balance</p>
              <CardActions
                actions={actions}
                title={cycle.name}
                description={`${formatDate(cycle.startDate)} - ${formatDate(cycle.endDate)}`}
                isPending={isPending}
                showInline={false}
                onToggleInline={() => {}}
                drawerOpen={showActionsDrawer}
                onDrawerOpenChange={setShowActionsDrawer}
              />
            </div>
          </div>
        </div>

        {/* Progress (for open cycles) */}
        {isOpen && (
          <div className="mt-3">
            <Progress value={progressPercentage} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
              <span>{cycle.daysElapsed} días transcurridos</span>
              <span>{cycle.daysRemaining} días restantes</span>
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <div className="text-center p-2.5 rounded-xl bg-muted/50">
            <p className="text-xs text-muted-foreground">Ingresos</p>
            <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(cycle.currentIncome)}
            </p>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-muted/50">
            <p className="text-xs text-muted-foreground">Gastos</p>
            <p className="font-semibold tabular-nums text-red-600 dark:text-red-400">
              {formatCurrency(cycle.currentExpenses)}
            </p>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-muted/50">
            <p className="text-xs text-muted-foreground">Ahorro</p>
            <p className="font-semibold tabular-nums text-blue-600 dark:text-blue-400">
              {formatCurrency(cycle.currentSavings)}
            </p>
          </div>
          <div className="text-center p-2.5 rounded-xl bg-muted/50">
            <p className="text-xs text-muted-foreground">Balance</p>
            <p
              className={`font-semibold tabular-nums ${
                cycle.currentBalance >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatCurrency(cycle.currentBalance)}
            </p>
          </div>
        </div>

        {cycle.notes && (
          <p className="text-sm text-muted-foreground mt-2">{cycle.notes}</p>
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
