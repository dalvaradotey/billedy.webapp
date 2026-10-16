'use client';

import { useState, useTransition, useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Pencil, Store, Tag, Wallet, X, XCircle } from 'lucide-react';
import { useFormValidation, useSuccessAnimation } from '@/hooks';
import { SuccessOverlay } from '@/components/success-overlay';
import { SubmitButton } from '@/components/submit-button';
import { FloatingLabelInput } from '@/components/floating-label-input';
import { FloatingLabelTextarea } from '@/components/floating-label-textarea';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { CategorySelector } from '@/components/category-selector';
import { NatureSelector } from './nature-selector';
import { DescriptionField } from './description-field';
import { CapImpactNotice } from './cap-impact-notice';
import { AccountCardPicker } from './account-card-picker';
import { TONE_CLASSES, toneForName } from '@/lib/pulse-tone';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { fetchCardImpactData, type CardImpactData } from '@/features/billing-cycles/actions';
import { fetchAccountFunds } from '@/features/accounts/fund-actions';
import type { AccountFund } from '@/features/accounts/lib/funds';
import { formatCurrency } from '@/lib/formatting';
import { normalizeNature, type TransactionNature } from '../nature';
import { CurrencyInput } from '@/components/currency-input';
import { EntitySelector } from '@/components/entity-selector';
import { BudgetSelector } from '@/components/budget-selector';
import { SavingsGoalSelector } from '@/components/savings-goal-selector';
import {
  createTransaction,
  updateTransaction,
  createAccountTransfer,
  fetchDescriptionSuggestions,
  type DescriptionSuggestion,
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
  defaultAccountId?: string | null;
}

interface SavingsGoal {
  id: string;
  name: string;
}

type FormMode = 'expense' | 'income' | 'transfer';

export interface TransactionInitialValues {
  budgetId?: string;
  categoryId?: string;
  accountId?: string;
  type?: 'expense' | 'income';
}

export interface TransactionDialogContentProps {
  projectId: string;
  userId: string;
  categories: Category[];
  accounts: AccountWithEntity[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  entities: Entity[];
  transaction: TransactionWithCategory | null;
  defaultCurrency: string;
  onSuccess: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
  initialValues?: TransactionInitialValues;
  /** Callback cuando se crea una transacción exitosamente (para actualizaciones optimistas) */
  onTransactionCreated?: (data: {
    type: 'expense' | 'income';
    amount: number;
    budgetId?: string;
    accountId: string;
    isPaid: boolean;
  }) => void;
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
  savingsGoals,
  entities,
  transaction,
  defaultCurrency,
  onSuccess,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
  initialValues,
  onTransactionCreated,
}: TransactionDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localCategories, setLocalCategories] = useState(categories);

  // Form UX hooks
  const { onInvalid } = useFormValidation();
  const { showSuccess, triggerSuccess } = useSuccessAnimation({ onComplete: onSuccess });
  const [formMode, setFormMode] = useState<FormMode>('expense');
  const [useManualDescription, setUseManualDescription] = useState(!transaction?.entityId);
  const [showManualCategory, setShowManualCategory] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Transfer form state (separate from main form)
  const [transferFromAccountId, setTransferFromAccountId] = useState('');
  const [transferToAccountId, setTransferToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState<number | undefined>(undefined);
  const [transferDate, setTransferDate] = useState<Date>(new Date());
  const [transferDescription, setTransferDescription] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [showTransferAdvancedOptions, setShowTransferAdvancedOptions] = useState(false);
  const [transferSavingsGoalId, setTransferSavingsGoalId] = useState<string | undefined>(undefined);
  const [transferIsThirdParty, setTransferIsThirdParty] = useState(false);

  // Update local categories when props change
  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const handleCategoryCreated = (newCategory: { id: string; name: string; color: string }) => {
    setLocalCategories((prev) => [...prev, { ...newCategory, projectId, isArchived: false, defaultNature: null, createdAt: new Date(), updatedAt: new Date() }]);
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
        savingsGoalId: transaction.savingsGoalId ?? undefined,
        entityId: transaction.entityId ?? undefined,
        isPaid: transaction.isPaid,
        nature: transaction.nature as TransactionNature,
        accountFundId: transaction.accountFundId ?? null,
        notes: transaction.notes ?? '',
        accountId: transaction.accountId ?? defaultAccount?.id ?? '',
      };
    }
    // Use initialValues for new transactions if provided
    return {
      projectId,
      description: '',
      originalAmount: undefined as unknown as number,
      date: new Date(),
      type: initialValues?.type ?? 'expense' as const,
      categoryId: initialValues?.categoryId ?? undefined as string | undefined,
      budgetId: initialValues?.budgetId ?? undefined as string | undefined,
      savingsGoalId: undefined as string | undefined,
      entityId: undefined as string | undefined,
      isPaid: true,
      nature: 'own' as TransactionNature,
      accountFundId: null as string | null,
      notes: '',
      accountId: initialValues?.accountId ?? defaultAccount?.id ?? '',
    };
  }, [transaction, projectId, defaultAccount?.id, initialValues]);

  const form = useForm<CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: getDefaultValues(),
  });

  // Reset form when transaction or initialValues changes
  useEffect(() => {
    form.reset(getDefaultValues());
    // Reset transfer form too
    setTransferFromAccountId(defaultAccount?.id ?? '');
    setTransferToAccountId('');
    setTransferAmount(undefined);
    setTransferDate(new Date());
    setTransferDescription('');
    setTransferNotes('');
    setShowTransferAdvancedOptions(false);
    setTransferSavingsGoalId(undefined);
    // Reset manual description toggle
    setUseManualDescription(!transaction?.entityId);
    // Reset manual category toggle - show budget selector if initialValues has budgetId
    setShowManualCategory(false);
    // Reset advanced options (expanded when editing, collapsed for new)
    setShowAdvancedOptions(!!transaction);
    // Reset form mode
    if (transaction) {
      setFormMode(transaction.type as FormMode);
    } else if (initialValues?.type) {
      setFormMode(initialValues.type);
    } else {
      setFormMode('expense');
    }
  }, [transaction, form, getDefaultValues, defaultAccount?.id, initialValues]);

  const activeCategories = localCategories.filter((c) => !c.isArchived);

  // Naturaleza: se sugiere según la categoría, salvo que el usuario la haya elegido a mano
  const natureTouched = useRef(false);
  const watchedCategoryId = form.watch('categoryId');
  const watchedNatureType = form.watch('type');
  useEffect(() => {
    natureTouched.current = !!transaction;
  }, [transaction]);
  useEffect(() => {
    const currentNature = form.getValues('nature') ?? 'own';
    if (!natureTouched.current) {
      const category = localCategories.find((c) => c.id === watchedCategoryId);
      const suggested = normalizeNature(category?.defaultNature, watchedNatureType);
      if (suggested !== currentNature) form.setValue('nature', suggested);
    } else if (normalizeNature(currentNature, watchedNatureType) !== currentNature) {
      form.setValue('nature', 'own');
    }
  }, [watchedCategoryId, watchedNatureType, localCategories, form]);

  // Detectar tipo de cuenta seleccionada
  const watchedAccountId = form.watch('accountId');
  const watchedType = form.watch('type');
  const watchedAmount = form.watch('originalAmount');
  const selectedAccount = accountsMap.get(watchedAccountId);
  const isCreditCardExpense = selectedAccount?.type === 'credit_card' && watchedType === 'expense';

  // Techo de gasto propio en TC: se consulta al cargar un gasto propio nuevo con tarjeta
  const watchedNature = form.watch('nature');
  const isOwnCardExpense =
    !transaction && isCreditCardExpense && normalizeNature(watchedNature, 'expense') === 'own';
  const [cardImpact, setCardImpact] = useState<CardImpactData | null>(null);
  const cardAvailable = cardImpact?.available ?? null;
  const cardPlanRequested = useRef(false);
  const [capConfirmData, setCapConfirmData] = useState<CreateTransactionInput | null>(null);
  useEffect(() => {
    if (!isOwnCardExpense || cardPlanRequested.current) return;
    cardPlanRequested.current = true;
    fetchCardImpactData(projectId, userId).then((result) => {
      if (result.success && result.data) setCardImpact(result.data);
    });
  }, [isOwnCardExpense, projectId, userId]);

  // Sugerencias de descripción (lo que ya usaste en el proyecto)
  const [descriptionSuggestions, setDescriptionSuggestions] = useState<DescriptionSuggestion[]>([]);
  useEffect(() => {
    if (transaction) return;
    let active = true;
    fetchDescriptionSuggestions(projectId, userId).then((result) => {
      if (active && result.success) setDescriptionSuggestions(result.data);
    });
    return () => {
      active = false;
    };
  }, [transaction, projectId, userId]);

  const handlePickSuggestion = (s: DescriptionSuggestion) => {
    form.setValue('description', s.description, { shouldValidate: true });
    if (s.categoryId) form.setValue('categoryId', s.categoryId);
    if (s.budgetId && budgets.some((b) => b.id === s.budgetId)) form.setValue('budgetId', s.budgetId);
    if (s.accountId && accountsMap.get(s.accountId)) form.setValue('accountId', s.accountId);
  };
  // Fondos de la cuenta: un gasto se puede pagar con un fondo de la misma cuenta
  const [projectFunds, setProjectFunds] = useState<AccountFund[] | null>(null);
  const fundsRequested = useRef(false);
  const watchedFundId = form.watch('accountFundId');
  useEffect(() => {
    if (fundsRequested.current || watchedType !== 'expense') return;
    fundsRequested.current = true;
    fetchAccountFunds(projectId, userId).then((result) => {
      if (result.success) setProjectFunds(result.data);
    });
  }, [watchedType, projectId, userId]);
  const accountFundsForSelected = useMemo(
    () => (projectFunds ?? []).filter((f) => f.accountId === watchedAccountId),
    [projectFunds, watchedAccountId]
  );
  useEffect(() => {
    // Si cambia la cuenta o el tipo, el fondo elegido deja de aplicar
    const current = form.getValues('accountFundId');
    if (!current) return;
    const stillValid =
      watchedType === 'expense' && (projectFunds === null || accountFundsForSelected.some((f) => f.id === current));
    if (!stillValid) form.setValue('accountFundId', null);
  }, [watchedAccountId, watchedType, projectFunds, accountFundsForSelected, form]);

  const isProvisionAccount = selectedAccount?.type === 'pension' || selectedAccount?.type === 'unemployment' || selectedAccount?.type === 'savings';

  // Estado para saldo del proveedor (modo previsional)
  const [providerBalance, setProviderBalance] = useState<number | undefined>(undefined);

  // Buscar categoría de rentabilidad automáticamente para cuentas previsionales
  const profitabilityCategory = useMemo(() => {
    if (!isProvisionAccount || !selectedAccount) return null;
    return categories.find((c) => c.name === `Rentabilidad ${selectedAccount.name}` && !c.isArchived);
  }, [isProvisionAccount, selectedAccount, categories]);

  // Calcular preview de rentabilidad
  const profitabilityPreview = useMemo(() => {
    if (!isProvisionAccount || providerBalance == null || !watchedAmount) return null;
    const currentBalance = parseFloat(selectedAccount?.currentBalance ?? '0');
    const balanceAfterContribution = currentBalance + watchedAmount;
    const adjustment = providerBalance - balanceAfterContribution;
    if (Math.abs(adjustment) < 1) return null;
    return adjustment;
  }, [isProvisionAccount, providerBalance, watchedAmount, selectedAccount]);

  // Forzar tipo income e isPaid para cuentas previsionales
  useEffect(() => {
    if (isProvisionAccount && !transaction) {
      form.setValue('type', 'income');
      form.setValue('isPaid', true);
      setFormMode('income');
      // Auto-generar descripción
      const typeLabel = selectedAccount?.type === 'pension' ? 'AFP' : selectedAccount?.type === 'unemployment' ? 'Cesantía' : 'Ahorro';
      const currentDesc = form.getValues('description');
      if (!currentDesc || currentDesc.startsWith('Aporte ')) {
        form.setValue('description', `Aporte ${typeLabel}`);
      }
    }
  }, [isProvisionAccount, transaction, form, selectedAccount, setFormMode]);

  const onSubmit = (data: CreateTransactionInput) => {
    // Pasarse del techo de gasto propio en TC requiere confirmación explícita
    if (isOwnCardExpense && cardAvailable != null && data.originalAmount > cardAvailable && !capConfirmData) {
      setCapConfirmData(data);
      return;
    }
    submitTransaction(data);
  };

  const submitTransaction = (data: CreateTransactionInput) => {
    setError(null);
    setCapConfirmData(null);

    // Inyectar campos previsionales si aplica
    if (isProvisionAccount && providerBalance != null) {
      data.providerBalance = providerBalance;
      data.profitabilityCategoryId = profitabilityCategory?.id ?? null;
    }

    const toastId = toast.loading(transaction ? 'Actualizando transacción...' : 'Creando transacción...');
    onMutationStart?.();

    startTransition(async () => {
      const result = transaction
        ? await updateTransaction(transaction.id, userId, data)
        : await createTransaction(userId, data);

      if (result.success) {
        // Notificar actualización optimista para nuevas transacciones
        if (!transaction && onTransactionCreated) {
          onTransactionCreated({
            type: data.type,
            amount: data.originalAmount,
            budgetId: data.budgetId ?? undefined,
            accountId: data.accountId,
            isPaid: data.isPaid ?? false,
          });
        }

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
        savingsGoalId: transferSavingsGoalId || undefined,
        isThirdParty: transferIsThirdParty,
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
        setTransferSavingsGoalId(undefined);
        setTransferIsThirdParty(false);
        setShowTransferAdvancedOptions(false);
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

  const capOver = isOwnCardExpense && cardAvailable != null && (watchedAmount || 0) > cardAvailable;
  const typeModes: FormMode[] = isEditing ? ['expense', 'income'] : ['expense', 'income', 'transfer'];
  const activeMode: FormMode = isEditing ? watchedType : formMode;

  // Chips de detalles: muestran lo elegido y abren la sección completa
  const watchedBudgetId = form.watch('budgetId');
  const watchedDate = form.watch('date');
  const watchedNotes = form.watch('notes');
  const watchedSavingsGoalId = form.watch('savingsGoalId');
  const categoryChipLabel =
    budgets.find((b) => b.id === watchedBudgetId)?.name ??
    activeCategories.find((c) => c.id === watchedCategoryId)?.name ??
    'Categoría';
  const goalName = savingsGoals.find((g) => g.id === watchedSavingsGoalId)?.name;
  const extrasChipLabel = goalName ? `Meta: ${goalName}` : watchedNotes ? 'Con nota' : null;
  const openDetail = (field: string) => {
    setShowAdvancedOptions(true);
    requestAnimationFrame(() =>
      document.querySelector(`[data-field="${field}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    );
  };

  return (
    <DrawerContent>
      <SuccessOverlay show={showSuccess} />
      <ConfirmDialog
        open={capConfirmData != null}
        onOpenChange={(open) => {
          if (!open) setCapConfirmData(null);
        }}
        title="Te pasas del techo de TC"
        description={
          capConfirmData && cardAvailable != null
            ? `Con este gasto superas tu techo de gasto propio en TC por ${formatCurrency(capConfirmData.originalAmount - cardAvailable)}. Si sigues así, tu ahorro del ciclo se ve afectado. ¿Guardar igual?`
            : ''
        }
        confirmText="Guardar igual"
        size="sm"
        onConfirm={() => {
          if (capConfirmData) submitTransaction(capConfirmData);
        }}
      />
      <div className="mx-auto w-full max-w-lg md:flex md:h-full md:flex-col">
        {/* Encabezado: tipo de movimiento y cerrar */}
        <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-3">
          <DrawerTitle className="sr-only">
            {isEditing ? 'Editar movimiento' : isTransferMode ? 'Nuevo traspaso' : 'Nuevo movimiento'}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            {isTransferMode ? 'Mueve dinero entre tus cuentas.' : 'Registra un ingreso o un gasto.'}
          </DrawerDescription>
          <div role="tablist" aria-label="Tipo de movimiento" className="flex gap-1 rounded-full bg-background p-1">
            {typeModes.map((mode) => {
              const active = activeMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() =>
                    isEditing ? form.setValue('type', mode as 'expense' | 'income', { shouldValidate: true }) : handleModeChange(mode)
                  }
                  className={cn(
                    'min-h-9 rounded-full px-3.5 text-[13px] transition-colors',
                    active ? cn('font-extrabold', MODE_ACTIVE[mode]) : 'font-bold text-muted-foreground hover:text-foreground'
                  )}
                >
                  {MODE_LABELS[mode]}
                </button>
              );
            })}
          </div>
          <DrawerClose asChild>
            <button
              type="button"
              aria-label="Cerrar"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[#CFC6D6] transition-colors hover:text-foreground"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </button>
          </DrawerClose>
        </div>

        {isTransferMode && !isEditing ? (
          <ScrollArea key="transfer" className="h-[72dvh] animate-fade-in md:flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block">
            <div className="space-y-[18px] px-4 pb-4 pt-2">
              <CurrencyInput
                value={transferAmount}
                onChange={setTransferAmount}
                currency={defaultCurrency}
                placeholder="0"
                size="hero"
                label="Monto"
                autoFocus
              />

              <AccountCardPicker
                label="¿Desde qué cuenta?"
                accounts={activeAccounts}
                value={transferFromAccountId}
                onChange={(id) => {
                  setTransferFromAccountId(id);
                  if (id === transferToAccountId) setTransferToAccountId('');
                }}
              />
              <AccountCardPicker
                label="¿Hacia cuál?"
                accounts={activeAccounts.filter((acc) => acc.id !== transferFromAccountId)}
                value={transferToAccountId}
                onChange={setTransferToAccountId}
              />

              {/* Plata de terceros: mueve saldos sin contar como ahorro ni ingreso tuyo */}
              <label
                className={cn(
                  'flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl pl-4 pr-3.5 transition-colors',
                  transferIsThirdParty ? 'bg-sky-soft' : 'border border-line bg-background'
                )}
              >
                <span className="flex-1">
                  <span className="block text-sm font-extrabold">Plata de otra persona</span>
                  <span className={cn('text-xs', transferIsThirdParty ? 'text-sky-text' : 'text-muted-foreground')}>
                    {transferIsThirdParty
                      ? 'mueve el saldo, pero no cuenta como ahorro ni ingreso tuyo'
                      : 'actívalo si es plata que te encargan (p. ej. ahorro de un familiar)'}
                  </span>
                </span>
                <Switch checked={transferIsThirdParty} onCheckedChange={setTransferIsThirdParty} aria-label="Plata de otra persona" />
              </label>

              {!showTransferAdvancedOptions ? (
                <div className="flex flex-wrap gap-1.5">
                  <DetailChip onClick={() => setShowTransferAdvancedOptions(true)}>{chipDate(transferDate)}</DetailChip>
                  <DetailChip dashed={!transferDescription} onClick={() => setShowTransferAdvancedOptions(true)}>
                    {transferDescription || '+ descripción, nota o meta'}
                  </DetailChip>
                </div>
              ) : (
                <div className="space-y-4 border-t border-surface-3 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-extrabold">Más detalles</span>
                    <button
                      type="button"
                      className="min-h-9 px-1 text-xs font-bold text-muted-foreground hover:text-foreground"
                      onClick={() => setShowTransferAdvancedOptions(false)}
                    >
                      Ocultar
                    </button>
                  </div>

                  {savingsGoals.length > 0 && (
                    <SavingsGoalSelector
                      savingsGoals={savingsGoals}
                      value={transferSavingsGoalId}
                      onValueChange={(value) => setTransferSavingsGoalId(value ?? undefined)}
                      label="Meta de ahorro (opcional)"
                      searchPlaceholder="Buscar meta..."
                      valid={!!transferSavingsGoalId}
                    />
                  )}

                  <FloatingLabelInput
                    label="Fecha"
                    type="date"
                    value={transferDate.toISOString().split('T')[0]}
                    onChange={(val) => setTransferDate(new Date(val + 'T12:00:00'))}
                    valid={!!transferDate}
                  />

                  <FloatingLabelInput
                    label="Descripción (opcional)"
                    value={transferDescription}
                    onChange={setTransferDescription}
                    placeholder="Ej: Ahorro mensual"
                    valid={!!transferDescription}
                  />

                  <FloatingLabelTextarea
                    label="Notas (opcional)"
                    value={transferNotes}
                    onChange={setTransferNotes}
                    placeholder="Notas adicionales..."
                    valid={!!transferNotes}
                  />
                </div>
              )}

              {error && <p className="text-sm text-coral-text">{error}</p>}

              <SubmitButton type="button" isPending={isPending} pendingText="Creando..." onClick={onSubmitTransfer}>
                Guardar traspaso
              </SubmitButton>
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea key="transaction" className="h-[72dvh] animate-fade-in md:flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block">
            <Form {...form}>
              <form id="transaction-form" onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-[18px] px-4 pb-4 pt-2">
            {/* Monto: protagonista */}
            <FormField
              control={form.control}
              name="originalAmount"
              render={({ field, fieldState }) => (
                <FormItem data-field="originalAmount">
                  <FormControl>
                    <CurrencyInput
                      value={field.value}
                      onChange={field.onChange}
                      currency={defaultCurrency}
                      placeholder="0"
                      size="hero"
                      label="Monto"
                      invalid={!!fieldState.error}
                      autoFocus={!isEditing}
                    />
                  </FormControl>
                  <FormMessage className="text-center" />
                </FormItem>
              )}
            />

            {/* Entity or Manual Description toggle - ocultar para cuentas previsionales */}
            {!isProvisionAccount && (
              entities.length > 0 && !useManualDescription ? (
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
                    Escribir la descripción
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
                          <DescriptionField
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            onPick={handlePickSuggestion}
                            suggestions={descriptionSuggestions}
                            type={watchedType}
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
                      Elegir tienda del listado
                    </Button>
                  )}
                </div>
              )
            )}

            {/* Cuenta: mini tarjetas */}
            <FormField
              control={form.control}
              name="accountId"
              render={({ field, fieldState }) => (
                <FormItem data-field="accountId">
                  <AccountCardPicker
                    label={isProvisionAccount ? '¿A qué cuenta va el aporte?' : watchedType === 'income' ? '¿A qué cuenta llega?' : '¿Con qué pagas?'}
                    accounts={activeAccounts}
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value);
                      // Limpiar saldo proveedor al cambiar cuenta
                      setProviderBalance(undefined);
                    }}
                    invalid={!!fieldState.error}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Naturaleza: separa lo propio de lo que se compensa */}
            {!isProvisionAccount && (
              <FormField
                control={form.control}
                name="nature"
                render={({ field }) => (
                  <FormItem data-field="nature">
                    <NatureSelector
                      type={watchedType}
                      value={normalizeNature(field.value, watchedType)}
                      onChange={(value) => {
                        natureTouched.current = true;
                        field.onChange(value);
                      }}
                    />
                    {isOwnCardExpense && cardImpact && (
                      <div className="pt-2">
                        <CapImpactNotice
                          data={cardImpact}
                          amount={watchedAmount || 0}
                          onNotMine={() => {
                            natureTouched.current = true;
                            field.onChange('external');
                          }}
                        />
                      </div>
                    )}
                  </FormItem>
                )}
              />
            )}

            {/* Pagar con un fondo de la cuenta */}
            {watchedType === 'expense' && accountFundsForSelected.length > 0 && (
              <FormField
                control={form.control}
                name="accountFundId"
                render={({ field }) => (
                  <FormItem data-field="accountFundId">
                    <p className="text-[13px] font-extrabold">¿Lo pagas con un fondo?</p>
                    <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Fondo">
                      {[{ id: null, name: 'Sin fondo', balance: null as number | null }, ...accountFundsForSelected].map((fund) => {
                        const selected = (field.value ?? null) === fund.id;
                        const previousAmount =
                          transaction && transaction.accountFundId === fund.id ? parseFloat(transaction.originalAmount) : 0;
                        const available = fund.balance != null ? fund.balance + previousAmount : null;
                        const after = available != null ? available - (watchedAmount || 0) : null;
                        const insufficient = after != null && after < 0;
                        const tone = fund.id ? TONE_CLASSES[toneForName(fund.name)] : TONE_CLASSES.jade;
                        return (
                          <button
                            key={fund.id ?? 'none'}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => field.onChange(fund.id)}
                            className={cn(
                              'min-h-[58px] rounded-2xl border px-3.5 py-2 text-left transition-colors',
                              selected ? 'border-amber bg-amber-soft' : 'border-line-strong hover:bg-surface-2'
                            )}
                          >
                            <span className="flex items-center justify-between gap-3">
                              <span className="flex min-w-0 items-center gap-2 text-sm font-bold">
                                <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', tone.bar)} />
                                <span className="truncate">{fund.name}</span>
                              </span>
                              {after != null && (
                                <span className={cn('num shrink-0 text-sm font-extrabold', insufficient && 'text-coral-text')}>
                                  {formatCurrency(selected ? after : available ?? 0)}
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {fund.id == null
                                ? 'sale de lo libre de la cuenta'
                                : insufficient && selected
                                  ? `no alcanza · tiene ${formatCurrency(available ?? 0)}`
                                  : selected
                                    ? `quedan después de este gasto · tenía ${formatCurrency(available ?? 0)}`
                                    : 'disponible en el fondo'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {watchedFundId && (
                      <p className="text-xs text-muted-foreground">
                        El gasto baja el saldo del fondo y no descuadra tu ciclo (esa plata ya estaba apartada).
                      </p>
                    )}
                  </FormItem>
                )}
              />
            )}

            {/* Pagado: siempre visible y prendido por defecto (casi todo se registra ya pagado) */}
            {!isProvisionAccount && (
              <FormField
                control={form.control}
                name="isPaid"
                render={({ field }) => (
                  <FormItem data-field="isPaid">
                    <label
                      className={cn(
                        'flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl pl-4 pr-3.5 transition-colors',
                        field.value ? 'bg-jade-soft' : 'border border-line bg-background'
                      )}
                    >
                      <span className="flex-1">
                        <span className="block text-sm font-extrabold">Pagado</span>
                        <span className={cn('text-xs', field.value ? 'text-jade-text' : 'text-muted-foreground')}>
                          {field.value
                            ? isCreditCardExpense
                              ? 'ya quedó cargado en la tarjeta'
                              : watchedType === 'income'
                                ? 'ya llegó a la cuenta'
                                : 'ya salió de la cuenta'
                            : 'queda pendiente: cuenta como comprometido'}
                        </span>
                      </span>
                      <FormControl>
                        <Switch checked={field.value ?? false} onCheckedChange={field.onChange} aria-label="Pagado" />
                      </FormControl>
                    </label>
                  </FormItem>
                )}
              />
            )}

            {/* Saldo proveedor - solo cuentas previsionales */}
            {isProvisionAccount && (
              <div className="space-y-2">
                <CurrencyInput
                  value={providerBalance}
                  onChange={setProviderBalance}
                  currency={defaultCurrency}
                  placeholder="0"
                  label="Saldo actual según proveedor"
                  valid={providerBalance !== undefined && providerBalance >= 0}
                />
                {profitabilityPreview !== null && (
                  <p className={cn(
                    'text-xs font-medium px-1',
                    profitabilityPreview > 0 ? 'text-jade' : 'text-coral'
                  )}>
                    Rentabilidad: {profitabilityPreview > 0 ? '+' : ''}
                    {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(profitabilityPreview)}
                  </p>
                )}
              </div>
            )}

            {/* Detalles: chips con lo elegido; al tocarlos se abre la sección completa */}
            {!showAdvancedOptions ? (
              <div className="flex flex-wrap gap-1.5">
                <DetailChip onClick={() => openDetail(budgets.length > 0 && !showManualCategory ? 'budgetId' : 'categoryId')}>
                  {categoryChipLabel}
                </DetailChip>
                <DetailChip onClick={() => openDetail('date')}>{chipDate(watchedDate)}</DetailChip>
                <DetailChip dashed={!extrasChipLabel} onClick={() => openDetail('notes')}>
                  {extrasChipLabel ?? (savingsGoals.length > 0 ? '+ nota o meta' : '+ nota')}
                </DetailChip>
              </div>
            ) : (
              <div className="space-y-4 border-t border-surface-3 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-extrabold">Más detalles</span>
                  {!isEditing && (
                    <button
                      type="button"
                      className="min-h-9 px-1 text-xs font-bold text-muted-foreground hover:text-foreground"
                      onClick={() => setShowAdvancedOptions(false)}
                    >
                      Ocultar
                    </button>
                  )}
                </div>

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
                                if (budgetId) {
                                  const selectedBudget = budgets.find((b) => b.id === budgetId);
                                  if (selectedBudget?.categoryId) {
                                    form.setValue('categoryId', selectedBudget.categoryId);
                                  }
                                  if (selectedBudget?.defaultAccountId) {
                                    form.setValue('accountId', selectedBudget.defaultAccountId);
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

                {/* Savings Goal */}
                {savingsGoals.length > 0 && (
                  <FormField
                    control={form.control}
                    name="savingsGoalId"
                    render={({ field, fieldState }) => (
                      <FormItem data-field="savingsGoalId">
                        <FormControl>
                          <SavingsGoalSelector
                            savingsGoals={savingsGoals}
                            value={field.value}
                            onValueChange={(value) => field.onChange(value)}
                            label="Meta de ahorro (opcional)"
                            searchPlaceholder="Buscar meta..."
                            valid={!!field.value}
                            invalid={!!fieldState.error}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Date */}
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field, fieldState }) => {
                    const hasValue = !!field.value;
                    const hasError = !!fieldState.error;
                    return (
                      <FormItem data-field="date">
                        <FormControl>
                          <div className="relative" data-vaul-no-drag>
                            <span
                              className={cn(
                                "absolute left-3 top-1.5 text-xs flex items-center gap-1 pointer-events-none",
                                hasError ? "text-destructive" : "text-muted-foreground"
                              )}
                            >
                              Fecha
                              {hasError && !hasValue && <XCircle className="h-3.5 w-3.5" />}
                            </span>
                            <Input
                              type="date"
                              data-vaul-no-drag
                              {...field}
                              value={field.value instanceof Date && !isNaN(field.value.getTime())
                                ? field.value.toISOString().split('T')[0]
                                : typeof field.value === 'string'
                                  ? String(field.value).split('T')[0]
                                  : ''}
                              onClick={(e) => {
                                try {
                                  (e.currentTarget as HTMLInputElement).showPicker();
                                } catch {
                                  // Some browsers may throw if picker is already open
                                }
                              }}
                              onChange={(e) => {
                                if (e.target.value) {
                                  field.onChange(new Date(e.target.value + 'T12:00:00'));
                                }
                              }}
                              className={cn(
                                "h-14 pt-5 pb-1",
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

                {/* Notes */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field, fieldState }) => (
                    <FormItem data-field="notes">
                      <FormControl>
                        <FloatingLabelTextarea
                          label="Notas (opcional)"
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

              </div>
            )}

              {error && <p className="text-sm text-coral-text">{error}</p>}

              <SubmitButton isPending={isPending} pendingText="Guardando...">
                {isEditing
                  ? 'Guardar cambios'
                  : capOver
                    ? 'Guardar igual'
                    : watchedType === 'income'
                      ? 'Guardar ingreso'
                      : 'Guardar gasto'}
              </SubmitButton>
              </form>
            </Form>
          </ScrollArea>
        )}
      </div>
    </DrawerContent>
  );
}

const MODE_LABELS: Record<FormMode, string> = { expense: 'Gasto', income: 'Ingreso', transfer: 'Traspaso' };
const MODE_ACTIVE: Record<FormMode, string> = {
  expense: 'bg-coral text-coral-ink',
  income: 'bg-jade text-jade-ink',
  transfer: 'bg-sky text-sky-ink',
};

/** "Hoy, 12 oct", "Ayer, 11 oct" o "9 oct". */
function chipDate(value: Date | string | undefined): string {
  const d = value ? new Date(value) : new Date();
  if (isNaN(d.getTime())) return 'Fecha';
  const label = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(d).replace('.', '');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `Hoy, ${label}`;
  if (d.toDateString() === yesterday.toDateString()) return `Ayer, ${label}`;
  return label;
}

function DetailChip({ children, dashed, onClick }: { children: React.ReactNode; dashed?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-10 max-w-full truncate rounded-full px-3.5 text-xs font-bold transition-colors',
        dashed
          ? 'border border-dashed border-line-strong text-muted-foreground hover:text-foreground'
          : 'bg-surface-2 text-[#CFC6D6] hover:bg-surface-3'
      )}
    >
      {children}
    </button>
  );
}
