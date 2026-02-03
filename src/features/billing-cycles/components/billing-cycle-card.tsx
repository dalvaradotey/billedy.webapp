'use client';

import { useState, useTransition } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${!isOpen ? 'opacity-75' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {isOpen ? (
            <Clock className="h-5 w-5 text-blue-600" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{cycle.name}</p>
              <Badge variant={isOpen ? 'default' : 'secondary'}>
                {isOpen ? 'Abierto' : 'Cerrado'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDate(cycle.startDate)} - {formatDate(cycle.endDate)}
            </p>
          </div>
        </div>

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
            {isOpen ? (
              <>
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleOpenCloseDialog}>
                  <Lock className="mr-2 h-4 w-4" />
                  Cerrar ciclo
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={handleReopen}>
                  <Unlock className="mr-2 h-4 w-4" />
                  Reabrir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRecalculate}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recalcular snapshot
                </DropdownMenuItem>
              </>
            )}
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

        {/* Close Confirmation */}
        <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Cerrar ciclo</DialogTitle>
              <DialogDescription>
                Ajusta la fecha de cierre si es necesario. Se guardará un snapshot de los
                totales.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
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
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCloseDialog(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button onClick={handleClose} disabled={isPending}>
                {isPending ? 'Cerrando...' : 'Cerrar ciclo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar ciclo</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Eliminar este ciclo? Esta acción no se puede deshacer.
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
      </div>

      {/* Progress (for open cycles) */}
      {isOpen && (
        <div className="space-y-1">
          <Progress value={progressPercentage} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{cycle.daysElapsed} días transcurridos</span>
            <span>{cycle.daysRemaining} días restantes</span>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
        <div className="text-center p-2 rounded-md bg-muted/50">
          <p className="text-xs text-muted-foreground">Ingresos</p>
          <p className="font-semibold text-green-600">
            {formatCurrency(cycle.currentIncome)}
          </p>
        </div>
        <div className="text-center p-2 rounded-md bg-muted/50">
          <p className="text-xs text-muted-foreground">Gastos</p>
          <p className="font-semibold text-red-600">
            {formatCurrency(cycle.currentExpenses)}
          </p>
        </div>
        <div className="text-center p-2 rounded-md bg-muted/50">
          <p className="text-xs text-muted-foreground">Ahorro</p>
          <p className="font-semibold text-blue-600">
            {formatCurrency(cycle.currentSavings)}
          </p>
        </div>
        <div className="text-center p-2 rounded-md bg-muted/50">
          <p className="text-xs text-muted-foreground">Balance</p>
          <p
            className={`font-semibold ${cycle.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {formatCurrency(cycle.currentBalance)}
          </p>
        </div>
      </div>

      {cycle.notes && <p className="text-sm text-muted-foreground pt-2">{cycle.notes}</p>}
    </div>
  );
}
