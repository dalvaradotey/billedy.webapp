'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog } from '@/components/ui/dialog';
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
  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [movementType, setMovementType] = useState<'deposit' | 'withdrawal'>('deposit');

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
    const toastId = toast.loading(fund.isArchived ? 'Restaurando fondo...' : 'Archivando fondo...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await archiveSavingsFund(fund.id, userId, !fund.isArchived);
      if (result.success) {
        onMutationSuccess?.(toastId, fund.isArchived ? 'Fondo restaurado' : 'Fondo archivado');
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

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${fund.isArchived ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
            {FUND_TYPE_ICONS[fund.type]}
          </div>
          <div>
            <p className="font-medium">{fund.name}</p>
            <p className="text-sm text-muted-foreground">
              {FUND_TYPE_LABELS[fund.type]} • {fund.accountType}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-green-600">
            {formatCurrency(currentBalance, fund.currencyCode)}
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
              <DropdownMenuItem onClick={() => openMovementDialog('deposit')}>
                <TrendingUp className="mr-2 h-4 w-4 text-green-600" />
                Depositar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openMovementDialog('withdrawal')}
                disabled={currentBalance <= 0}
              >
                <TrendingDown className="mr-2 h-4 w-4 text-red-600" />
                Retirar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchive}>
                {fund.isArchived ? (
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

          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar fondo de ahorro</AlertDialogTitle>
                <AlertDialogDescription>
                  ¿Estás seguro de eliminar este fondo? Se eliminarán también todos los movimientos
                  asociados. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isPending ? 'Eliminando...' : 'Eliminar'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
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
          </Dialog>
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
  );
}
