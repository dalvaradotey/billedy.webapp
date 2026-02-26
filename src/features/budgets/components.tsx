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
  MoreVertical,
  X,
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
import { AccountSelector } from '@/components/account-selector';
import { SwitchCard } from '@/components/switch-card';
import type { AccountWithEntity } from '@/features/accounts/types';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { cardStyles } from '@/components/card-styles';
import { useIsMobile } from '@/hooks';
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
  accounts: AccountWithEntity[];
  currencies: { code: string; name: string }[];
  projectId: string;
  userId: string;
  defaultCurrency: string;
}

export function BudgetList({
  budgets,
  categories,
  accounts,
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
      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {budgets.length} presupuestos
        </div>

        <ResponsiveDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DrawerTrigger asChild>
            <Button variant="cta-sm" onClick={handleOpenDialog}>
              Nuevo presupuesto
              <ArrowRight className="h-4 w-4" />
            </Button>
          </DrawerTrigger>
          <BudgetDialogContent
            projectId={projectId}
            userId={userId}
            categories={categories}
            accounts={accounts}
            currencies={currencies}
            budget={editingBudget}
            onSuccess={handleDialogClose}
            defaultCurrency={defaultCurrency}
          />
        </ResponsiveDrawer>
      </div>

      {/* Budgets */}
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
  const [showInlineActions, setShowInlineActions] = useState(false);
  const [showActionsDrawer, setShowActionsDrawer] = useState(false);
  const isMobile = useIsMobile();

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

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const actions = [
    {
      key: 'edit',
      label: 'Editar',
      icon: <Pencil />,
      onClick: onEdit,
    },
    {
      key: 'toggle',
      label: budget.isActive ? 'Desactivar' : 'Activar',
      icon: budget.isActive ? <ToggleLeft /> : <ToggleRight />,
      onClick: handleToggleActive,
    },
    {
      key: 'delete',
      label: 'Eliminar',
      icon: <Trash2 />,
      onClick: handleDeleteClick,
      variant: 'destructive' as const,
    },
  ];

  const description = budget.categoryName || undefined;

  return (
    <>
      <div
        onClick={() => {
          if (isMobile) {
            setShowActionsDrawer(true);
          }
        }}
        className={cn(
          cardStyles.base,
          isMobile && 'cursor-pointer',
          !budget.isActive && cardStyles.inactive
        )}
      >
        {/* Top row: Icon + Info + Actions */}
        <div className="flex items-start gap-3">
          {/* Icon */}
          {budget.categoryColor ? (
            <div
              className="w-12 h-12 sm:w-10 sm:h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
              style={{ backgroundColor: budget.categoryColor + '30' }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: budget.categoryColor }}
              />
            </div>
          ) : (
            <div className="p-3 sm:p-2.5 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              <Target className="h-6 w-6 sm:h-5 sm:w-5 text-muted-foreground" />
            </div>
          )}

          {/* Info */}
          <div className="min-w-0 flex-1">
            {/* Row 1: Title + Amount + actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-base truncate">{budget.name}</p>
                  {!budget.isActive && (
                    <Badge variant="secondary" className="text-xs flex-shrink-0">Inactivo</Badge>
                  )}
                </div>
                {budget.categoryName && (
                  <p className="text-sm text-muted-foreground truncate">{budget.categoryName}</p>
                )}
              </div>

              {/* Desktop: Amount */}
              <p className="hidden sm:block text-2xl font-bold tabular-nums text-foreground shrink-0">
                {formatCurrency(budget.defaultAmount, budget.currency)}
              </p>

              {/* Actions toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isMobile) {
                    setShowActionsDrawer(true);
                  } else {
                    setShowInlineActions(!showInlineActions);
                  }
                }}
                disabled={isPending}
                className={cn(
                  cardStyles.actionsButton,
                  showInlineActions && 'sm:rotate-90'
                )}
              >
                {showInlineActions && !isMobile ? (
                  <X className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="sr-only">Acciones</span>
              </button>
            </div>

            {/* Mobile: Amount below description */}
            <p className="text-2xl font-bold tabular-nums text-foreground mt-1 sm:hidden">
              {formatCurrency(budget.defaultAmount, budget.currency)}
            </p>

            {/* Mobile actions drawer */}
            <Drawer open={showActionsDrawer} onOpenChange={setShowActionsDrawer}>
              <DrawerContent>
                <DrawerHeader className="text-left pb-2">
                  <DrawerTitle>{budget.name}</DrawerTitle>
                  {description && <DrawerDescription>{description}</DrawerDescription>}
                </DrawerHeader>
                <div className="px-2 pb-2">
                  {actions.map((action) => (
                    <DrawerClose key={action.key} asChild>
                      <button
                        onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                        disabled={isPending}
                        className={cn(
                          cardStyles.drawerAction,
                          action.variant === 'destructive' ? 'active:bg-red-500/10' : 'active:bg-muted'
                        )}
                      >
                        <div className={cn(
                          cardStyles.drawerActionIconBox,
                          action.variant === 'destructive' ? 'bg-red-500/10' : 'bg-muted'
                        )}>
                          <span className={cn(
                            '[&>svg]:h-5 [&>svg]:w-5',
                            action.variant === 'destructive' ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'
                          )}>
                            {action.icon}
                          </span>
                        </div>
                        <span className={cn(
                          'text-base font-medium',
                          action.variant === 'destructive' && 'text-red-500 dark:text-red-400'
                        )}>
                          {action.label}
                        </span>
                      </button>
                    </DrawerClose>
                  ))}
                </div>
                <div className="px-4 pb-4 pt-2 border-t">
                  <DrawerClose asChild>
                    <button className={cardStyles.drawerCancelButton}>
                      Cancelar
                    </button>
                  </DrawerClose>
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </div>

        {/* Desktop: Inline actions */}
        {showInlineActions && (
          <div className="mt-3 hidden sm:block animate-in fade-in slide-in-from-top-2 duration-200">
            <div className={cardStyles.inlineActionsGrid}>
              {actions.map((action) => (
                <button
                  key={action.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                  }}
                  disabled={isPending}
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-colors disabled:opacity-50',
                    action.variant === 'destructive'
                      ? cardStyles.inlineActionDestructive
                      : cardStyles.inlineActionDefault
                  )}
                >
                  <span className={cn(
                    '[&>svg]:h-5 [&>svg]:w-5',
                    action.variant === 'destructive'
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-muted-foreground'
                  )}>
                    {action.icon}
                  </span>
                  <span className="text-sm font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        icon={<Trash2 className="h-7 w-7" />}
        iconVariant="destructive"
        title="Eliminar presupuesto"
        description={
          <>
            ¿Eliminar <span className="font-medium text-foreground">{budget.name}</span> permanentemente?
            Esta acción no se puede deshacer.
          </>
        }
        confirmText={isPending ? 'Eliminando...' : 'Eliminar'}
        variant="destructive"
        size="sm"
        requireConfirmText="ELIMINAR"
        isPending={isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

interface BudgetDialogContentProps {
  projectId: string;
  userId: string;
  categories: { id: string; name: string; color: string }[];
  accounts: AccountWithEntity[];
  currencies: { code: string; name: string }[];
  budget: BudgetWithCategory | null;
  onSuccess: () => void;
  defaultCurrency: string;
}

function BudgetDialogContent({
  projectId,
  userId,
  categories,
  accounts,
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
    defaultAccountId: budget?.defaultAccountId ?? undefined,
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
            defaultAccountId: data.defaultAccountId,
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

          {/* Default Account (optional) */}
          <FormField
            control={form.control}
            name="defaultAccountId"
            render={({ field, fieldState }) => (
              <FormItem data-field="defaultAccountId">
                <FormControl>
                  <AccountSelector
                    accounts={accounts}
                    value={field.value}
                    onValueChange={field.onChange}
                    allowNone
                    noneLabel="Sin cuenta por defecto"
                    label="Cuenta de cargo (opcional)"
                    searchPlaceholder="Buscar cuenta..."
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
