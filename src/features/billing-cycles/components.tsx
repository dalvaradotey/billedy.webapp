'use client';

import { useState, useTransition, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  Calendar,
  RefreshCw,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import { Badge } from '@/components/ui/badge';
import {
  createBillingCycle,
  updateBillingCycle,
  closeBillingCycle,
  reopenBillingCycle,
  deleteBillingCycle,
  recalculateSnapshot,
} from './actions';
import { createBillingCycleSchema, type CreateBillingCycleInput } from './schemas';
import type { BillingCycleWithTotals, BillingCycleSummary } from './types';

function formatCurrency(amount: number | string, currency: string = 'CLP'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatDateInput(date: Date | null): string {
  if (!date) return '';
  return date.toISOString().split('T')[0];
}

// ============================================================================
// BILLING CYCLES LIST
// ============================================================================

interface BillingCyclesListProps {
  cycles: BillingCycleWithTotals[];
  summary: BillingCycleSummary;
  projectId: string;
  userId: string;
  suggestedDates: { startDate: Date; endDate: Date; name: string } | null;
}

export function BillingCyclesList({
  cycles,
  summary,
  projectId,
  userId,
  suggestedDates,
}: BillingCyclesListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<BillingCycleWithTotals | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingToast, setPendingToast] = useState<{ id: string | number; message: string } | null>(
    null
  );

  const prevCyclesRef = useRef<BillingCycleWithTotals[]>(cycles);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const dataChanged =
      cycles !== prevCyclesRef.current ||
      cycles.length !== prevCyclesRef.current.length ||
      JSON.stringify(cycles.map((c) => c.id + c.status)) !==
        JSON.stringify(prevCyclesRef.current.map((c) => c.id + c.status));

    if (isRefreshing && dataChanged) {
      if (pendingToast) {
        toast.success(pendingToast.message, { id: pendingToast.id });
        setPendingToast(null);
      }
      setIsRefreshing(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    prevCyclesRef.current = cycles;
  }, [cycles, isRefreshing, pendingToast]);

  useEffect(() => {
    if (isRefreshing && !timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        if (pendingToast) {
          toast.success(pendingToast.message, { id: pendingToast.id });
          setPendingToast(null);
        }
        setIsRefreshing(false);
        timeoutRef.current = null;
      }, 5000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isRefreshing, pendingToast]);

  const onMutationStart = useCallback(() => {
    setIsRefreshing(true);
  }, []);

  const onMutationSuccess = useCallback((toastId: string | number, message: string) => {
    setPendingToast({ id: toastId, message });
  }, []);

  const onMutationError = useCallback((toastId: string | number, error: string) => {
    toast.error(error, { id: toastId });
    setIsRefreshing(false);
    setPendingToast(null);
  }, []);

  const handleEdit = (cycle: BillingCycleWithTotals) => {
    setEditingCycle(cycle);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingCycle(null);
  };

  const handleOpenDialog = () => {
    setEditingCycle(null);
    setIsDialogOpen(true);
  };

  const hasOpenCycle = cycles.some((c) => c.status === 'open');

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Ciclos"
          value={String(summary.totalCycles)}
          subtitle={`${summary.openCycles} abierto, ${summary.closedCycles} cerrados`}
          icon={<Calendar className="h-4 w-4 text-blue-600" />}
        />
        {summary.currentCycle && (
          <>
            <SummaryCard
              title="Ingresos del ciclo"
              value={formatCurrency(summary.currentCycle.currentIncome)}
              className="text-green-600"
            />
            <SummaryCard
              title="Gastos del ciclo"
              value={formatCurrency(summary.currentCycle.currentExpenses)}
              className="text-red-600"
            />
            <SummaryCard
              title="Balance"
              value={formatCurrency(summary.currentCycle.currentBalance)}
              subtitle={`${summary.currentCycle.daysRemaining} días restantes`}
              className={summary.currentCycle.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}
            />
          </>
        )}
        {!summary.currentCycle && (
          <div className="col-span-3 flex items-center justify-center p-4 border rounded-lg bg-muted/50">
            <p className="text-muted-foreground text-sm">No hay ciclo abierto</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">{cycles.length} ciclos</div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="gap-2"
              onClick={handleOpenDialog}
              disabled={hasOpenCycle}
            >
              <Plus className="h-4 w-4" />
              Nuevo ciclo
            </Button>
          </DialogTrigger>
          <BillingCycleDialogContent
            projectId={projectId}
            userId={userId}
            cycle={editingCycle}
            suggestedDates={suggestedDates}
            onSuccess={handleDialogClose}
            onMutationStart={onMutationStart}
            onMutationSuccess={onMutationSuccess}
            onMutationError={onMutationError}
          />
        </Dialog>
      </div>

      {/* Cycles List */}
      <div>
        {isRefreshing ? (
          <div className="space-y-3">
            {Array.from({ length: Math.max(1, cycles.length) }).map((_, i) => (
              <BillingCycleCardSkeleton key={i} />
            ))}
          </div>
        ) : cycles.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-lg">
            <p>No hay ciclos de facturación.</p>
            <p className="text-sm mt-1">Crea uno para comenzar a organizar tus finanzas por período.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cycles.map((cycle) => (
              <BillingCycleCard
                key={cycle.id}
                cycle={cycle}
                userId={userId}
                onEdit={() => handleEdit(cycle)}
                onMutationStart={onMutationStart}
                onMutationSuccess={onMutationSuccess}
                onMutationError={onMutationError}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUMMARY CARD
// ============================================================================

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}

function SummaryCard({ title, value, subtitle, icon, className }: SummaryCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
        {icon}
        {title}
      </div>
      <div className={`text-2xl font-bold ${className ?? ''}`}>{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

// ============================================================================
// SKELETON
// ============================================================================

export function BillingCycleCardSkeleton() {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-6" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>

      <div className="space-y-1">
        <Skeleton className="h-2 w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

// ============================================================================
// BILLING CYCLE CARD
// ============================================================================

interface BillingCycleCardProps {
  cycle: BillingCycleWithTotals;
  userId: string;
  onEdit: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

function BillingCycleCard({
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
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                Ajusta la fecha de cierre si es necesario. Se guardará un snapshot de los totales.
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
                      e.target.value ? new Date(e.target.value + 'T12:00:00') : new Date(cycle.endDate)
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Fecha original: {formatDate(cycle.endDate)}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCloseDialog(false)} disabled={isPending}>
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
          <p className="font-semibold text-green-600">{formatCurrency(cycle.currentIncome)}</p>
        </div>
        <div className="text-center p-2 rounded-md bg-muted/50">
          <p className="text-xs text-muted-foreground">Gastos</p>
          <p className="font-semibold text-red-600">{formatCurrency(cycle.currentExpenses)}</p>
        </div>
        <div className="text-center p-2 rounded-md bg-muted/50">
          <p className="text-xs text-muted-foreground">Ahorro</p>
          <p className="font-semibold text-blue-600">{formatCurrency(cycle.currentSavings)}</p>
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

// ============================================================================
// BILLING CYCLE DIALOG
// ============================================================================

interface BillingCycleDialogContentProps {
  projectId: string;
  userId: string;
  cycle: BillingCycleWithTotals | null;
  suggestedDates: { startDate: Date; endDate: Date; name: string } | null;
  onSuccess: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

function BillingCycleDialogContent({
  projectId,
  userId,
  cycle,
  suggestedDates,
  onSuccess,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: BillingCycleDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!cycle;

  const defaultValues = isEditing
    ? {
        projectId,
        name: cycle.name,
        startDate: new Date(cycle.startDate),
        endDate: new Date(cycle.endDate),
        notes: cycle.notes ?? '',
      }
    : {
        projectId,
        name: suggestedDates?.name ?? '',
        startDate: suggestedDates?.startDate ?? new Date(),
        endDate: suggestedDates?.endDate ?? new Date(),
        notes: '',
      };

  const form = useForm<CreateBillingCycleInput>({
    resolver: zodResolver(createBillingCycleSchema),
    defaultValues,
  });

  const onSubmit = (data: CreateBillingCycleInput) => {
    setError(null);
    const toastId = toast.loading(isEditing ? 'Actualizando ciclo...' : 'Creando ciclo...');
    onMutationStart?.();

    startTransition(async () => {
      const result = isEditing
        ? await updateBillingCycle(cycle.id, userId, {
            name: data.name,
            startDate: data.startDate,
            endDate: data.endDate,
            notes: data.notes,
          })
        : await createBillingCycle(userId, data);

      if (result.success) {
        form.reset();
        onSuccess();
        onMutationSuccess?.(toastId, isEditing ? 'Ciclo actualizado' : 'Ciclo creado');
      } else {
        setError(result.error);
        onMutationError?.(toastId, result.error);
      }
    });
  };

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar ciclo' : 'Nuevo ciclo de facturación'}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Modifica los detalles del ciclo.'
            : 'Crea un nuevo ciclo para organizar tus finanzas por período.'}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Ciclo Enero 2025" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Dates */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha inicio</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={formatDateInput(field.value)}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? new Date(e.target.value + 'T12:00:00') : undefined
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha fin (cierre)</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={formatDateInput(field.value)}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? new Date(e.target.value + 'T12:00:00') : undefined
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notas (opcional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Ej: Mes con bono de fin de año"
                    {...field}
                    value={field.value ?? ''}
                    rows={2}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear ciclo'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
