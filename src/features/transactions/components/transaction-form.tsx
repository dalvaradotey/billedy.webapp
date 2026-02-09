'use client';

import { useState, useTransition, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, Pencil, Store, Tag, Wallet, StickyNote, X, Calendar, ArrowRight, Check, ArrowRightLeft, CheckCircle2, XCircle } from 'lucide-react';
import { useFormValidation, useSuccessAnimation } from '@/hooks';
import { SuccessOverlay } from '@/components/success-overlay';
import { SubmitButton } from '@/components/submit-button';
import { ProgressIndicator } from '@/components/progress-indicator';
import { FloatingLabelInput } from '@/components/floating-label-input';
import { FloatingLabelTextarea } from '@/components/floating-label-textarea';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { CategorySelector } from '@/components/category-selector';
import { CurrencyInput } from '@/components/currency-input';
import { EntitySelector } from '@/components/entity-selector';
import { AccountSelector } from '@/components/account-selector';
import { BudgetSelector } from '@/components/budget-selector';
import {
  createTransaction,
  updateTransaction,
  createAccountTransfer,
} from '../actions';
import {
  createTransactionSchema,
  type CreateTransactionInput,
  type CreateAccountTransferInput,
} from '../schemas';
import type { TransactionWithCategory } from '../types';
import type { Category } from '@/features/categories/types';
import type { AccountWithEntity } from '@/features/accounts/types';
import type { Entity } from '@/features/entities/types';

// ============================================================================
// TYPES
// ============================================================================

interface Budget {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
}

type FormMode = 'expense' | 'income' | 'transfer';

export interface TransactionDialogContentProps {
  projectId: string;
  userId: string;
  categories: Category[];
  accounts: AccountWithEntity[];
  budgets: Budget[];
  entities: Entity[];
  transaction: TransactionWithCategory | null;
  defaultCurrency: string;
  onSuccess: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

// ============================================================================
// TRANSACTION DIALOG CONTENT
// ============================================================================

export function TransactionDialogContent({
  projectId,
  userId,
  categories,
  accounts,
  budgets,
  entities,
  transaction,
  defaultCurrency,
  onSuccess,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: TransactionDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localCategories, setLocalCategories] = useState(categories);

  // Form UX hooks
  const { onInvalid } = useFormValidation();
  const { showSuccess, triggerSuccess } = useSuccessAnimation({ onComplete: onSuccess });
  const [formMode, setFormMode] = useState<FormMode>('expense');
  const [useManualDescription, setUseManualDescription] = useState(false);
  const [showManualCategory, setShowManualCategory] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showDate, setShowDate] = useState(false);

  // Transfer form state (separate from main form)
  const [transferFromAccountId, setTransferFromAccountId] = useState('');
  const [transferToAccountId, setTransferToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState<number | undefined>(undefined);
  const [transferDate, setTransferDate] = useState<Date>(new Date());
  const [transferDescription, setTransferDescription] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [showTransferDescription, setShowTransferDescription] = useState(false);
  const [showTransferNotes, setShowTransferNotes] = useState(false);

  // Update local categories when props change
  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const handleCategoryCreated = (newCategory: { id: string; name: string; color: string }) => {
    setLocalCategories((prev) => [...prev, { ...newCategory, projectId, isArchived: false, createdAt: new Date(), updatedAt: new Date() }]);
  };

  // Find default account
  const defaultAccount = accounts.find((a) => a.isDefault && !a.isArchived);
  const activeAccounts = accounts.filter((a) => !a.isArchived);

  // Mapa de cuentas para verificar tipo
  const accountsMap = useMemo(() => {
    const map = new Map<string, AccountWithEntity>();
    accounts.forEach((acc) => map.set(acc.id, acc));
    return map;
  }, [accounts]);

  // Mapa de entidades para obtener nombres
  const entitiesMap = useMemo(() => {
    const map = new Map<string, Entity>();
    entities.forEach((e) => map.set(e.id, e));
    return map;
  }, [entities]);

  // Genera descripción automática basada en tipo y entidad
  const generateDescription = useCallback((entityId: string, type: 'expense' | 'income') => {
    const entity = entitiesMap.get(entityId);
    if (!entity) return '';

    if (type === 'expense') {
      return `Compra ${entity.name}`;
    } else {
      return `Pago ${entity.name}`;
    }
  }, [entitiesMap]);

  const getDefaultValues = useCallback(() => {
    if (transaction) {
      return {
        projectId,
        description: transaction.description,
        originalAmount: parseFloat(transaction.originalAmount),
        date: transaction.date,
        type: transaction.type as 'income' | 'expense',
        categoryId: transaction.categoryId ?? undefined,
        budgetId: transaction.budgetId ?? undefined,
        entityId: transaction.entityId ?? undefined,
        isPaid: transaction.isPaid,
        notes: transaction.notes ?? '',
        accountId: transaction.accountId ?? defaultAccount?.id ?? '',
      };
    }
    return {
      projectId,
      description: '',
      originalAmount: undefined as unknown as number,
      date: new Date(),
      type: 'expense' as const,
      categoryId: undefined as string | undefined,
      budgetId: undefined as string | undefined,
      entityId: undefined as string | undefined,
      isPaid: false,
      notes: '',
      accountId: defaultAccount?.id ?? '',
    };
  }, [transaction, projectId, defaultAccount?.id]);

  const form = useForm<CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: getDefaultValues(),
  });

  // Reset form when transaction changes (for edit mode)
  useEffect(() => {
    form.reset(getDefaultValues());
    // Reset transfer form too
    setTransferFromAccountId(defaultAccount?.id ?? '');
    setTransferToAccountId('');
    setTransferAmount(undefined);
    setTransferDate(new Date());
    setTransferDescription('');
    setTransferNotes('');
    setShowTransferDescription(false);
    setShowTransferNotes(false);
    // Reset manual description toggle
    setUseManualDescription(false);
    // Reset manual category toggle
    setShowManualCategory(false);
    // Reset notes toggle
    setShowNotes(false);
    // Reset date toggle (show if editing, hide if new)
    setShowDate(!!transaction);
    // Reset form mode when editing
    if (transaction) {
      setFormMode(transaction.type as FormMode);
    } else {
      setFormMode('expense');
    }
  }, [transaction, form, getDefaultValues, defaultAccount?.id]);

  const activeCategories = localCategories.filter((c) => !c.isArchived);

  // Detectar si es un gasto en tarjeta de crédito para ocultar el switch de isPaid
  const watchedAccountId = form.watch('accountId');
  const watchedType = form.watch('type');
  const watchedAmount = form.watch('originalAmount');
  const watchedDescription = form.watch('description');
  const selectedAccount = accountsMap.get(watchedAccountId);
  const isCreditCardExpense = selectedAccount?.type === 'credit_card' && watchedType === 'expense';

  // Calculate form progress for transaction form
  const transactionProgress = useMemo(() => {
    const fields = [
      watchedAmount !== undefined && watchedAmount > 0,
      !!watchedAccountId,
      !!watchedDescription,
    ];
    return fields.filter(Boolean).length;
  }, [watchedAmount, watchedAccountId, watchedDescription]);

  // Calculate form progress for transfer form
  const transferProgress = useMemo(() => {
    const fields = [
      transferAmount !== undefined && transferAmount > 0,
      !!transferFromAccountId,
      !!transferToAccountId,
    ];
    return fields.filter(Boolean).length;
  }, [transferAmount, transferFromAccountId, transferToAccountId]);

  const onSubmit = (data: CreateTransactionInput) => {
    setError(null);
    const toastId = toast.loading(transaction ? 'Actualizando transacción...' : 'Creando transacción...');
    onMutationStart?.();

    startTransition(async () => {
      const result = transaction
        ? await updateTransaction(transaction.id, userId, data)
        : await createTransaction(userId, data);

      if (result.success) {
        form.reset();
        onMutationSuccess?.(toastId, transaction ? 'Transacción actualizada' : 'Transacción creada');
        triggerSuccess();
      } else {
        setError(result.error);
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const onSubmitTransfer = () => {
    setError(null);

    // Validate transfer fields
    if (!transferFromAccountId) {
      setError('Selecciona una cuenta de origen');
      return;
    }
    if (!transferToAccountId) {
      setError('Selecciona una cuenta de destino');
      return;
    }
    if (transferFromAccountId === transferToAccountId) {
      setError('La cuenta de origen y destino deben ser diferentes');
      return;
    }
    if (!transferAmount || transferAmount <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }

    const toastId = toast.loading('Creando transferencia...');
    onMutationStart?.();

    startTransition(async () => {
      const transferData: CreateAccountTransferInput = {
        projectId,
        fromAccountId: transferFromAccountId,
        toAccountId: transferToAccountId,
        amount: transferAmount,
        date: transferDate,
        description: transferDescription || undefined,
        notes: transferNotes || undefined,
      };

      const result = await createAccountTransfer(userId, transferData);

      if (result.success) {
        // Reset transfer form
        setTransferFromAccountId(defaultAccount?.id ?? '');
        setTransferToAccountId('');
        setTransferAmount(undefined);
        setTransferDate(new Date());
        setTransferDescription('');
        setTransferNotes('');
        onMutationSuccess?.(toastId, 'Transferencia creada');
        triggerSuccess();
      } else {
        setError(result.error);
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const isEditing = !!transaction;
  const isTransferMode = formMode === 'transfer';

  // Handle form mode change
  const handleModeChange = (mode: FormMode) => {
    setFormMode(mode);
    setError(null);
    if (mode !== 'transfer') {
      form.setValue('type', mode);
      // Si hay una entidad seleccionada y no está en modo manual, actualizar descripción
      const currentEntityId = form.getValues('entityId');
      if (currentEntityId && !useManualDescription) {
        const autoDescription = generateDescription(currentEntityId, mode);
        form.setValue('description', autoDescription);
      }
    }
  };

  return (
    <DrawerContent>
      <SuccessOverlay show={showSuccess} />
      <div className="mx-auto w-full max-w-lg md:flex md:flex-col md:h-full">
        <DrawerHeader>
          <div className="md:flex md:items-center md:justify-between">
            <DrawerTitle>
              {isEditing ? 'Editar transacción' : isTransferMode ? 'Nueva transferencia' : 'Nueva transacción'}
            </DrawerTitle>
            {/* Progress indicator - desktop only */}
            {!isEditing && (
              <ProgressIndicator current={isTransferMode ? transferProgress : transactionProgress} />
            )}
          </div>
          <DrawerDescription>
            {isEditing
              ? 'Modifica los datos de la transacción.'
              : isTransferMode
              ? 'Mueve dinero entre tus cuentas.'
              : 'Registra un nuevo ingreso o gasto.'}
          </DrawerDescription>
        </DrawerHeader>

      {/* Type Selector - Tabs */}
      {!isEditing && (
        <div className="px-4 pb-4">
          <Tabs value={formMode} onValueChange={(v) => handleModeChange(v as FormMode)}>
            <TabsList className="w-full">
              <TabsTrigger value="expense" className="flex-1 gap-2">
                <ArrowDownCircle className="h-4 w-4" />
                Gasto
              </TabsTrigger>
              <TabsTrigger value="income" className="flex-1 gap-2">
                <ArrowUpCircle className="h-4 w-4" />
                Ingreso
              </TabsTrigger>
              <TabsTrigger value="transfer" className="flex-1 gap-2">
                <ArrowLeftRight className="h-4 w-4" />
                Transferencia
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

        {/* Transfer Form */}
        {isTransferMode && !isEditing ? (
          <ScrollArea key="transfer" className="h-[65vh] md:flex-1 animate-fade-in">
            <div className="px-4 pt-2 space-y-4 pb-4">
              {/* Amount - Hero section */}
              <div className="pb-2">
                <CurrencyInput
                  value={transferAmount}
                  onChange={setTransferAmount}
                  currency={defaultCurrency}
                  placeholder="0"
                  size="lg"
                  label="Monto"
                  valid={transferAmount !== undefined && transferAmount > 0}
                  autoFocus
                />
              </div>

              {/* From Account */}
              <AccountSelector
                accounts={activeAccounts.filter((acc) => acc.id !== transferToAccountId)}
                value={transferFromAccountId}
                onValueChange={(value) => setTransferFromAccountId(value ?? '')}
                label="Cuenta origen"
                searchPlaceholder="Buscar cuenta..."
                valid={!!transferFromAccountId}
              />

              {/* To Account */}
              <AccountSelector
                accounts={activeAccounts.filter((acc) => acc.id !== transferFromAccountId)}
                value={transferToAccountId}
                onValueChange={(value) => setTransferToAccountId(value ?? '')}
                label="Cuenta destino"
                searchPlaceholder="Buscar cuenta..."
                valid={!!transferToAccountId}
              />

              {/* Description (optional) */}
              {showTransferDescription && (
                <div className="space-y-2">
                  <FloatingLabelInput
                    label="Descripción"
                    value={transferDescription}
                    onChange={setTransferDescription}
                    placeholder="Ej: Ahorro mensual"
                    valid={!!transferDescription}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-auto p-0"
                    onClick={() => {
                      setTransferDescription('');
                      setShowTransferDescription(false);
                    }}
                  >
                    <X className="mr-1.5 h-3 w-3" />
                    Quitar descripción
                  </Button>
                </div>
              )}

              {/* Date (optional) */}
              {showDate && (
                <div className="space-y-2">
                  <FloatingLabelInput
                    label="Fecha"
                    type="date"
                    value={transferDate.toISOString().split('T')[0]}
                    onChange={(val) => setTransferDate(new Date(val + 'T12:00:00'))}
                    valid={!!transferDate}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-auto p-0"
                    onClick={() => {
                      setTransferDate(new Date());
                      setShowDate(false);
                    }}
                  >
                    <X className="mr-1.5 h-3 w-3" />
                    Usar fecha de hoy
                  </Button>
                </div>
              )}

              {/* Notes (optional) */}
              {showTransferNotes && (
                <div className="space-y-2">
                  <FloatingLabelTextarea
                    label="Notas"
                    value={transferNotes}
                    onChange={setTransferNotes}
                    placeholder="Notas adicionales..."
                    valid={!!transferNotes}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-auto p-0"
                    onClick={() => {
                      setTransferNotes('');
                      setShowTransferNotes(false);
                    }}
                  >
                    <X className="mr-1.5 h-3 w-3" />
                    Quitar notas
                  </Button>
                </div>
              )}

              {/* Optional toggles row */}
              {(!showTransferDescription || !showDate || !showTransferNotes) && (
                <div className="flex flex-wrap gap-3 pt-2 border-t">
                  {!showTransferDescription && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground h-auto py-1 px-2"
                      onClick={() => setShowTransferDescription(true)}
                    >
                      <Pencil className="mr-1.5 h-3 w-3" />
                      Descripción
                    </Button>
                  )}
                  {!showDate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground h-auto py-1 px-2"
                      onClick={() => setShowDate(true)}
                    >
                      <Calendar className="mr-1.5 h-3 w-3" />
                      Fecha
                    </Button>
                  )}
                  {!showTransferNotes && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground h-auto py-1 px-2"
                      onClick={() => setShowTransferNotes(true)}
                    >
                      <StickyNote className="mr-1.5 h-3 w-3" />
                      Notas
                    </Button>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <DrawerFooter className="px-0 pb-0">
                <SubmitButton
                  type="button"
                  isPending={isPending}
                  pendingText="Creando..."
                  icon={<ArrowRightLeft className="size-7" />}
                  onClick={onSubmitTransfer}
                >
                  Crear transferencia
                </SubmitButton>
              </DrawerFooter>
            </div>
          </ScrollArea>
        ) : (
          /* Regular Transaction Form */
          <ScrollArea key="transaction" className="h-[65vh] md:flex-1 animate-fade-in">
            <Form {...form}>
              <form id="transaction-form" onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="px-4 pt-2 space-y-4 pb-4">
            {/* Type Selector for editing */}
            {isEditing && (
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem data-field="type">
                    <FormLabel>Tipo</FormLabel>
                    <Tabs value={field.value} onValueChange={field.onChange}>
                      <TabsList className="w-full">
                        <TabsTrigger value="expense" className="flex-1 gap-2">
                          <ArrowDownCircle className="h-4 w-4" />
                          Gasto
                        </TabsTrigger>
                        <TabsTrigger value="income" className="flex-1 gap-2">
                          <ArrowUpCircle className="h-4 w-4" />
                          Ingreso
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Amount - Hero section */}
            <FormField
              control={form.control}
              name="originalAmount"
              render={({ field, fieldState }) => (
                <FormItem className="pb-2" data-field="originalAmount">
                  <FormControl>
                    <CurrencyInput
                      value={field.value}
                      onChange={field.onChange}
                      currency={defaultCurrency}
                      placeholder="0"
                      size="lg"
                      label="Monto"
                      valid={field.value !== undefined && field.value > 0}
                      invalid={!!fieldState.error}
                      autoFocus={!isEditing}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Account */}
            <FormField
              control={form.control}
              name="accountId"
              render={({ field, fieldState }) => (
                <FormItem data-field="accountId">
                  <FormControl>
                    <AccountSelector
                      accounts={activeAccounts}
                      value={field.value}
                      onValueChange={(value) => field.onChange(value ?? '')}
                      label="Cuenta de cargo"
                      searchPlaceholder="Buscar cuenta..."
                      valid={!!field.value}
                      invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Entity or Manual Description toggle */}
            {entities.length > 0 && !useManualDescription ? (
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="entityId"
                  render={({ field, fieldState }) => (
                    <FormItem data-field="entityId">
                      <FormControl>
                        <EntitySelector
                          entities={entities}
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            // Auto-generar descripción basada en la entidad y tipo
                            if (value) {
                              const currentType = form.getValues('type');
                              const autoDescription = generateDescription(value, currentType);
                              form.setValue('description', autoDescription);
                            }
                          }}
                          label="Tienda"
                          searchPlaceholder="Buscar tienda..."
                          valid={!!field.value}
                          invalid={!!fieldState.error}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-auto p-0"
                  onClick={() => setUseManualDescription(true)}
                >
                  <Pencil className="mr-1.5 h-3 w-3" />
                  Escribir tienda manualmente
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field, fieldState }) => (
                    <FormItem data-field="description">
                      <FormControl>
                        <FloatingLabelInput
                          label="Descripción"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          valid={!!field.value}
                          invalid={!!fieldState.error}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {entities.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-auto p-0"
                    onClick={() => setUseManualDescription(false)}
                  >
                    <Store className="mr-1.5 h-3 w-3" />
                    Seleccionar tienda
                  </Button>
                )}
              </div>
            )}

            {/* Budget or Category toggle */}
            {budgets.length > 0 && !showManualCategory ? (
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="budgetId"
                  render={({ field, fieldState }) => (
                    <FormItem data-field="budgetId">
                      <FormControl>
                        <BudgetSelector
                          budgets={budgets}
                          value={field.value}
                          onValueChange={(budgetId) => {
                            field.onChange(budgetId);
                            // Auto-select category if budget has one
                            if (budgetId) {
                              const selectedBudget = budgets.find((b) => b.id === budgetId);
                              if (selectedBudget?.categoryId) {
                                form.setValue('categoryId', selectedBudget.categoryId);
                              }
                            }
                          }}
                          label="Presupuesto (opcional)"
                          searchPlaceholder="Buscar presupuesto..."
                          valid={!!field.value}
                          invalid={!!fieldState.error}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-auto p-0"
                  onClick={() => setShowManualCategory(true)}
                >
                  <Tag className="mr-1.5 h-3 w-3" />
                  Seleccionar categoría manualmente
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field, fieldState }) => (
                    <FormItem data-field="categoryId">
                      <FormControl>
                        <CategorySelector
                          categories={activeCategories}
                          value={field.value ?? undefined}
                          onValueChange={(value) => field.onChange(value ?? null)}
                          projectId={projectId}
                          userId={userId}
                          label="Categoría (opcional)"
                          placeholder="Sin categoría"
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
                {budgets.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-auto p-0"
                    onClick={() => setShowManualCategory(false)}
                  >
                    <Wallet className="mr-1.5 h-3 w-3" />
                    Usar presupuesto
                  </Button>
                )}
              </div>
            )}

            {/* Date (optional) */}
            {showDate && (
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field, fieldState }) => {
                    const hasValue = !!field.value;
                    const hasError = !!fieldState.error;
                    return (
                      <FormItem data-field="date">
                        <FormControl>
                          <div className="relative">
                            <span
                              className={cn(
                                "absolute left-3 top-1.5 text-xs flex items-center gap-1 pointer-events-none",
                                hasValue ? "text-emerald-600" : hasError ? "text-destructive" : "text-muted-foreground"
                              )}
                            >
                              Fecha
                              {hasValue && <CheckCircle2 className="h-3.5 w-3.5" />}
                              {hasError && !hasValue && <XCircle className="h-3.5 w-3.5" />}
                            </span>
                            <Input
                              type="date"
                              {...field}
                              value={field.value instanceof Date
                                ? field.value.toISOString().split('T')[0]
                                : String(field.value).split('T')[0]}
                              onChange={(e) => field.onChange(new Date(e.target.value + 'T12:00:00'))}
                              className={cn(
                                "h-14 pt-5 pb-1",
                                hasValue && "ring-1 ring-emerald-500",
                                hasError && "ring-1 ring-destructive"
                              )}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-auto p-0"
                  onClick={() => {
                    form.setValue('date', new Date());
                    setShowDate(false);
                  }}
                >
                  <X className="mr-1.5 h-3 w-3" />
                  Usar fecha de hoy
                </Button>
              </div>
            )}

            {/* Notes (optional) */}
            {showNotes && (
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field, fieldState }) => (
                    <FormItem data-field="notes">
                      <FormControl>
                        <FloatingLabelTextarea
                          label="Notas"
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          placeholder="Notas adicionales..."
                          valid={!!field.value}
                          invalid={!!fieldState.error}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-auto p-0"
                  onClick={() => {
                    form.setValue('notes', '');
                    setShowNotes(false);
                  }}
                >
                  <X className="mr-1.5 h-3 w-3" />
                  Ocultar notas
                </Button>
              </div>
            )}

            {/* Optional toggles row */}
            {(!showDate || !showNotes || !isCreditCardExpense) && (
              <div className="flex flex-wrap gap-3 pt-2 border-t">
                {!showDate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-auto py-1 px-2"
                    onClick={() => setShowDate(true)}
                  >
                    <Calendar className="mr-1.5 h-3 w-3" />
                    Fecha
                  </Button>
                )}
                {!showNotes && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-auto py-1 px-2"
                    onClick={() => setShowNotes(true)}
                  >
                    <StickyNote className="mr-1.5 h-3 w-3" />
                    Notas
                  </Button>
                )}
                {!isCreditCardExpense && (
                  <FormField
                    control={form.control}
                    name="isPaid"
                    render={({ field }) => (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-auto py-1 px-2",
                          field.value ? "text-emerald-600" : "text-muted-foreground"
                        )}
                        onClick={() => field.onChange(!field.value)}
                      >
                        {field.value ? "✓ Pagado" : "Marcar pagado"}
                      </Button>
                    )}
                  />
                )}
              </div>
            )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <DrawerFooter className="px-0 pb-0">
                <SubmitButton
                  isPending={isPending}
                  pendingText="Guardando..."
                  icon={isEditing ? <Check className="size-7" /> : <ArrowRight className="size-7" />}
                >
                  {isEditing ? 'Guardar cambios' : 'Crear transacción'}
                </SubmitButton>
              </DrawerFooter>
              </form>
            </Form>
          </ScrollArea>
        )}
      </div>
    </DrawerContent>
  );
}
