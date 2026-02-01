'use client';

import { useState, useTransition, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Target,
  Wallet,
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
import { CurrencyInput } from '@/components/currency-input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  createSavingsFund,
  updateSavingsFund,
  archiveSavingsFund,
  deleteSavingsFund,
  createMovement,
} from './actions';
import {
  createSavingsFundSchema,
  createMovementSchema,
  type CreateSavingsFundInput,
  type CreateMovementInput,
} from './schemas';
import type { SavingsFundWithProgress, SavingsSummary, SavingsMovement } from './types';

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

const FUND_TYPE_LABELS: Record<string, string> = {
  emergency: 'Emergencia',
  investment: 'Inversión',
  goal: 'Meta',
  other: 'Otro',
};

const FUND_TYPE_ICONS: Record<string, React.ReactNode> = {
  emergency: <Wallet className="h-4 w-4" />,
  investment: <TrendingUp className="h-4 w-4" />,
  goal: <Target className="h-4 w-4" />,
  other: <PiggyBank className="h-4 w-4" />,
};

const ACCOUNT_TYPE_OPTIONS = [
  'Cuenta de ahorro',
  'Depósito a plazo',
  'Cuenta corriente',
  'Efectivo',
  'Inversiones',
  'Otro',
];

// ============================================================================
// SAVINGS LIST
// ============================================================================

interface SavingsListProps {
  funds: SavingsFundWithProgress[];
  currencies: { id: string; code: string }[];
  summary: SavingsSummary;
  projectId?: string;
  userId: string;
  showArchived: boolean;
}

export function SavingsList({
  funds,
  currencies,
  summary,
  projectId,
  userId,
  showArchived,
}: SavingsListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFund, setEditingFund] = useState<SavingsFundWithProgress | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingToast, setPendingToast] = useState<{ id: string | number; message: string } | null>(
    null
  );

  // Ref para trackear los datos anteriores
  const prevFundsRef = useRef<SavingsFundWithProgress[]>(funds);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detectar cuando funds cambia y ocultar loading
  useEffect(() => {
    const dataChanged =
      funds !== prevFundsRef.current ||
      funds.length !== prevFundsRef.current.length ||
      JSON.stringify(funds.map((f) => f.id)) !==
        JSON.stringify(prevFundsRef.current.map((f) => f.id));

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

    prevFundsRef.current = funds;
  }, [funds, isRefreshing, pendingToast]);

  // Fallback timeout
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

  const handleEdit = (fund: SavingsFundWithProgress) => {
    setEditingFund(fund);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingFund(null);
  };

  const handleOpenDialog = () => {
    setEditingFund(null);
    setIsDialogOpen(true);
  };

  // Get default currency (first one, or CLP if available)
  const defaultCurrency =
    currencies.find((c) => c.code === 'CLP') ?? currencies[0] ?? { id: '', code: 'CLP' };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Fondos activos"
          value={String(summary.activeFunds)}
          subtitle={`de ${summary.totalFunds} total`}
          icon={<PiggyBank className="h-4 w-4 text-blue-600" />}
        />
        <SummaryCard
          title="Balance total"
          value={formatCurrency(summary.totalBalance)}
          subtitle={
            summary.totalTargetAmount > 0
              ? `${summary.overallProgress}% de ${formatCurrency(summary.totalTargetAmount)}`
              : undefined
          }
          className="text-green-600"
        />
        <SummaryCard
          title="Meta mensual"
          value={formatCurrency(summary.monthlyTargetTotal)}
          className="text-blue-600"
        />
        <SummaryCard
          title="Depositado este mes"
          value={formatCurrency(summary.monthlyDepositedTotal)}
          subtitle={
            summary.monthlyTargetTotal > 0
              ? `${Math.round((summary.monthlyDepositedTotal / summary.monthlyTargetTotal) * 100)}% de la meta`
              : undefined
          }
          className="text-orange-600"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {showArchived ? 'Mostrando archivados' : `${funds.length} fondos de ahorro`}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={handleOpenDialog}>
              <Plus className="h-4 w-4" />
              Nuevo fondo
            </Button>
          </DialogTrigger>
          <SavingsFundDialogContent
            projectId={projectId}
            userId={userId}
            currencies={currencies}
            defaultCurrencyId={defaultCurrency.id}
            fund={editingFund}
            onSuccess={handleDialogClose}
            onMutationStart={onMutationStart}
            onMutationSuccess={onMutationSuccess}
            onMutationError={onMutationError}
          />
        </Dialog>
      </div>

      {/* Funds List */}
      <div>
        {isRefreshing ? (
          <div className="space-y-3">
            {Array.from({ length: Math.max(1, funds.length) }).map((_, i) => (
              <SavingsFundCardSkeleton key={i} />
            ))}
          </div>
        ) : funds.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-lg">
            {showArchived ? 'No hay fondos archivados' : 'No hay fondos de ahorro registrados'}
          </div>
        ) : (
          <div className="space-y-3">
            {funds.map((fund) => (
              <SavingsFundCard
                key={fund.id}
                fund={fund}
                userId={userId}
                onEdit={() => handleEdit(fund)}
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

export function SavingsFundCardSkeleton() {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      {/* Header */}
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

      {/* Progress bars */}
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

      {/* Balance */}
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

function SavingsFundCard({
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

          {/* Delete Confirmation */}
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

          {/* Movement Dialog */}
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

      {/* Progress to goal (if target exists) */}
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

// ============================================================================
// MOVEMENT ROW
// ============================================================================

interface MovementRowProps {
  movement: SavingsMovement;
  currencyCode: string;
}

function MovementRow({ movement, currencyCode }: MovementRowProps) {
  const isDeposit = movement.type === 'deposit';
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        {isDeposit ? (
          <TrendingUp className="h-3 w-3 text-green-600" />
        ) : (
          <TrendingDown className="h-3 w-3 text-red-600" />
        )}
        <span className="text-muted-foreground">{formatDate(movement.date)}</span>
        {movement.description && (
          <span className="text-muted-foreground">• {movement.description}</span>
        )}
      </div>
      <span className={isDeposit ? 'text-green-600' : 'text-red-600'}>
        {isDeposit ? '+' : '-'}
        {formatCurrency(movement.amount, currencyCode)}
      </span>
    </div>
  );
}

// ============================================================================
// SAVINGS FUND DIALOG
// ============================================================================

interface SavingsFundDialogContentProps {
  projectId?: string;
  userId: string;
  currencies: { id: string; code: string }[];
  defaultCurrencyId: string;
  fund: SavingsFundWithProgress | null;
  onSuccess: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

function SavingsFundDialogContent({
  projectId,
  userId,
  currencies,
  defaultCurrencyId,
  fund,
  onSuccess,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: SavingsFundDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState(
    fund?.currencyId ?? defaultCurrencyId
  );

  const selectedCurrencyCode = currencies.find((c) => c.id === selectedCurrencyId)?.code ?? 'CLP';

  const isEditing = !!fund;

  const form = useForm<CreateSavingsFundInput>({
    resolver: zodResolver(createSavingsFundSchema),
    defaultValues: {
      projectId: fund?.projectId ?? projectId ?? undefined,
      name: fund?.name ?? '',
      type: fund?.type ?? 'goal',
      accountType: fund?.accountType ?? 'Cuenta de ahorro',
      currencyId: fund?.currencyId ?? defaultCurrencyId,
      targetAmount: fund?.targetAmount ? parseFloat(fund.targetAmount) : undefined,
      monthlyTarget: fund ? parseFloat(fund.monthlyTarget) : undefined,
      currentBalance: isEditing ? undefined : 0,
    },
  });

  const onSubmit = (data: CreateSavingsFundInput) => {
    setError(null);
    const toastId = toast.loading(isEditing ? 'Actualizando fondo...' : 'Creando fondo...');
    onMutationStart?.();

    startTransition(async () => {
      const result = isEditing
        ? await updateSavingsFund(fund.id, userId, {
            name: data.name,
            type: data.type,
            accountType: data.accountType,
            targetAmount: data.targetAmount,
            monthlyTarget: data.monthlyTarget,
          })
        : await createSavingsFund(userId, selectedCurrencyId, data);

      if (result.success) {
        form.reset();
        onSuccess();
        onMutationSuccess?.(toastId, isEditing ? 'Fondo actualizado' : 'Fondo creado');
      } else {
        setError(result.error);
        onMutationError?.(toastId, result.error);
      }
    });
  };

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar fondo' : 'Nuevo fondo de ahorro'}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Modifica los detalles del fondo de ahorro.'
            : 'Crea un nuevo fondo para organizar tus ahorros.'}
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
                  <Input placeholder="Ej: Fondo de emergencia" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Type & Account Type - 2 columns */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de fondo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="emergency">Emergencia</SelectItem>
                      <SelectItem value="investment">Inversión</SelectItem>
                      <SelectItem value="goal">Meta específica</SelectItem>
                      <SelectItem value="other">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accountType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de cuenta</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACCOUNT_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Currency (only for new funds) */}
          {!isEditing && currencies.length > 1 && (
            <div>
              <label className="text-sm font-medium">Moneda</label>
              <Select value={selectedCurrencyId} onValueChange={setSelectedCurrencyId}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.id} value={currency.id}>
                      {currency.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Target Amount & Monthly Target */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="targetAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meta total (opcional)</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value ?? undefined}
                      onChange={field.onChange}
                      currency={selectedCurrencyCode}
                      placeholder="0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="monthlyTarget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meta mensual</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value}
                      onChange={field.onChange}
                      currency={selectedCurrencyCode}
                      placeholder="0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Initial Balance (only for new funds) */}
          {!isEditing && (
            <FormField
              control={form.control}
              name="currentBalance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Balance inicial (opcional)</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value}
                      onChange={(value) => field.onChange(value ?? 0)}
                      currency={selectedCurrencyCode}
                      placeholder="0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear fondo'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}

// ============================================================================
// MOVEMENT DIALOG
// ============================================================================

interface MovementDialogContentProps {
  fundId: string;
  fundName: string;
  userId: string;
  type: 'deposit' | 'withdrawal';
  currentBalance: number;
  currencyCode: string;
  onSuccess: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

function MovementDialogContent({
  fundId,
  fundName,
  userId,
  type,
  currentBalance,
  currencyCode,
  onSuccess,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: MovementDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isDeposit = type === 'deposit';

  const form = useForm<CreateMovementInput>({
    resolver: zodResolver(createMovementSchema),
    defaultValues: {
      savingsFundId: fundId,
      type,
      amount: undefined,
      date: new Date(),
      description: '',
    },
  });

  const onSubmit = (data: CreateMovementInput) => {
    setError(null);

    // Validate withdrawal amount
    if (type === 'withdrawal' && data.amount > currentBalance) {
      setError(`No puedes retirar más de ${formatCurrency(currentBalance, currencyCode)}`);
      return;
    }

    const toastId = toast.loading(isDeposit ? 'Registrando depósito...' : 'Registrando retiro...');
    onMutationStart?.();

    startTransition(async () => {
      const result = await createMovement(userId, data);

      if (result.success) {
        form.reset();
        onSuccess();
        onMutationSuccess?.(toastId, isDeposit ? 'Depósito registrado' : 'Retiro registrado');
      } else {
        setError(result.error);
        onMutationError?.(toastId, result.error);
      }
    });
  };

  return (
    <DialogContent className="sm:max-w-[400px]">
      <DialogHeader>
        <DialogTitle>{isDeposit ? 'Depositar' : 'Retirar'}</DialogTitle>
        <DialogDescription>
          {isDeposit ? 'Registra un depósito en' : 'Registra un retiro de'} {fundName}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Current Balance Info */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Balance actual</span>
              <span className="font-bold text-green-600">
                {formatCurrency(currentBalance, currencyCode)}
              </span>
            </div>
          </div>

          {/* Amount */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monto</FormLabel>
                <FormControl>
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    currency={currencyCode}
                    placeholder="0"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Date */}
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    value={field.value ? field.value.toISOString().split('T')[0] : ''}
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

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción (opcional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Ej: Depósito mensual"
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
            <Button
              type="submit"
              disabled={isPending}
              className={`w-full sm:w-auto ${isDeposit ? '' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {isPending
                ? 'Guardando...'
                : isDeposit
                  ? 'Registrar depósito'
                  : 'Registrar retiro'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
