'use client';

import { useState, useTransition } from 'react';
import { useIsMobile } from '@/hooks';
import { toast } from 'sonner';
import {
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveDrawer } from '@/components/ui/drawer';
import { Progress } from '@/components/ui/progress';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CardActions } from '@/components/card-actions';

import { formatCurrency } from '@/lib/formatting';
import { archiveSavingsFund, deleteSavingsFund } from '../actions';
import type { SavingsFundWithProgress } from '../types';
import { FUND_TYPE_LABELS, FUND_TYPE_ICONS } from './constants';
import { MovementRow } from './movement-row';
import { MovementDialogContent } from './movement-dialog';

// ============================================================================
// SKELETON
// ============================================================================

export function SavingsFundCardSkeleton() {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Skeleton className="h-2 w-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="space-y-1">
          <Skeleton className="h-2 w-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-6 w-28" />
      </div>
    </div>
  );
}

// ============================================================================
// SAVINGS FUND CARD
// ============================================================================

interface SavingsFundCardProps {
  fund: SavingsFundWithProgress;
  userId: string;
  onEdit: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

export function SavingsFundCard({
  fund,
  userId,
  onEdit,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: SavingsFundCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [movementType, setMovementType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [showActionsDrawer, setShowActionsDrawer] = useState(false);
  const [showInlineActions, setShowInlineActions] = useState(false);
  const isMobile = useIsMobile();

  const handleDelete = () => {
    const toastId = toast.loading('Eliminando fondo...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await deleteSavingsFund(fund.id, userId);
      setShowDeleteDialog(false);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Fondo eliminado');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleArchive = () => {
    setShowArchiveDialog(false);
    const toastId = toast.loading('Archivando fondo...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await archiveSavingsFund(fund.id, userId, true);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Fondo archivado');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleRestore = () => {
    const toastId = toast.loading('Restaurando fondo...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await archiveSavingsFund(fund.id, userId, false);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Fondo restaurado');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const openMovementDialog = (type: 'deposit' | 'withdrawal') => {
    setMovementType(type);
    setShowMovementDialog(true);
  };

  const currentBalance = parseFloat(fund.currentBalance);
  const targetAmount = fund.targetAmount ? parseFloat(fund.targetAmount) : null;
  const monthlyTarget = parseFloat(fund.monthlyTarget);

  const progressColor =
    fund.progressPercentage >= 100
      ? 'bg-green-500'
      : fund.progressPercentage >= 50
        ? 'bg-blue-500'
        : 'bg-orange-500';

  const monthlyProgressColor =
    fund.monthlyPercentage >= 100
      ? 'bg-green-500'
      : fund.monthlyPercentage >= 50
        ? 'bg-blue-500'
        : 'bg-orange-500';

  const description = `${FUND_TYPE_LABELS[fund.type]} • ${fund.accountType}`;

  const actions = [
    {
      key: 'deposit',
      label: 'Depositar',
      icon: <TrendingUp className="text-emerald-600 dark:text-emerald-400" />,
      onClick: () => openMovementDialog('deposit'),
    },
    {
      key: 'withdrawal',
      label: 'Retirar',
      icon: <TrendingDown className="text-red-600 dark:text-red-400" />,
      onClick: () => openMovementDialog('withdrawal'),
      disabled: currentBalance <= 0,
    },
    {
      key: 'edit',
      label: 'Editar',
      icon: <Pencil />,
      onClick: onEdit,
    },
    fund.isArchived
      ? {
          key: 'restore',
          label: 'Restaurar',
          icon: <ArchiveRestore />,
          onClick: handleRestore,
        }
      : {
          key: 'archive',
          label: 'Archivar',
          icon: <Archive />,
          onClick: () => setShowArchiveDialog(true),
          closeOnClick: false,
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
        className={`rounded-2xl border bg-card p-4 space-y-3 transition-colors cursor-pointer active:bg-muted/50 ${fund.isArchived ? 'opacity-60' : ''}`}
      >
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Fund Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-3 sm:p-2.5 rounded-xl flex-shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              {FUND_TYPE_ICONS[fund.type]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-base truncate">{fund.name}</p>
              <p className="text-sm text-muted-foreground truncate">{description}</p>
            </div>
          </div>

          {/* Balance & Actions */}
          <div className="flex items-center justify-between sm:justify-end gap-3 ml-[60px] sm:ml-0">
            <CardActions
              actions={actions}
              title={fund.name}
              description={description}
              isPending={isPending}
              showInline={showInlineActions}
              onToggleInline={() => setShowInlineActions(!showInlineActions)}
              drawerOpen={showActionsDrawer}
              onDrawerOpenChange={setShowActionsDrawer}
            >
              <div className="sm:text-right sm:min-w-[120px]">
                <span className="text-xl sm:text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(currentBalance, fund.currencyCode)}
                </span>
              </div>
            </CardActions>
          </div>
        </div>

        {/* Progress to goal */}
        {targetAmount && targetAmount > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progreso hacia meta</span>
              <span>{fund.progressPercentage}%</span>
            </div>
            <Progress
              value={Math.min(fund.progressPercentage, 100)}
              className="h-2"
              indicatorClassName={progressColor}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatCurrency(currentBalance, fund.currencyCode)}</span>
              <span>de {formatCurrency(targetAmount, fund.currencyCode)}</span>
            </div>
          </div>
        )}

        {/* Monthly progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Meta mensual</span>
            <span>{fund.monthlyPercentage}%</span>
          </div>
          <Progress
            value={Math.min(fund.monthlyPercentage, 100)}
            className="h-2"
            indicatorClassName={monthlyProgressColor}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatCurrency(fund.monthlyDeposited, fund.currencyCode)} este mes</span>
            <span>de {formatCurrency(monthlyTarget, fund.currencyCode)}</span>
          </div>
        </div>

        {/* Recent movements */}
        {fund.recentMovements.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Últimos movimientos</p>
            <div className="space-y-1">
              {fund.recentMovements.slice(0, 3).map((movement) => (
                <MovementRow key={movement.id} movement={movement} currencyCode={fund.currencyCode} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Archive Confirmation */}
      <ConfirmDialog
        open={showArchiveDialog}
        onOpenChange={setShowArchiveDialog}
        icon={<Archive className="h-7 w-7" />}
        iconVariant="default"
        title="Archivar fondo"
        description={
          <>
            ¿Archivar <span className="font-medium text-foreground">{fund.name}</span>?
            El fondo no aparecerá en tus listados activos pero podrás restaurarlo en cualquier momento.
          </>
        }
        confirmText={isPending ? 'Archivando...' : 'Archivar'}
        size="sm"
        isPending={isPending}
        onConfirm={handleArchive}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        icon={<Trash2 className="h-7 w-7" />}
        iconVariant="destructive"
        title="Eliminar fondo de ahorro"
        description={
          <>
            ¿Eliminar <span className="font-medium text-foreground">{fund.name}</span> permanentemente?
            Se eliminarán también todos los movimientos asociados.
          </>
        }
        confirmText={isPending ? 'Eliminando...' : 'Eliminar'}
        variant="destructive"
        size="sm"
        requireConfirmText="ELIMINAR"
        isPending={isPending}
        onConfirm={handleDelete}
      />

      {/* Movement Dialog */}
      <ResponsiveDrawer open={showMovementDialog} onOpenChange={setShowMovementDialog}>
        <MovementDialogContent
          fundId={fund.id}
          fundName={fund.name}
          userId={userId}
          type={movementType}
          currentBalance={currentBalance}
          currencyCode={fund.currencyCode}
          onSuccess={() => setShowMovementDialog(false)}
          onMutationStart={onMutationStart}
          onMutationSuccess={onMutationSuccess}
          onMutationError={onMutationError}
        />
      </ResponsiveDrawer>
    </>
  );
}
