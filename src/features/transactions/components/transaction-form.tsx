'use client';

import { useState, useTransition, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, Pencil, Store, Tag, Wallet, StickyNote, X, Calendar, ArrowRight, Check, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
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
import { CategorySelector } from '@/components/category-selector';
import { CurrencyInput } from '@/components/currency-input';
import { EntitySelector } from '@/components/entity-selector';
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
import type { Account } from '@/features/accounts/types';
import { type AccountType } from '@/features/accounts/types';
import type { Entity } from '@/features/entities/types';
import { AccountTypeIcon } from '@/features/accounts/components/account-type-icon';

// ============================================================================
// TYPES
// ============================================================================

interface Budget {
  id: string;
  name: string;
  categoryId: string | null;
}

type FormMode = 'expense' | 'income' | 'transfer';

export interface TransactionDialogContentProps {
  projectId: string;
  userId: string;
  categories: Category[];
  accounts: Account[];
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
    const map = new Map<string, Account>();
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
  const selectedAccount = accountsMap.get(watchedAccountId);
  const isCreditCardExpense = selectedAccount?.type === 'credit_card' && watchedType === 'expense';

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
        onSuccess();
        onMutationSuccess?.(toastId, transaction ? 'Transacción actualizada' : 'Transacción creada');
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
        onSuccess();
        onMutationSuccess?.(toastId, 'Transferencia creada');
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
      <div className="mx-auto w-full max-w-lg flex flex-col max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>
            {isEditing ? 'Editar transacción' : isTransferMode ? 'Nueva transferencia' : 'Nueva transacción'}
          </DrawerTitle>
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
          <>
            <div className="flex-1 overflow-y-auto px-4 space-y-4">
              {/* Amount - Hero section */}
              <div className="pb-2">
                <CurrencyInput
                  value={transferAmount}
                  onChange={setTransferAmount}
                  currency={defaultCurrency}
                  placeholder="0"
                  size="lg"
                />
              </div>

              {/* From Account */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Cuenta origen</label>
                <Select value={transferFromAccountId} onValueChange={setTransferFromAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona cuenta origen" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts
                      .filter((acc) => acc.id !== transferToAccountId)
                      .map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          <div className="flex items-center gap-2">
                            <AccountTypeIcon type={account.type as AccountType} className="h-4 w-4" />
                            {account.name}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* To Account */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Cuenta destino</label>
                <Select value={transferToAccountId} onValueChange={setTransferToAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona cuenta destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts
                      .filter((acc) => acc.id !== transferFromAccountId)
                      .map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          <div className="flex items-center gap-2">
                            <AccountTypeIcon type={account.type as AccountType} className="h-4 w-4" />
                            {account.name}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description (optional) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Descripción (opcional)</label>
                <Input
                  placeholder="Ej: Ahorro mensual"
                  value={transferDescription}
                  onChange={(e) => setTransferDescription(e.target.value)}
                />
              </div>

              {/* Date (optional) */}
              {showDate && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha</label>
                  <Input
                    type="date"
                    value={transferDate.toISOString().split('T')[0]}
                    onChange={(e) => setTransferDate(new Date(e.target.value + 'T12:00:00'))}
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Notas (opcional)</label>
                <Textarea
                  placeholder="Notas adicionales..."
                  className="resize-none"
                  rows={3}
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                />
              </div>

              {/* Toggle for date */}
              {!showDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-auto py-1 px-2"
                  onClick={() => setShowDate(true)}
                >
                  <Calendar className="mr-1.5 h-3 w-3" />
                  Cambiar fecha
                </Button>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DrawerFooter className="px-4 pb-4">
              <Button type="button" variant="cta" onClick={onSubmitTransfer} disabled={isPending} className="w-full">
                {isPending ? 'Creando...' : (
                  <>
                    Crear transferencia
                    <ArrowRightLeft className="h-5 w-5" />
                  </>
                )}
              </Button>
            </DrawerFooter>
          </>
        ) : (
          /* Regular Transaction Form */
          <Form {...form}>
            <form id="transaction-form" onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-4 space-y-4">
            {/* Type Selector for editing */}
            {isEditing && (
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
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
              render={({ field }) => (
                <FormItem className="pb-2">
                  <FormControl>
                    <CurrencyInput
                      value={field.value}
                      onChange={field.onChange}
                      currency={defaultCurrency}
                      placeholder="0"
                      size="lg"
                    />
                  </FormControl>
                  <FormMessage className="text-center" />
                </FormItem>
              )}
            />

            {/* Account */}
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una cuenta" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          <div className="flex items-center gap-2">
                            <AccountTypeIcon type={account.type as AccountType} className="h-4 w-4" />
                            {account.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tienda</FormLabel>
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
                          placeholder="Selecciona una tienda"
                          searchPlaceholder="Buscar tienda..."
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
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Supermercado Jumbo" {...field} />
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
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Presupuesto (opcional)</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          const budgetId = value === '_none_' ? null : value;
                          field.onChange(budgetId);
                          // Auto-select category if budget has one
                          if (budgetId) {
                            const selectedBudget = budgets.find((b) => b.id === budgetId);
                            if (selectedBudget?.categoryId) {
                              form.setValue('categoryId', selectedBudget.categoryId);
                            }
                          }
                        }}
                        value={field.value ?? '_none_'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sin presupuesto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none_">Sin presupuesto</SelectItem>
                          {budgets.map((budget) => (
                            <SelectItem key={budget.id} value={budget.id}>
                              {budget.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría (opcional)</FormLabel>
                      <FormControl>
                        <CategorySelector
                          categories={activeCategories}
                          value={field.value ?? undefined}
                          onValueChange={(value) => field.onChange(value ?? null)}
                          projectId={projectId}
                          userId={userId}
                          placeholder="Sin categoría"
                          onCategoryCreated={handleCategoryCreated}
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
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value instanceof Date
                            ? field.value.toISOString().split('T')[0]
                            : String(field.value).split('T')[0]}
                          onChange={(e) => field.onChange(new Date(e.target.value + 'T12:00:00'))}
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
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Notas adicionales..."
                          className="resize-none"
                          rows={3}
                          {...field}
                          value={field.value ?? ''}
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
            </form>

            <DrawerFooter className="px-4 pb-4">
              <Button type="submit" form="transaction-form" variant="cta" disabled={isPending} className="w-full">
                {isPending ? 'Guardando...' : isEditing ? (
                  <>
                    Guardar cambios
                    <Check className="h-5 w-5" />
                  </>
                ) : (
                  <>
                    Crear transacción
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </Button>
            </DrawerFooter>
          </Form>
        )}
      </div>
    </DrawerContent>
  );
}
