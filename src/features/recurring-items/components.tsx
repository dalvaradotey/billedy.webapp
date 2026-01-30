'use client';

import { useState, useTransition, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Play,
  Pause,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  createRecurringItem,
  updateRecurringItem,
  toggleRecurringItemActive,
  deleteRecurringItem,
  generateTransactionsFromRecurring,
} from './actions';
import { createRecurringItemSchema, type CreateRecurringItemInput } from './schemas';
import type { RecurringItemWithCategory, RecurringItemSummary } from './types';
import type { Category } from '@/features/categories/types';

function formatCurrency(amount: number | string, currency: string = 'CLP'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

interface RecurringItemListProps {
  items: RecurringItemWithCategory[];
  categories: Category[];
  summary: RecurringItemSummary;
  projectId: string;
  userId: string;
}

export function RecurringItemList({
  items,
  categories,
  summary,
  projectId,
  userId,
}: RecurringItemListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringItemWithCategory | null>(null);
  const [isGenerating, startGenerateTransition] = useTransition();
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingToast, setPendingToast] = useState<{ id: string | number; message: string } | null>(null);

  // Ref para trackear los datos anteriores
  const prevItemsRef = useRef<RecurringItemWithCategory[]>(items);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detectar cuando items cambia y ocultar loading
  useEffect(() => {
    const dataChanged = items !== prevItemsRef.current ||
                        items.length !== prevItemsRef.current.length ||
                        JSON.stringify(items.map(i => i.id)) !== JSON.stringify(prevItemsRef.current.map(i => i.id));

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

    prevItemsRef.current = items;
  }, [items, isRefreshing, pendingToast]);

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

  const handleEdit = (item: RecurringItemWithCategory) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
  };

  const handleOpenDialog = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const handleGenerateTransactions = () => {
    const toastId = toast.loading('Generando transacciones...');
    onMutationStart();
    startGenerateTransition(async () => {
      const result = await generateTransactionsFromRecurring(projectId, userId);
      setShowGenerateDialog(false);
      if (result.success) {
        onMutationSuccess(toastId, 'Transacciones generadas');
      } else {
        onMutationError(toastId, result.error);
      }
    });
  };

  const activeItems = items.filter((i) => i.isActive);
  const inactiveItems = items.filter((i) => !i.isActive);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Ingresos fijos"
          value={formatCurrency(summary.totalIncome)}
          icon={<ArrowUpCircle className="h-4 w-4 text-green-600" />}
          className="text-green-600"
        />
        <SummaryCard
          title="Gastos fijos"
          value={formatCurrency(summary.totalExpense)}
          icon={<ArrowDownCircle className="h-4 w-4 text-red-600" />}
          className="text-red-600"
        />
        <SummaryCard
          title="Balance fijo"
          value={formatCurrency(summary.totalIncome - summary.totalExpense)}
          className={summary.totalIncome - summary.totalExpense >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <SummaryCard
          title="Items activos"
          value={`${summary.activeCount}`}
          subtitle={summary.inactiveCount > 0 ? `${summary.inactiveCount} inactivos` : undefined}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setShowGenerateDialog(true)}
          disabled={isGenerating || summary.activeCount === 0}
        >
          <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
          Generar transacciones
        </Button>

        {/* Generate Transactions Confirmation Dialog */}
        <AlertDialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Generar transacciones</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Generar transacciones para todos los gastos fijos activos? Esto creará
                las transacciones correspondientes al mes actual.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isGenerating}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleGenerateTransactions} disabled={isGenerating}>
                {isGenerating ? 'Generando...' : 'Generar transacciones'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={handleOpenDialog}>
              <Plus className="h-4 w-4" />
              Nuevo gasto fijo
            </Button>
          </DialogTrigger>
          <RecurringItemDialogContent
            projectId={projectId}
            userId={userId}
            categories={categories}
            item={editingItem}
            onSuccess={handleDialogClose}
            onMutationStart={onMutationStart}
            onMutationSuccess={onMutationSuccess}
            onMutationError={onMutationError}
          />
        </Dialog>
      </div>

      {/* Items Table */}
      {isRefreshing ? (
        <div className="space-y-6">
          <div>
            <Skeleton className="h-4 w-16 mb-3" />
            <RecurringItemTableSkeleton rowCount={Math.max(3, items.length)} />
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          No hay gastos fijos configurados
        </div>
      ) : (
        <div className="space-y-6">
          {activeItems.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Activos</h3>
              <RecurringItemTable
                items={activeItems}
                userId={userId}
                onEdit={handleEdit}
                onMutationStart={onMutationStart}
                onMutationSuccess={onMutationSuccess}
                onMutationError={onMutationError}
              />
            </div>
          )}

          {inactiveItems.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Inactivos</h3>
              <RecurringItemTable
                items={inactiveItems}
                userId={userId}
                onEdit={handleEdit}
                onMutationStart={onMutationStart}
                onMutationSuccess={onMutationSuccess}
                onMutationError={onMutationError}
              />
            </div>
          )}
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

function RecurringItemTableSkeleton({ rowCount = 3 }: { rowCount?: number }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Día</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rowCount }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </TableCell>
              <TableCell><Skeleton className="h-4 w-12" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface RecurringItemTableProps {
  items: RecurringItemWithCategory[];
  userId: string;
  onEdit: (item: RecurringItemWithCategory) => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

function RecurringItemTable({ items, userId, onEdit, onMutationStart, onMutationSuccess, onMutationError }: RecurringItemTableProps) {
  const [isPending, startTransition] = useTransition();
  const [itemToDelete, setItemToDelete] = useState<RecurringItemWithCategory | null>(null);

  const handleToggleActive = (item: RecurringItemWithCategory) => {
    const toastId = toast.loading(item.isActive ? 'Desactivando...' : 'Activando...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await toggleRecurringItemActive(item.id, userId, { isActive: !item.isActive });
      if (result.success) {
        onMutationSuccess?.(toastId, item.isActive ? 'Item desactivado' : 'Item activado');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleDelete = () => {
    if (!itemToDelete) return;
    const toastId = toast.loading('Eliminando...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await deleteRecurringItem(itemToDelete.id, userId);
      setItemToDelete(null);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Item eliminado');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Día</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className={!item.isActive ? 'opacity-60' : ''}>
              <TableCell>
                <div className="font-medium">{item.name}</div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: item.categoryColor }}
                  />
                  <span className="text-sm">{item.categoryName}</span>
                </div>
              </TableCell>
              <TableCell>
                {item.dayOfMonth ? (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Día {item.dayOfMonth}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={`font-medium ${
                    item.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {item.type === 'income' ? '+' : '-'}
                  {formatCurrency(item.amount)}
                </span>
              </TableCell>
              <TableCell>
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
                    <DropdownMenuItem onClick={() => onEdit(item)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleActive(item)}>
                      {item.isActive ? (
                        <>
                          <Pause className="mr-2 h-4 w-4" />
                          Desactivar
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Activar
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setItemToDelete(item)} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar gasto fijo</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar "{itemToDelete?.name}"? Esta acción no se puede deshacer.
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
  );
}

interface RecurringItemDialogContentProps {
  projectId: string;
  userId: string;
  categories: Category[];
  item: RecurringItemWithCategory | null;
  onSuccess: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

function RecurringItemDialogContent({
  projectId,
  userId,
  categories,
  item,
  onSuccess,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: RecurringItemDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateRecurringItemInput>({
    resolver: zodResolver(createRecurringItemSchema),
    defaultValues: {
      projectId,
      name: item?.name ?? '',
      amount: item?.amount ? parseFloat(item.amount) : undefined,
      type: item?.type ?? 'expense',
      categoryId: item?.categoryId ?? '',
      dayOfMonth: item?.dayOfMonth ?? undefined,
      isActive: item?.isActive ?? true,
      accountId: item?.accountId ?? undefined,
    },
  });

  const selectedType = form.watch('type');
  const filteredCategories = categories.filter((c) => c.type === selectedType && !c.isArchived);

  const onSubmit = (data: CreateRecurringItemInput) => {
    setError(null);
    const toastId = toast.loading(item ? 'Actualizando...' : 'Creando gasto fijo...');
    onMutationStart?.();

    startTransition(async () => {
      const result = item
        ? await updateRecurringItem(item.id, userId, data)
        : await createRecurringItem(userId, data);

      if (result.success) {
        form.reset();
        onSuccess();
        onMutationSuccess?.(toastId, item ? 'Gasto fijo actualizado' : 'Gasto fijo creado');
      } else {
        setError(result.error);
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const isEditing = !!item;

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Modifica los datos del gasto fijo.'
            : 'Configura un ingreso o gasto que se repite cada mes.'}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Type Selector */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={field.value === 'expense' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => {
                      field.onChange('expense');
                      form.setValue('categoryId', '');
                    }}
                  >
                    <ArrowDownCircle className="mr-2 h-4 w-4" />
                    Gasto
                  </Button>
                  <Button
                    type="button"
                    variant={field.value === 'income' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => {
                      field.onChange('income');
                      form.setValue('categoryId', '');
                    }}
                  >
                    <ArrowUpCircle className="mr-2 h-4 w-4" />
                    Ingreso
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Netflix, Arriendo, Sueldo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Amount and Day */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
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

            <FormField
              control={form.control}
              name="dayOfMonth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Día del mes (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="1-31"
                      min={1}
                      max={31}
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Category */}
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoría</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {filteredCategories.map((cat) => (
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear gasto fijo'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
