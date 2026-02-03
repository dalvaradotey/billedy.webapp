'use client';

import { useState, useTransition, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowUpCircle, ArrowDownCircle, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Switch } from '@/components/ui/switch';
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

  const getDefaultValues = useCallback(() => {
    if (transaction) {
      return {
        projectId,
        description: transaction.description,
        originalAmount: parseFloat(transaction.originalAmount),
        date: transaction.date,
        type: transaction.type as 'income' | 'expense',
        categoryId: transaction.categoryId,
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
      categoryId: '',
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
    }
  };

  return (
    <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>
          {isEditing ? 'Editar transacción' : isTransferMode ? 'Nueva transferencia' : 'Nueva transacción'}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Modifica los datos de la transacción.'
            : isTransferMode
            ? 'Mueve dinero entre tus cuentas.'
            : 'Registra un nuevo ingreso o gasto.'}
        </DialogDescription>
      </DialogHeader>

      {/* Type Selector - 3 buttons */}
      {!isEditing && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant={formMode === 'expense' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => handleModeChange('expense')}
          >
            <ArrowDownCircle className="mr-2 h-4 w-4" />
            Gasto
          </Button>
          <Button
            type="button"
            variant={formMode === 'income' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => handleModeChange('income')}
          >
            <ArrowUpCircle className="mr-2 h-4 w-4" />
            Ingreso
          </Button>
          <Button
            type="button"
            variant={formMode === 'transfer' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => handleModeChange('transfer')}
          >
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Transferencia
          </Button>
        </div>
      )}

      {/* Transfer Form */}
      {isTransferMode && !isEditing ? (
        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          {/* Amount and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Monto</label>
              <CurrencyInput
                value={transferAmount}
                onChange={setTransferAmount}
                currency={defaultCurrency}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha</label>
              <Input
                type="date"
                value={transferDate.toISOString().split('T')[0]}
                onChange={(e) => setTransferDate(new Date(e.target.value + 'T12:00:00'))}
              />
            </div>
          </div>

          {/* From Account */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Cuenta origen</label>
            <Select value={transferFromAccountId} onValueChange={setTransferFromAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona cuenta de origen" />
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id} disabled={acc.id === transferToAccountId}>
                    <div className="flex items-center gap-2">
                      <AccountTypeIcon type={acc.type as AccountType} className="h-4 w-4" />
                      {acc.name}
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
                <SelectValue placeholder="Selecciona cuenta de destino" />
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id} disabled={acc.id === transferFromAccountId}>
                    <div className="flex items-center gap-2">
                      <AccountTypeIcon type={acc.type as AccountType} className="h-4 w-4" />
                      {acc.name}
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

          {/* Notes (optional) */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Notas (opcional)</label>
            <Input
              placeholder="Notas adicionales..."
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" onClick={onSubmitTransfer} disabled={isPending} className="w-full sm:w-auto">
              {isPending ? 'Creando...' : 'Crear transferencia'}
            </Button>
          </DialogFooter>
        </div>
      ) : (
        /* Regular Transaction Form */
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto flex-1 pr-2">
            {/* Type Selector for editing */}
            {isEditing && (
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
                        onClick={() => field.onChange('expense')}
                      >
                        <ArrowDownCircle className="mr-2 h-4 w-4" />
                        Gasto
                      </Button>
                      <Button
                        type="button"
                        variant={field.value === 'income' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => field.onChange('income')}
                      >
                        <ArrowUpCircle className="mr-2 h-4 w-4" />
                        Ingreso
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Amount and Date */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="originalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                        currency={defaultCurrency}
                        placeholder="0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
            </div>

            {/* Description */}
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

            {/* Budget (optional) */}
            {budgets.length > 0 && (
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
            )}

            {/* Category */}
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <FormControl>
                    <CategorySelector
                      categories={activeCategories}
                      value={field.value}
                      onValueChange={(value) => field.onChange(value ?? '')}
                      projectId={projectId}
                      userId={userId}
                      placeholder="Selecciona una categoría"
                      onCategoryCreated={handleCategoryCreated}
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
                      {activeAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          <div className="flex items-center gap-2">
                            <AccountTypeIcon type={acc.type as AccountType} className="h-4 w-4" />
                            {acc.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Entity (optional) */}
            {entities.length > 0 && (
              <FormField
                control={form.control}
                name="entityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entidad (opcional)</FormLabel>
                    <FormControl>
                      <EntitySelector
                        entities={entities}
                        value={field.value}
                        onValueChange={(value) => field.onChange(value)}
                        placeholder="Selecciona una entidad"
                        searchPlaceholder="Buscar entidad..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Notas adicionales..." {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Paid Switch - oculto para gastos en TC (siempre se marcan como pagados automáticamente) */}
            {!isCreditCardExpense && (
              <FormField
                control={form.control}
                name="isPaid"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Marcar como pagado</FormLabel>
                      <p className="text-[0.8rem] text-muted-foreground">
                        Indica si esta transacción ya fue pagada
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear transacción'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      )}
    </DialogContent>
  );
}
