'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  upsertBudget,
  updateBudget,
  deleteBudget,
  copyBudgetsFromPreviousMonth,
} from './actions';
import { upsertBudgetSchema, type UpsertBudgetInput } from './schemas';
import type { BudgetWithProgress, BudgetSummary, BudgetPeriod } from './types';

function formatCurrency(amount: number | string, currency: string = 'CLP'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface BudgetListProps {
  budgets: BudgetWithProgress[];
  categoriesWithoutBudget: { id: string; name: string; color: string }[];
  summary: BudgetSummary;
  projectId: string;
  userId: string;
  period: BudgetPeriod;
}

export function BudgetList({
  budgets,
  categoriesWithoutBudget,
  summary,
  projectId,
  userId,
  period,
}: BudgetListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithProgress | null>(null);
  const [isCopying, startCopyTransition] = useTransition();
  const [showCopyDialog, setShowCopyDialog] = useState(false);

  const handleEdit = (budget: BudgetWithProgress) => {
    setEditingBudget(budget);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingBudget(null);
  };

  const handleOpenDialog = () => {
    setEditingBudget(null);
    setIsDialogOpen(true);
  };

  const handleCopyFromPrevious = () => {
    const toastId = toast.loading('Copiando presupuestos...');
    startCopyTransition(async () => {
      const result = await copyBudgetsFromPreviousMonth(
        projectId,
        userId,
        period.year,
        period.month
      );
      setShowCopyDialog(false);
      if (result.success) {
        toast.success('Presupuestos copiados', { id: toastId });
      } else {
        toast.error(result.error, { id: toastId });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Presupuestado"
          value={formatCurrency(summary.totalBudgeted)}
          icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
          className="text-blue-600"
        />
        <SummaryCard
          title="Gastado"
          value={formatCurrency(summary.totalSpent)}
          icon={<TrendingDown className="h-4 w-4 text-red-600" />}
          className="text-red-600"
        />
        <SummaryCard
          title="Disponible"
          value={formatCurrency(summary.totalRemaining)}
          className={summary.totalRemaining >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <SummaryCard
          title="Estado"
          value={`${summary.categoriesOnTrack} OK`}
          subtitle={summary.categoriesOverBudget > 0 ? `${summary.categoriesOverBudget} excedidos` : undefined}
          icon={
            summary.categoriesOverBudget > 0 ? (
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )
          }
        />
      </div>

      {/* Period Info and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="text-lg font-medium">
          {MONTH_NAMES[period.month - 1]} {period.year}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowCopyDialog(true)}
            disabled={isCopying}
          >
            <Copy className={`h-4 w-4 ${isCopying ? 'animate-spin' : ''}`} />
            Copiar del mes anterior
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" onClick={handleOpenDialog}>
                <Plus className="h-4 w-4" />
                Nuevo presupuesto
              </Button>
            </DialogTrigger>
            <BudgetDialogContent
              projectId={projectId}
              userId={userId}
              period={period}
              categoriesWithoutBudget={categoriesWithoutBudget}
              budget={editingBudget}
              onSuccess={handleDialogClose}
            />
          </Dialog>

          {/* Copy Confirmation Dialog */}
          <AlertDialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Copiar presupuestos</AlertDialogTitle>
                <AlertDialogDescription>
                  ¿Copiar los presupuestos del mes anterior? Solo se copiarán las categorías
                  que no tengan presupuesto asignado en este mes.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isCopying}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleCopyFromPrevious} disabled={isCopying}>
                  {isCopying ? 'Copiando...' : 'Copiar presupuestos'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Budget List */}
      {budgets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          No hay presupuestos configurados para este mes
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              userId={userId}
              onEdit={() => handleEdit(budget)}
            />
          ))}
        </div>
      )}
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

interface BudgetCardProps {
  budget: BudgetWithProgress;
  userId: string;
  onEdit: () => void;
}

function BudgetCard({ budget, userId, onEdit }: BudgetCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = () => {
    const toastId = toast.loading('Eliminando presupuesto...');
    startTransition(async () => {
      const result = await deleteBudget(budget.id, userId);
      setShowDeleteDialog(false);
      if (result.success) {
        toast.success('Presupuesto eliminado', { id: toastId });
      } else {
        toast.error(result.error, { id: toastId });
      }
    });
  };

  const progressColor = budget.isOverBudget
    ? 'bg-red-500'
    : budget.percentage >= 80
    ? 'bg-orange-500'
    : 'bg-green-500';

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: budget.categoryColor }}
          />
          <div>
            <p className="font-medium">{budget.categoryName}</p>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(budget.spent)} de {formatCurrency(budget.amount)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${
              budget.isOverBudget ? 'text-red-600' : 'text-muted-foreground'
            }`}
          >
            {budget.percentage}%
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
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar presupuesto</AlertDialogTitle>
                <AlertDialogDescription>
                  ¿Estás seguro de eliminar este presupuesto? Esta acción no se puede deshacer.
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
      </div>

      <div className="space-y-1">
        <Progress
          value={Math.min(budget.percentage, 100)}
          className="h-2"
          indicatorClassName={progressColor}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {budget.isOverBudget
              ? `Excedido por ${formatCurrency(Math.abs(budget.remaining))}`
              : `Quedan ${formatCurrency(budget.remaining)}`}
          </span>
        </div>
      </div>
    </div>
  );
}

interface BudgetDialogContentProps {
  projectId: string;
  userId: string;
  period: BudgetPeriod;
  categoriesWithoutBudget: { id: string; name: string; color: string }[];
  budget: BudgetWithProgress | null;
  onSuccess: () => void;
}

function BudgetDialogContent({
  projectId,
  userId,
  period,
  categoriesWithoutBudget,
  budget,
  onSuccess,
}: BudgetDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<UpsertBudgetInput>({
    resolver: zodResolver(upsertBudgetSchema),
    defaultValues: {
      projectId,
      year: period.year,
      month: period.month,
      categoryId: budget?.categoryId ?? '',
      amount: budget?.amount ? parseFloat(budget.amount) : undefined,
    },
  });

  const onSubmit = (data: UpsertBudgetInput) => {
    setError(null);
    const toastId = toast.loading(budget ? 'Actualizando presupuesto...' : 'Creando presupuesto...');

    startTransition(async () => {
      const result = budget
        ? await updateBudget(budget.id, userId, { amount: data.amount })
        : await upsertBudget(userId, data);

      if (result.success) {
        toast.success(budget ? 'Presupuesto actualizado' : 'Presupuesto creado', { id: toastId });
        form.reset();
        onSuccess();
      } else {
        toast.error(result.error, { id: toastId });
        setError(result.error);
      }
    });
  };

  const isEditing = !!budget;

  // Combinar categoría actual si estamos editando
  const availableCategories = isEditing
    ? [{ id: budget.categoryId, name: budget.categoryName, color: budget.categoryColor }]
    : categoriesWithoutBudget;

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar presupuesto' : 'Nuevo presupuesto'}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Modifica el monto del presupuesto.'
            : `Configura un presupuesto para ${MONTH_NAMES[period.month - 1]} ${period.year}.`}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Category */}
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoría</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={isEditing}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Amount */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monto presupuestado</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="0"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear presupuesto'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
