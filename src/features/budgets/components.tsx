'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Target,
  Check,
  ArrowRight,
} from 'lucide-react';
import { useFormValidation, useSuccessAnimation } from '@/hooks';
import { SubmitButton } from '@/components/submit-button';
import { FloatingLabelInput } from '@/components/floating-label-input';
import { FormDrawer, FormDrawerBody, FormDrawerFooter } from '@/components/form-drawer';
import { ProgressIndicator } from '@/components/progress-indicator';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import {
  ResponsiveDrawer,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { CurrencyInput } from '@/components/currency-input';
import { SearchableSelect } from '@/components/searchable-select';
import { SwitchCard } from '@/components/switch-card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
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
import { Badge } from '@/components/ui/badge';
import { CategorySelector } from '@/components/category-selector';
import {
  createBudget,
  updateBudget,
  deleteBudget,
  toggleBudgetActive,
} from './actions';
import { createBudgetSchema } from './schemas';
import type { CreateBudgetInput, UpdateBudgetInput } from './schemas';
import type { BudgetWithCategory } from './types';

function formatCurrency(amount: number | string, currency: string = 'CLP'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

interface BudgetListProps {
  budgets: BudgetWithCategory[];
  categories: { id: string; name: string; color: string }[];
  currencies: { code: string; name: string }[];
  projectId: string;
  userId: string;
  defaultCurrency: string;
}

export function BudgetList({
  budgets,
  categories,
  currencies,
  projectId,
  userId,
  defaultCurrency,
}: BudgetListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithCategory | null>(null);

  const handleEdit = (budget: BudgetWithCategory) => {
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

  const activeBudgets = budgets.filter((b) => b.isActive);
  const inactiveBudgets = budgets.filter((b) => !b.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Presupuestos</h2>
          <p className="text-sm text-muted-foreground">
            Define plantillas de presupuesto para asignar a cada ciclo de facturación
          </p>
        </div>

        <ResponsiveDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DrawerTrigger asChild>
            <Button size="sm" className="gap-2" onClick={handleOpenDialog}>
              <Plus className="h-4 w-4" />
              Nuevo presupuesto
            </Button>
          </DrawerTrigger>
          <BudgetDialogContent
            projectId={projectId}
            userId={userId}
            categories={categories}
            currencies={currencies}
            budget={editingBudget}
            onSuccess={handleDialogClose}
            defaultCurrency={defaultCurrency}
          />
        </ResponsiveDrawer>
      </div>

      {/* Active Budgets */}
      {activeBudgets.length === 0 && inactiveBudgets.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No hay presupuestos configurados"
          description="Crea un presupuesto para controlar tus gastos por categoría."
        />
      ) : (
        <>
          {activeBudgets.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Activos</h3>
              {activeBudgets.map((budget) => (
                <BudgetCard
                  key={budget.id}
                  budget={budget}
                  userId={userId}
                  onEdit={() => handleEdit(budget)}
                />
              ))}
            </div>
          )}

          {inactiveBudgets.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Inactivos</h3>
              {inactiveBudgets.map((budget) => (
                <BudgetCard
                  key={budget.id}
                  budget={budget}
                  userId={userId}
                  onEdit={() => handleEdit(budget)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface BudgetCardProps {
  budget: BudgetWithCategory;
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

  const handleToggleActive = () => {
    const toastId = toast.loading(budget.isActive ? 'Desactivando...' : 'Activando...');
    startTransition(async () => {
      const result = await toggleBudgetActive(budget.id, userId, !budget.isActive);
      if (result.success) {
        toast.success(budget.isActive ? 'Presupuesto desactivado' : 'Presupuesto activado', { id: toastId });
      } else {
        toast.error(result.error, { id: toastId });
      }
    });
  };

  return (
    <div className={`rounded-lg border p-4 ${!budget.isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {budget.categoryColor && (
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: budget.categoryColor }}
            />
          )}
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{budget.name}</p>
              {!budget.isActive && (
                <Badge variant="secondary" className="text-xs">Inactivo</Badge>
              )}
            </div>
            {budget.categoryName && (
              <p className="text-sm text-muted-foreground">{budget.categoryName}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold">
            {formatCurrency(budget.defaultAmount, budget.currency)}
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
              <DropdownMenuItem onClick={handleToggleActive}>
                {budget.isActive ? (
                  <>
                    <ToggleLeft className="mr-2 h-4 w-4" />
                    Desactivar
                  </>
                ) : (
                  <>
                    <ToggleRight className="mr-2 h-4 w-4" />
                    Activar
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
    </div>
  );
}

interface BudgetDialogContentProps {
  projectId: string;
  userId: string;
  categories: { id: string; name: string; color: string }[];
  currencies: { code: string; name: string }[];
  budget: BudgetWithCategory | null;
  onSuccess: () => void;
  defaultCurrency: string;
}

function BudgetDialogContent({
  projectId,
  userId,
  categories,
  currencies,
  budget,
  onSuccess,
  defaultCurrency,
}: BudgetDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCurrencySelector, setShowCurrencySelector] = useState(false);
  const [localCategories, setLocalCategories] = useState(categories);

  // Form UX hooks
  const { onInvalid } = useFormValidation();
  const { showSuccess, triggerSuccess } = useSuccessAnimation({ onComplete: onSuccess });

  const isEditing = !!budget;

  // Update local categories when props change
  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const handleCategoryCreated = (newCategory: { id: string; name: string; color: string }) => {
    setLocalCategories((prev) => [...prev, newCategory]);
  };

  const getDefaultValues = useCallback(() => ({
    projectId,
    name: budget?.name ?? '',
    categoryId: budget?.categoryId ?? undefined,
    defaultAmount: budget?.defaultAmount ? parseFloat(budget.defaultAmount) : undefined,
    currency: budget?.currency ?? defaultCurrency,
  }), [projectId, budget, defaultCurrency]);

  const form = useForm<CreateBudgetInput>({
    resolver: zodResolver(createBudgetSchema),
    defaultValues: getDefaultValues(),
  });

  // Reset form when budget changes (for edit mode)
  useEffect(() => {
    form.reset(getDefaultValues());
    // Show currency selector if budget has a different currency than project default
    if (budget) {
      setShowCurrencySelector(budget.currency !== defaultCurrency);
    } else {
      setShowCurrencySelector(false);
    }
  }, [budget, form, getDefaultValues]);

  // Track form progress with subscription pattern
  const calculateProgress = useCallback((values: Partial<CreateBudgetInput>) => {
    return [
      !!values.name,
      values.defaultAmount !== undefined && values.defaultAmount > 0,
    ].filter(Boolean).length;
  }, []);

  const [formProgress, setFormProgress] = useState(() => calculateProgress(form.getValues()));

  useEffect(() => {
    // Calculate initial progress
    setFormProgress(calculateProgress(form.getValues()));

    // Subscribe to changes
    const subscription = form.watch((values) => {
      setFormProgress(calculateProgress(values));
    });
    return () => subscription.unsubscribe();
  }, [form, calculateProgress]);

  const onSubmit = (data: CreateBudgetInput) => {
    setError(null);
    const toastId = toast.loading(isEditing ? 'Actualizando presupuesto...' : 'Creando presupuesto...');

    startTransition(async () => {
      const result = isEditing
        ? await updateBudget(budget.id, userId, {
            name: data.name,
            categoryId: data.categoryId,
            defaultAmount: data.defaultAmount,
            currency: data.currency,
          })
        : await createBudget(userId, data);

      if (result.success) {
        toast.success(isEditing ? 'Presupuesto actualizado' : 'Presupuesto creado', { id: toastId });
        form.reset();
        triggerSuccess();
      } else {
        toast.error(result.error, { id: toastId });
        setError(result.error);
      }
    });
  };

  return (
    <FormDrawer
      title={isEditing ? 'Editar presupuesto' : 'Nuevo presupuesto'}
      description={
        isEditing
          ? 'Modifica los datos del presupuesto.'
          : 'Crea una plantilla de presupuesto que podrás asignar a cada ciclo.'
      }
      showSuccess={showSuccess}
      headerExtra={!isEditing ? <ProgressIndicator current={formProgress} total={2} /> : undefined}
    >
      <Form {...form}>
        <FormDrawerBody as="form" onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <FormItem data-field="name">
                <FormControl>
                  <FloatingLabelInput
                    label="Nombre"
                    placeholder="Ej: Comida, Transporte, etc."
                    value={field.value}
                    onChange={field.onChange}
                    valid={!!field.value && !fieldState.error}
                    invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Category (optional) */}
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field, fieldState }) => (
              <FormItem data-field="categoryId">
                <FormControl>
                  <CategorySelector
                    categories={localCategories}
                    value={field.value}
                    onValueChange={field.onChange}
                    projectId={projectId}
                    userId={userId}
                    allowNone
                    noneLabel="Sin categoría específica"
                    label="Categoría (opcional)"
                    searchPlaceholder="Buscar categoría..."
                    onCategoryCreated={handleCategoryCreated}
                    valid={!!field.value}
                    invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Default Amount */}
          <FormField
            control={form.control}
            name="defaultAmount"
            render={({ field, fieldState }) => (
              <FormItem data-field="defaultAmount">
                <FormControl>
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    currency={form.watch('currency') ?? defaultCurrency}
                    placeholder="0"
                    size="lg"
                    label="Monto por defecto"
                    valid={field.value !== undefined && field.value > 0 && !fieldState.error}
                    invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Currency Selector */}
          <div className="space-y-3">
            <SwitchCard
              title="Moneda diferente"
              description={`Por defecto se usa ${defaultCurrency}`}
              checked={showCurrencySelector}
              onCheckedChange={(checked) => {
                setShowCurrencySelector(checked);
                if (!checked) {
                  form.setValue('currency', defaultCurrency);
                }
              }}
            />

            {showCurrencySelector && (
              <FormField
                control={form.control}
                name="currency"
                render={({ field, fieldState }) => (
                  <FormItem data-field="currency">
                    <FormControl>
                      <SearchableSelect
                        options={currencies.map((c) => ({
                          id: c.code,
                          label: `${c.code} - ${c.name}`,
                          searchValue: `${c.code} ${c.name}`,
                        }))}
                        value={field.value}
                        onValueChange={(value) => field.onChange(value ?? defaultCurrency)}
                        label="Moneda"
                        searchPlaceholder="Buscar moneda..."
                        emptyMessage="No se encontraron monedas."
                        valid={!!field.value}
                        invalid={!!fieldState.error}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <FormDrawerFooter>
            <SubmitButton
              isPending={isPending}
              pendingText="Guardando..."
              icon={isEditing ? <Check className="size-7" /> : <ArrowRight className="size-7" />}
            >
              {isEditing ? 'Guardar cambios' : 'Crear presupuesto'}
            </SubmitButton>
          </FormDrawerFooter>
        </FormDrawerBody>
      </Form>
    </FormDrawer>
  );
}
