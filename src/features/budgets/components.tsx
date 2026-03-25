'use client';

import { useState, useTransition, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  TouchSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  GripVertical,
  ArrowUpDown,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { useFormValidation, useSuccessAnimation } from '@/hooks';
import { SubmitButton } from '@/components/submit-button';
import { FloatingLabelInput } from '@/components/floating-label-input';
import { FloatingLabelDateInput } from '@/components/floating-label-date-input';
import { FormDrawer, FormDrawerBody, FormDrawerFooter } from '@/components/form-drawer';
import { ProgressIndicator } from '@/components/progress-indicator';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { PageToolbar } from '@/components/page-toolbar';
import { ResponsiveDrawer } from '@/components/ui/drawer';
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
  reorderBudgets,
} from './actions';
import { createBudgetSchema } from './schemas';
import type { CreateBudgetInput, UpdateBudgetInput } from './schemas';
import type { BudgetWithCategory } from './types';
import { useRegisterPageActions, type PageAction } from '@/components/layout/bottom-nav-context';
import { getToday, toCalendarDate, daysBetween } from '@/lib/formatting';
import { BudgetDetail, type CycleOption } from './components/budget-detail';

function formatCurrency(amount: number | string, currency: string = 'CLP'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function startOfDay(d: Date): Date {
  return toCalendarDate(d);
}

function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' };
  const fmt = new Intl.DateTimeFormat('es-CL', opts);
  const fmtYear = new Intl.DateTimeFormat('es-CL', { ...opts, year: 'numeric', timeZone: 'UTC' });
  const currentYear = new Date().getUTCFullYear();
  if (start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCFullYear() === currentYear) {
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  }
  return `${fmtYear.format(start)} – ${fmtYear.format(end)}`;
}

function daysRemaining(endDate: Date): number {
  return daysBetween(getToday(), endDate);
}

interface BudgetListProps {
  budgets: BudgetWithCategory[];
  categories: { id: string; name: string; color: string }[];
  accounts: AccountWithEntity[];
  currencies: { code: string; name: string }[];
  projectId: string;
  userId: string;
  defaultCurrency: string;
  cycles?: CycleOption[];
}

export function BudgetList({
  budgets,
  categories,
  accounts,
  currencies,
  projectId,
  userId,
  defaultCurrency,
  cycles = [],
}: BudgetListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithCategory | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [localBudgets, setLocalBudgets] = useState(budgets);

  // Sincronizar cuando llegan nuevos datos del server
  useEffect(() => {
    setLocalBudgets(budgets);
  }, [budgets]);

  const today = useMemo(() => getToday(), []);

  // Separar en 4 secciones
  const permanentBudgets = useMemo(
    () => localBudgets.filter((b) => b.isActive && !b.startDate),
    [localBudgets]
  );
  const temporalBudgets = useMemo(
    () => localBudgets.filter((b) => b.isActive && b.endDate && startOfDay(new Date(b.endDate)) >= today),
    [localBudgets, today]
  );
  const expiredBudgets = useMemo(
    () => localBudgets.filter((b) => b.isActive && b.endDate && startOfDay(new Date(b.endDate)) < today),
    [localBudgets, today]
  );
  const inactiveBudgets = useMemo(() => localBudgets.filter((b) => !b.isActive), [localBudgets]);
  const [showExpired, setShowExpired] = useState(false);

  // Sensores DnD
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = permanentBudgets.findIndex((b) => b.id === active.id);
    const newIndex = permanentBudgets.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(permanentBudgets, oldIndex, newIndex);
    setLocalBudgets([...reordered, ...temporalBudgets, ...expiredBudgets, ...inactiveBudgets]);

    const orderedIds = reordered.map((b) => b.id);
    startTransition(async () => {
      const result = await reorderBudgets(projectId, userId, orderedIds);
      if (!result.success) {
        toast.error(result.error);
        setLocalBudgets(budgets);
      }
    });
  };

  const handleEdit = (budget: BudgetWithCategory) => {
    setEditingBudget(budget);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingBudget(null);
  };

  const handleOpenDialog = useCallback(() => {
    setEditingBudget(null);
    setIsDialogOpen(true);
  }, []);

  // Registrar acción en bottom nav / desktop FAB
  const pageActions = useMemo<PageAction[]>(() => [
    { label: 'Nuevo presupuesto', icon: Plus, onClick: handleOpenDialog },
  ], [handleOpenDialog]);

  useRegisterPageActions(pageActions);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <PageToolbar label={`${budgets.length} presupuestos`}>
        {permanentBudgets.length > 1 && (
          <Button
            variant={isReorderMode ? 'default' : 'ghost'}
            size="sm"
            className="h-8"
            onClick={() => setIsReorderMode(!isReorderMode)}
            disabled={isPending}
          >
            <ArrowUpDown className="h-4 w-4" />
            <span className="ml-1.5">
              {isReorderMode ? 'Listo' : 'Ordenar'}
            </span>
          </Button>
        )}
      </PageToolbar>

      {/* Dialog (se abre desde page actions) */}
      <ResponsiveDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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

      {/* Budgets */}
      {budgets.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No hay presupuestos configurados"
          description="Crea un presupuesto para controlar tus gastos por categoría."
        />
      ) : (
        <>
          {/* Permanentes (con DnD) */}
          {permanentBudgets.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                {isReorderMode ? 'Arrastra para reordenar' : 'Activos'}
              </h3>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={permanentBudgets.map((b) => b.id)}
                  strategy={verticalListSortingStrategy}
                  disabled={!isReorderMode}
                >
                  <div className="space-y-3">
                    {permanentBudgets.map((budget) => (
                      <SortableBudgetCard
                        key={budget.id}
                        budget={budget}
                        userId={userId}
                        onEdit={() => handleEdit(budget)}
                        isReorderMode={isReorderMode}
                        cycles={cycles}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* Temporales vigentes */}
          {temporalBudgets.length > 0 && !isReorderMode && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Temporales
              </h3>
              {temporalBudgets.map((budget) => (
                <BudgetCard
                  key={budget.id}
                  budget={budget}
                  userId={userId}
                  onEdit={() => handleEdit(budget)}
                  cycles={cycles}
                />
              ))}
            </div>
          )}

          {/* Expirados */}
          {expiredBudgets.length > 0 && !isReorderMode && (
            <div className="space-y-3">
              <button
                onClick={() => setShowExpired(!showExpired)}
                className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                Expirados ({expiredBudgets.length})
                <span className={cn('transition-transform', showExpired && 'rotate-180')}>▾</span>
              </button>
              {showExpired && (
                <div className="space-y-3 opacity-60">
                  {expiredBudgets.map((budget) => (
                    <BudgetCard
                      key={budget.id}
                      budget={budget}
                      userId={userId}
                      onEdit={() => handleEdit(budget)}
                      cycles={cycles}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Inactivos */}
          {inactiveBudgets.length > 0 && !isReorderMode && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Inactivos</h3>
              {inactiveBudgets.map((budget) => (
                <BudgetCard
                  key={budget.id}
                  budget={budget}
                  userId={userId}
                  onEdit={() => handleEdit(budget)}
                  cycles={cycles}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// SORTABLE BUDGET CARD WRAPPER
// ============================================================================

interface SortableBudgetCardProps {
  budget: BudgetWithCategory;
  userId: string;
  onEdit: () => void;
  isReorderMode: boolean;
  cycles?: CycleOption[];
}

function SortableBudgetCard({ budget, userId, onEdit, isReorderMode, cycles }: SortableBudgetCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: budget.id, disabled: !isReorderMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (!isReorderMode) {
    return (
      <BudgetCard
        budget={budget}
        userId={userId}
        onEdit={onEdit}
        cycles={cycles}
      />
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        className={cn(
          cardStyles.base,
          'flex items-center gap-3 cursor-grab active:cursor-grabbing select-none',
          isDragging && 'opacity-50 shadow-lg ring-2 ring-primary/20 z-10'
        )}
        {...listeners}
      >
        {/* Drag handle */}
        <div className="flex items-center justify-center w-10 h-10 -ml-1 touch-none">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Category color dot */}
        {budget.categoryColor && (
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: budget.categoryColor }}
          />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base truncate">{budget.name}</p>
          {budget.categoryName && (
            <p className="text-sm text-muted-foreground truncate">{budget.categoryName}</p>
          )}
        </div>

        {/* Amount */}
        <p className="text-lg font-bold tabular-nums text-foreground shrink-0">
          {formatCurrency(budget.defaultAmount, budget.currency)}
        </p>
      </div>
    </div>
  );
}

interface BudgetCardProps {
  budget: BudgetWithCategory;
  userId: string;
  onEdit: () => void;
  cycles?: CycleOption[];
}

function BudgetCard({ budget, userId, onEdit, cycles = [] }: BudgetCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showInlineActions, setShowInlineActions] = useState(false);
  const [showActionsDrawer, setShowActionsDrawer] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
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
  const isTemporary = budget.startDate != null;
  const isExpired = isTemporary && budget.endDate != null && startOfDay(new Date(budget.endDate)) < startOfDay(new Date());
  const days = isTemporary && budget.endDate && !isExpired ? daysRemaining(budget.endDate) : null;

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
          {isTemporary ? (
            <div
              className={cn(
                'w-12 h-12 sm:w-10 sm:h-10 rounded-xl flex-shrink-0 flex items-center justify-center',
                isExpired ? 'bg-muted' : 'bg-blue-500/15'
              )}
            >
              <Calendar className={cn(
                'h-5 w-5 sm:h-4 sm:w-4',
                isExpired ? 'text-muted-foreground' : 'text-blue-600 dark:text-blue-400'
              )} />
            </div>
          ) : budget.categoryColor ? (
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
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-base truncate">{budget.name}</p>
                  {!budget.isActive && (
                    <Badge variant="secondary" className="text-xs flex-shrink-0">Inactivo</Badge>
                  )}
                  {isExpired && (
                    <Badge variant="destructive" className="text-xs flex-shrink-0">Expirado</Badge>
                  )}
                  {isTemporary && !isExpired && days !== null && (
                    <Badge variant="outline" className="text-xs flex-shrink-0 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                      {days === 0 ? 'Último día' : days === 1 ? '1 día' : `${days} días`}
                    </Badge>
                  )}
                </div>
                {budget.categoryName && (
                  <p className="text-sm text-muted-foreground truncate">{budget.categoryName}</p>
                )}
                {isTemporary && budget.startDate && budget.endDate && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDateRange(new Date(budget.startDate), new Date(budget.endDate))}
                  </p>
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

        {/* Ver detalle toggle */}
        <div className="flex items-center mt-3">
          <button
            onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
            className={cardStyles.toggleButton}
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', showDetails && 'rotate-180')} />
            <span>{showDetails ? 'Ocultar detalle' : 'Ver detalle'}</span>
          </button>
        </div>

        {/* Detalle expandible */}
        {showDetails && (
          <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <BudgetDetail
              budgetId={budget.id}
              userId={userId}
              budgetedAmount={parseFloat(budget.defaultAmount)}
              currency={budget.currency}
              categoryColor={budget.categoryColor}
              cycles={cycles}
            />
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
  const [showTemporalDates, setShowTemporalDates] = useState(false);
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
    startDate: budget?.startDate ?? undefined,
    endDate: budget?.endDate ?? undefined,
  }), [projectId, budget, defaultCurrency]);

  const form = useForm<CreateBudgetInput>({
    resolver: zodResolver(createBudgetSchema),
    defaultValues: getDefaultValues(),
  });

  // Reset form when budget changes (for edit mode)
  useEffect(() => {
    form.reset(getDefaultValues());
    if (budget) {
      setShowCurrencySelector(budget.currency !== defaultCurrency);
      setShowTemporalDates(budget.startDate != null);
    } else {
      setShowCurrencySelector(false);
      setShowTemporalDates(false);
    }
  }, [budget, form, getDefaultValues, defaultCurrency]);

  // Track form progress with subscription pattern
  const totalSteps = showTemporalDates ? 3 : 2;
  const calculateProgress = useCallback((values: Partial<CreateBudgetInput>) => {
    const steps = [
      !!values.name,
      values.defaultAmount !== undefined && values.defaultAmount > 0,
    ];
    if (showTemporalDates) {
      steps.push(!!values.startDate && !!values.endDate);
    }
    return steps.filter(Boolean).length;
  }, [showTemporalDates]);

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
            startDate: data.startDate,
            endDate: data.endDate,
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
      headerExtra={!isEditing ? <ProgressIndicator current={formProgress} total={totalSteps} /> : undefined}
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

          {/* Temporal Budget (date range) */}
          <div className="space-y-3">
            <SwitchCard
              title="Presupuesto temporal"
              description="Define un período específico de vigencia"
              checked={showTemporalDates}
              onCheckedChange={(checked) => {
                setShowTemporalDates(checked);
                if (checked) {
                  const today = new Date();
                  today.setHours(12, 0, 0, 0);
                  const nextWeek = new Date(today);
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  form.setValue('startDate', today);
                  form.setValue('endDate', nextWeek);
                } else {
                  form.setValue('startDate', null);
                  form.setValue('endDate', null);
                }
              }}
            />

            {showTemporalDates && (
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field, fieldState }) => (
                    <FormItem data-field="startDate">
                      <FormControl>
                        <FloatingLabelDateInput
                          label="Fecha inicio"
                          value={field.value ?? undefined}
                          onChange={field.onChange}
                          valid={!!field.value && !fieldState.error}
                          invalid={!!fieldState.error}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field, fieldState }) => (
                    <FormItem data-field="endDate">
                      <FormControl>
                        <FloatingLabelDateInput
                          label="Fecha fin"
                          value={field.value ?? undefined}
                          onChange={field.onChange}
                          valid={!!field.value && !fieldState.error}
                          invalid={!!fieldState.error}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
