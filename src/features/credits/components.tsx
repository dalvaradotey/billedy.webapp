'use client';

import { useState, useTransition, useEffect, useCallback, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  CreditCard as CreditCardIcon,
  Calendar,
  Receipt,
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
import { InstallmentSelector } from '@/components/installment-selector';
import { CategorySelector } from '@/components/category-selector';
import { EntitySelector } from '@/components/entity-selector';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Entity } from '@/features/entities/types';
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
  createCredit,
  updateCredit,
  archiveCredit,
  deleteCredit,
  generateAllCreditInstallments,
} from './actions';
import { createCreditSchema, type CreateCreditInput } from './schemas';
import type { CreditWithProgress, CreditSummary } from './types';

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

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: 'Mensual',
  biweekly: 'Quincenal',
  weekly: 'Semanal',
};

/**
 * Calcula cuántas cuotas están vencidas basándose en la fecha de inicio,
 * frecuencia y la fecha actual (solo cuenta cuotas cuya fecha ya pasó)
 */
function calculatePaidInstallments(
  startDate: Date | undefined,
  frequency: 'monthly' | 'biweekly' | 'weekly' | undefined,
  totalInstallments: number | undefined
): number {
  if (!startDate || !frequency || !totalInstallments) return 0;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Inicio del día
  const start = new Date(startDate);

  // Si la fecha de inicio es hoy o en el futuro, no hay cuotas vencidas
  if (start >= today) return 0;

  let paidCount = 0;

  // Iterar cada cuota y verificar si su fecha ya pasó
  for (let i = 0; i < totalInstallments; i++) {
    const paymentDate = new Date(start);

    switch (frequency) {
      case 'monthly':
        paymentDate.setMonth(paymentDate.getMonth() + i);
        break;
      case 'biweekly':
        paymentDate.setDate(paymentDate.getDate() + i * 14);
        break;
      case 'weekly':
        paymentDate.setDate(paymentDate.getDate() + i * 7);
        break;
    }

    // Solo contar si la fecha ya pasó (antes de hoy)
    if (paymentDate < today) {
      paidCount++;
    } else {
      // Las fechas son secuenciales, si esta no está vencida, las siguientes tampoco
      break;
    }
  }

  return paidCount;
}

interface CreditListProps {
  credits: CreditWithProgress[];
  categories: { id: string; name: string; color: string }[];
  entities: Entity[];
  accounts: { id: string; name: string; type: string }[];
  summary: CreditSummary;
  projectId: string;
  userId: string;
  showArchived: boolean;
}

export function CreditList({
  credits,
  categories,
  entities,
  accounts,
  summary,
  projectId,
  userId,
  showArchived,
}: CreditListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCredit, setEditingCredit] = useState<CreditWithProgress | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingToast, setPendingToast] = useState<{ id: string | number; message: string } | null>(null);

  // Ref para trackear los datos anteriores
  const prevCreditsRef = useRef<CreditWithProgress[]>(credits);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detectar cuando credits cambia y ocultar loading
  useEffect(() => {
    // Comparar si los datos cambiaron (por referencia o longitud)
    const dataChanged = credits !== prevCreditsRef.current ||
                        credits.length !== prevCreditsRef.current.length ||
                        JSON.stringify(credits.map(c => c.id)) !== JSON.stringify(prevCreditsRef.current.map(c => c.id));

    if (isRefreshing && dataChanged) {
      // ¡La data cambió! Mostrar toast de éxito y ocultar loading
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

    prevCreditsRef.current = credits;
  }, [credits, isRefreshing, pendingToast]);

  // Fallback timeout: si después de 5s no cambia, ocultar igual
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

  const onMutationStart = useCallback((toastId: string | number) => {
    setIsRefreshing(true);
  }, []);

  const onMutationSuccess = useCallback((toastId: string | number, message: string) => {
    // No mostramos éxito aún, esperamos a que la data cambie
    setPendingToast({ id: toastId, message });
  }, []);

  const onMutationError = useCallback((toastId: string | number, error: string) => {
    // En error, ocultamos loading inmediatamente
    toast.error(error, { id: toastId });
    setIsRefreshing(false);
    setPendingToast(null);
  }, []);

  const handleEdit = (credit: CreditWithProgress) => {
    setEditingCredit(credit);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingCredit(null);
  };

  const handleOpenDialog = () => {
    setEditingCredit(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Créditos activos"
          value={String(summary.activeCredits)}
          subtitle={`de ${summary.totalCredits} total`}
          icon={<CreditCardIcon className="h-4 w-4 text-blue-600" />}
        />
        <SummaryCard
          title="Deuda total"
          value={formatCurrency(summary.totalDebt)}
          className="text-red-600"
        />
        <SummaryCard
          title="Total pagado"
          value={formatCurrency(summary.totalPaid)}
          className="text-green-600"
        />
        <SummaryCard
          title="Cuota mensual"
          value={formatCurrency(summary.monthlyPayment)}
          subtitle="aproximado"
          className="text-orange-600"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {showArchived ? 'Mostrando archivados' : `${credits.length} créditos`}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={handleOpenDialog}>
              <Plus className="h-4 w-4" />
              Nuevo crédito
            </Button>
          </DialogTrigger>
          <CreditDialogContent
            projectId={projectId}
            userId={userId}
            categories={categories}
            entities={entities}
            accounts={accounts}
            credit={editingCredit}
            onSuccess={handleDialogClose}
            onMutationStart={onMutationStart}
            onMutationSuccess={onMutationSuccess}
            onMutationError={onMutationError}
          />
        </Dialog>
      </div>

      {/* Credit List */}
      <div>
        {isRefreshing ? (
          <div className="space-y-3">
            {/* Mostrar al menos 1 skeleton, o la cantidad actual de créditos */}
            {Array.from({ length: Math.max(1, credits.length) }).map((_, i) => (
              <CreditCardSkeleton key={i} />
            ))}
          </div>
        ) : credits.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-lg">
            {showArchived
              ? 'No hay créditos archivados'
              : 'No hay créditos registrados'}
          </div>
        ) : (
          <div className="space-y-3">
            {credits.map((credit) => (
              <CreditCard
                key={credit.id}
                credit={credit}
                userId={userId}
                onEdit={() => handleEdit(credit)}
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

function CreditCardSkeleton() {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-3 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <Skeleton className="h-2 w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

interface CreditCardProps {
  credit: CreditWithProgress;
  userId: string;
  onEdit: () => void;
  onMutationStart?: (toastId: string | number) => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

const CONFIRM_DELETE_TEXT = 'ELIMINAR';

function CreditCard({ credit, userId, onEdit, onMutationStart, onMutationSuccess, onMutationError }: CreditCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const canDelete = confirmText === CONFIRM_DELETE_TEXT;

  const handleCloseDeleteDialog = (open: boolean) => {
    setShowDeleteDialog(open);
    if (!open) {
      setConfirmText('');
    }
  };

  const handleDelete = () => {
    if (!canDelete) return;
    const toastId = toast.loading('Eliminando crédito...');
    onMutationStart?.(toastId);
    startTransition(async () => {
      const result = await deleteCredit(credit.id, userId);
      setShowDeleteDialog(false);
      setConfirmText('');
      if (result.success) {
        onMutationSuccess?.(toastId, 'Crédito eliminado');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleArchive = () => {
    const toastId = toast.loading(credit.isArchived ? 'Restaurando crédito...' : 'Archivando crédito...');
    onMutationStart?.(toastId);
    startTransition(async () => {
      const result = await archiveCredit(credit.id, userId, !credit.isArchived);
      if (result.success) {
        onMutationSuccess?.(toastId, credit.isArchived ? 'Crédito restaurado' : 'Crédito archivado');
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

  const progressColor =
    credit.progressPercentage >= 100
      ? 'bg-green-500'
      : credit.progressPercentage >= 50
      ? 'bg-blue-500'
      : 'bg-orange-500';

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${credit.isArchived ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {credit.entityImageUrl && (
            <img
              src={credit.entityImageUrl}
              alt={credit.entityName ?? ''}
              className="h-8 w-8 rounded-full object-cover"
            />
          )}
          <div>
            <p className="font-medium">{credit.name}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              {credit.entityName && <span>{credit.entityName} • </span>}
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: credit.categoryColor }}
              />
              {credit.categoryName} • {FREQUENCY_LABELS[credit.frequency]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {credit.progressPercentage}%
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
                <span className="sr-only">Acciones</span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v.01M12 12v.01M12 18v.01" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowGenerateDialog(true)}>
                <Receipt className="mr-2 h-4 w-4" />
                Generar cuotas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchive}>
                {credit.isArchived ? (
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
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={showDeleteDialog} onOpenChange={handleCloseDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive">
                  ¿Eliminar crédito permanentemente?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <span className="block">
                    Esta acción <strong>no se puede deshacer</strong>. Se eliminará el crédito
                    &quot;{credit.name}&quot; junto con todas las{' '}
                    <strong>{credit.paidInstallments} transacciones</strong> asociadas.
                  </span>
                  <span className="block">
                    Para confirmar, escribe <strong>{CONFIRM_DELETE_TEXT}</strong> a continuación:
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                <Input
                  placeholder={`Escribe ${CONFIRM_DELETE_TEXT} para confirmar`}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  className={confirmText && !canDelete ? 'border-destructive' : ''}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={!canDelete || isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {isPending ? 'Eliminando...' : 'Eliminar crédito y transacciones'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Generate Installments Confirmation Dialog */}
          <AlertDialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Generar cuotas</AlertDialogTitle>
                <AlertDialogDescription>
                  ¿Generar todas las cuotas pendientes como transacciones? Esto creará las transacciones
                  correspondientes a las cuotas restantes del crédito.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleGenerateInstallments} disabled={isPending}>
                  {isPending ? 'Generando...' : 'Generar cuotas'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <Progress
          value={Math.min(credit.progressPercentage, 100)}
          className="h-2"
          indicatorClassName={progressColor}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {credit.paidInstallments} de {credit.installments} cuotas
          </span>
          <span>
            {formatCurrency(credit.paidAmount)} de {formatCurrency(credit.baseTotalAmount)}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">Capital:</span>{' '}
          <span className="font-medium">{formatCurrency(credit.basePrincipalAmount)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Total:</span>{' '}
          <span className="font-medium">{formatCurrency(credit.baseTotalAmount)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Intereses:</span>{' '}
          <span className="font-medium text-red-500">
            {formatCurrency(parseFloat(credit.baseTotalAmount) - parseFloat(credit.basePrincipalAmount))}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Cuota:</span>{' '}
          <span className="font-medium">{formatCurrency(credit.installmentAmount)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Restante:</span>{' '}
          <span className="font-medium">{formatCurrency(credit.remainingAmount)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Próximo:</span>{' '}
          <span>{formatDate(credit.nextPaymentDate)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Vencimiento:</span>{' '}
          <span>{formatDate(credit.endDate)}</span>
        </div>
      </div>

      {credit.description && (
        <p className="text-sm text-muted-foreground">{credit.description}</p>
      )}
    </div>
  );
}

interface CreditDialogContentProps {
  projectId: string;
  userId: string;
  categories: { id: string; name: string; color: string }[];
  entities: Entity[];
  accounts: { id: string; name: string; type: string }[];
  credit: CreditWithProgress | null;
  onSuccess: () => void;
  onMutationStart?: (toastId: string | number) => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

function CreditDialogContent({
  projectId,
  userId,
  categories,
  entities,
  accounts,
  credit,
  onSuccess,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: CreditDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localCategories, setLocalCategories] = useState<{ id: string; name: string; color: string }[]>(
    categories.map((c) => ({ id: c.id, name: c.name, color: c.color }))
  );

  const isEditing = !!credit;

  // Cuenta por defecto: la marcada como default o la primera disponible
  const defaultAccountId = accounts.find(a => a.type !== 'credit_card')?.id ?? accounts[0]?.id ?? '';

  const form = useForm<CreateCreditInput>({
    resolver: zodResolver(createCreditSchema),
    defaultValues: {
      projectId,
      categoryId: credit?.categoryId ?? '',
      entityId: credit?.entityId ?? undefined,
      accountId: credit?.accountId ?? defaultAccountId,
      name: credit?.name ?? '',
      principalAmount: credit ? parseFloat(credit.basePrincipalAmount) : undefined,
      installmentAmount: credit ? parseFloat(credit.installmentAmount) : undefined,
      installments: credit?.installments ?? 12,
      paidInstallments: 0,
      startDate: credit?.startDate ?? new Date(),
      frequency: credit?.frequency ?? 'monthly',
      description: credit?.description ?? '',
      notes: credit?.notes ?? '',
    },
  });

  // Observar campos para calcular cuotas pagadas automáticamente
  const watchedStartDate = useWatch({ control: form.control, name: 'startDate' });
  const watchedFrequency = useWatch({ control: form.control, name: 'frequency' });
  const watchedInstallments = useWatch({ control: form.control, name: 'installments' });

  // Observar campos para calcular total e intereses
  const watchedPrincipal = useWatch({ control: form.control, name: 'principalAmount' });
  const watchedInstallmentAmount = useWatch({ control: form.control, name: 'installmentAmount' });

  // Calcular total e intereses
  const calculatedTotal = (watchedInstallmentAmount ?? 0) * (watchedInstallments ?? 0);
  const calculatedInterest = calculatedTotal - (watchedPrincipal ?? 0);

  // Calcular cuotas pagadas automáticamente
  const calculatedPaidInstallments = calculatePaidInstallments(
    watchedStartDate,
    watchedFrequency,
    watchedInstallments
  );

  // Actualizar el valor del formulario cuando cambia el cálculo
  useEffect(() => {
    if (!isEditing) {
      form.setValue('paidInstallments', calculatedPaidInstallments);
    }
  }, [calculatedPaidInstallments, form, isEditing]);

  const onSubmit = (data: CreateCreditInput) => {
    setError(null);
    const toastId = toast.loading(isEditing ? 'Actualizando crédito...' : 'Creando crédito...');
    onMutationStart?.(toastId);

    startTransition(async () => {
      const result = isEditing
        ? await updateCredit(credit.id, userId, {
            name: data.name,
            description: data.description,
            notes: data.notes,
          })
        : await createCredit(userId, data);

      if (result.success) {
        form.reset();
        onSuccess();
        onMutationSuccess?.(toastId, isEditing ? 'Crédito actualizado' : 'Crédito creado');
      } else {
        setError(result.error);
        onMutationError?.(toastId, result.error);
      }
    });
  };

  return (
    <DialogContent className="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar crédito' : 'Nuevo crédito'}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Modifica los detalles del crédito.'
            : 'Registra un nuevo crédito o préstamo.'}
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
                  <Input placeholder="Ej: Crédito de consumo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Category & Entity - 2 columns on desktop */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <FormControl>
                    <CategorySelector
                      categories={localCategories}
                      value={field.value}
                      onValueChange={field.onChange}
                      onCategoryCreated={(cat) =>
                        setLocalCategories((prev) => [...prev, { id: cat.id, name: cat.name, color: cat.color }])
                      }
                      projectId={projectId}
                      userId={userId}
                      disabled={isEditing}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="entityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entidad (opcional)</FormLabel>
                  <FormControl>
                    <EntitySelector
                      entities={entities}
                      value={field.value ?? undefined}
                      onValueChange={(val) => field.onChange(val ?? null)}
                      disabled={isEditing}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Account selector */}
          <FormField
            control={form.control}
            name="accountId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cuenta de cargo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una cuenta" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {!isEditing && (
            <>
              {/* Principal & Installments - 2 columns */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="principalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto solicitado (capital)</FormLabel>
                      <FormControl>
                        <CurrencyInput
                          value={field.value ?? undefined}
                          onChange={field.onChange}
                          placeholder="0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="installments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>N° de cuotas</FormLabel>
                      <FormControl>
                        <InstallmentSelector
                          value={field.value}
                          onChange={field.onChange}
                          min={1}
                          max={60}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Installment Amount */}
              <FormField
                control={form.control}
                name="installmentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor de la cuota</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value ?? undefined}
                        onChange={field.onChange}
                        placeholder="0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Calculated totals */}
              {watchedPrincipal && watchedInstallmentAmount && watchedInstallments && (
                <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monto total a pagar:</span>
                      <span className="font-medium">{formatCurrency(calculatedTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total intereses:</span>
                      <span className={`font-medium ${calculatedInterest > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {formatCurrency(calculatedInterest)}
                      </span>
                    </div>
                  </div>
                  {calculatedInterest > 0 && watchedPrincipal > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Pagarás {((calculatedInterest / watchedPrincipal) * 100).toFixed(1)}% adicional en intereses
                    </p>
                  )}
                </div>
              )}

              {/* Start Date & Frequency - 2 columns */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha primera cuota</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ? field.value.toISOString().split('T')[0] : ''}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value + 'T12:00:00') : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frecuencia</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">Mensual</SelectItem>
                          <SelectItem value="biweekly">Quincenal</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Paid Installments - Calculated */}
              {watchedStartDate && watchedFrequency && watchedInstallments && (
                <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Cuotas ya pagadas (calculado)</span>
                    <span className="text-lg font-bold">{calculatedPaidInstallments}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Basado en la fecha de inicio y frecuencia, se registrarán {calculatedPaidInstallments} cuotas como pagadas.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción (opcional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Detalles adicionales del crédito..."
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear crédito'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
