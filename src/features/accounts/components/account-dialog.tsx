'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Building2, PiggyBank, Wallet, CreditCard, AlertTriangle, Check, ArrowRight, Settings } from 'lucide-react';

import { useFormValidation, useSuccessAnimation } from '@/hooks';
import { SubmitButton } from '@/components/submit-button';
import { FloatingLabelInput } from '@/components/floating-label-input';
import { FormDrawer, FormDrawerBody, FormDrawerFooter } from '@/components/form-drawer';
import { ProgressIndicator } from '@/components/progress-indicator';
import { cn } from '@/lib/utils';
import { CurrencyInput } from '@/components/currency-input';
import { SearchableSelect, type SearchableSelectOption } from '@/components/searchable-select';
import { EntitySelector } from '@/components/entity-selector';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { SwitchCard } from '@/components/switch-card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { formatCurrency } from '@/lib/formatting';
import { createAccount, updateAccount, adjustAccountBalance } from '../actions';
import { createAccountSchema, type CreateAccountInput } from '../schemas';
import type { AccountWithEntity, AccountType } from '../types';
import type { Entity } from '@/features/entities/types';

interface AccountDialogContentProps {
  userId: string;
  account: AccountWithEntity | null;
  currencies: { id: string; code: string; name: string }[];
  entities: Entity[];
  onSuccess: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

export function AccountDialogContent({
  userId,
  account,
  currencies,
  entities,
  onSuccess,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: AccountDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adjustBalance, setAdjustBalance] = useState(false);
  const [newBalance, setNewBalance] = useState<number>(0);
  const [showCurrencySelector, setShowCurrencySelector] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Form UX hooks
  const { onInvalid } = useFormValidation();
  const { showSuccess, triggerSuccess } = useSuccessAnimation({ onComplete: onSuccess });

  const isEditing = !!account;

  const getDefaultValues = useCallback(() => {
    if (account) {
      return {
        name: account.name,
        type: account.type as AccountType,
        bankName: account.bankName ?? '',
        entityId: account.entityId ?? undefined,
        currency: account.currency,
        initialBalance: parseFloat(account.initialBalance),
        creditLimit: account.creditLimit ? parseFloat(account.creditLimit) : undefined,
        isDefault: account.isDefault,
      };
    }
    return {
      name: '',
      type: 'checking' as AccountType,
      bankName: '',
      entityId: undefined as string | undefined,
      currency: 'CLP',
      initialBalance: 0,
      creditLimit: undefined as number | undefined,
      isDefault: false,
    };
  }, [account]);

  const form = useForm<CreateAccountInput>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: getDefaultValues(),
  });

  useEffect(() => {
    form.reset(getDefaultValues());
    setAdjustBalance(false);
    if (account) {
      setNewBalance(parseFloat(account.currentBalance));
      setShowCurrencySelector(account.currency !== 'CLP');
    } else {
      setShowCurrencySelector(false);
    }
  }, [account, form, getDefaultValues]);

  const onSubmit = (data: CreateAccountInput) => {
    setError(null);
    const toastId = toast.loading(isEditing ? 'Actualizando cuenta...' : 'Creando cuenta...');
    onMutationStart?.();

    startTransition(async () => {
      const result = isEditing
        ? await updateAccount(account.id, userId, {
            name: data.name,
            type: data.type,
            bankName: data.bankName || null,
            entityId: data.entityId || null,
            initialBalance: data.initialBalance,
            creditLimit: data.type === 'credit_card' ? data.creditLimit : null,
            isDefault: data.isDefault,
          })
        : await createAccount(userId, data);

      if (result.success) {
        if (isEditing && adjustBalance) {
          const balanceResult = await adjustAccountBalance(account.id, userId, newBalance);
          if (!balanceResult.success) {
            setError(balanceResult.error);
            onMutationError?.(toastId, balanceResult.error);
            return;
          }
        }

        form.reset();
        setAdjustBalance(false);
        onMutationSuccess?.(toastId, isEditing ? 'Cuenta actualizada' : 'Cuenta creada');
        triggerSuccess();
      } else {
        setError(result.error);
        onMutationError?.(toastId, result.error);
      }
    });
  };

  // Watch fields for conditional rendering
  const watchType = form.watch('type');
  const watchCurrency = form.watch('currency');

  // Track form progress with subscription pattern
  const calculateProgress = useCallback((values: Partial<CreateAccountInput>) => {
    return [
      !!values.type,
      !!values.name,
      values.initialBalance !== undefined,
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

  // Account type options with icons
  const accountTypeOptions: SearchableSelectOption[] = [
    {
      id: 'checking',
      label: 'Cuenta Corriente',
      icon: <Building2 className="h-4 w-4 text-muted-foreground" />,
    },
    {
      id: 'savings',
      label: 'Cuenta de Ahorro',
      icon: <PiggyBank className="h-4 w-4 text-muted-foreground" />,
    },
    {
      id: 'cash',
      label: 'Efectivo',
      icon: <Wallet className="h-4 w-4 text-muted-foreground" />,
    },
    {
      id: 'credit_card',
      label: 'Tarjeta de Crédito',
      icon: <CreditCard className="h-4 w-4 text-muted-foreground" />,
    },
  ];

  return (
    <FormDrawer
      title={isEditing ? 'Editar cuenta' : 'Nueva cuenta'}
      description={
        isEditing
          ? 'Modifica los detalles de la cuenta.'
          : 'Agrega una cuenta bancaria, efectivo o tarjeta de crédito.'
      }
      showSuccess={showSuccess}
      headerExtra={!isEditing ? <ProgressIndicator current={formProgress} /> : undefined}
    >
      <Form {...form}>
        <FormDrawerBody as="form" onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
          {/* Type */}
          <FormField
            control={form.control}
            name="type"
            render={({ field, fieldState }) => (
              <FormItem data-field="type">
                <FormControl>
                  <SearchableSelect
                    options={accountTypeOptions}
                    value={field.value}
                    onValueChange={(value) => field.onChange(value ?? 'checking')}
                    label="Tipo de cuenta"
                    searchPlaceholder="Buscar tipo..."
                    emptyMessage="No se encontraron tipos."
                    valid={!!field.value}
                    invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <FormItem data-field="name">
                <FormControl>
                  <FloatingLabelInput
                    label="Nombre"
                    placeholder="Ej: Cuenta Corriente BCI"
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

          {/* Entity (Bank/Credit Card) */}
          {watchType !== 'cash' && (
            <FormField
              control={form.control}
              name="entityId"
              render={({ field, fieldState }) => (
                <FormItem data-field="entityId">
                  <FormControl>
                    <EntitySelector
                      entities={entities}
                      value={field.value}
                      onValueChange={(value) => field.onChange(value ?? undefined)}
                      label="Banco / Tarjeta (opcional)"
                      searchPlaceholder="Buscar institución..."
                      filterByType={['bank', 'credit_card']}
                      allowNone
                      noneLabel="Sin institución"
                      valid={!!field.value}
                      invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Initial Balance */}
          <FormField
            control={form.control}
            name="initialBalance"
            render={({ field, fieldState }) => (
              <FormItem data-field="initialBalance">
                <FormControl>
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    currency={watchCurrency ?? 'CLP'}
                    placeholder="0"
                    size="lg"
                    label={watchType === 'credit_card' ? 'Deuda actual' : 'Saldo inicial'}
                    valid={field.value !== undefined && !fieldState.error}
                    invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormDescription>
                  {watchType === 'credit_card'
                    ? 'Cuánto debes actualmente en esta tarjeta'
                    : 'Cuánto tienes actualmente en esta cuenta'}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Credit Limit - Only for credit cards */}
          {watchType === 'credit_card' && (
            <FormField
              control={form.control}
              name="creditLimit"
              render={({ field, fieldState }) => (
                <FormItem data-field="creditLimit">
                  <FormControl>
                    <CurrencyInput
                      value={field.value ?? undefined}
                      onChange={field.onChange}
                      currency={watchCurrency ?? 'CLP'}
                      placeholder="0"
                      label="Cupo total"
                      valid={field.value != null && field.value > 0 && !fieldState.error}
                      invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormDescription>
                    El límite de crédito de tu tarjeta (cupo disponible = cupo total - deuda)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Advanced Options Toggle */}
          {!showAdvancedOptions && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-auto p-0"
              onClick={() => setShowAdvancedOptions(true)}
            >
              <Settings className="mr-1.5 h-3 w-3" />
              Otras opciones
            </Button>
          )}

          {/* Advanced Options */}
          {showAdvancedOptions && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Otras opciones</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-auto p-0"
                  onClick={() => setShowAdvancedOptions(false)}
                >
                  Ocultar
                </Button>
              </div>

              {/* Is Default */}
              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem data-field="isDefault">
                    <FormControl>
                      <SwitchCard
                        title="Cuenta principal"
                        description="Se usará como cuenta predeterminada para nuevas transacciones"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Currency Selector */}
              <div className="space-y-3">
                <SwitchCard
                  title="Moneda diferente"
                  description="Por defecto se usa CLP"
                  checked={showCurrencySelector}
                  onCheckedChange={(checked) => {
                    setShowCurrencySelector(checked);
                    if (!checked) {
                      form.setValue('currency', 'CLP');
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
                            onValueChange={(value) => field.onChange(value ?? 'CLP')}
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

              {/* Balance Adjustment - Only when editing */}
              {isEditing && (
                <div className="space-y-3">
                  <SwitchCard
                    title="Ajustar saldo actual"
                    description="Corrige el saldo manualmente (reconciliación)"
                    checked={adjustBalance}
                    onCheckedChange={(checked) => {
                      setAdjustBalance(checked);
                      if (checked && account) {
                        setNewBalance(parseFloat(account.currentBalance));
                      }
                    }}
                  />

                  {adjustBalance && (
                    <div className="space-y-3">
                      <Alert
                        variant="destructive"
                        className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          <strong>Usar con precaución.</strong> Esta opción modifica el saldo
                          actual de la cuenta sin crear una transacción. Solo usar para corregir
                          discrepancias o reconciliar con tu banco.
                        </AlertDescription>
                      </Alert>

                      <div className="space-y-2">
                        <CurrencyInput
                          value={newBalance}
                          onChange={(value) => setNewBalance(value ?? 0)}
                          currency={watchCurrency ?? 'CLP'}
                          placeholder="0"
                          size="lg"
                          label={watchType === 'credit_card' ? 'Nueva deuda' : 'Nuevo saldo'}
                          valid={newBalance !== undefined}
                        />
                        <p className="text-[0.8rem] text-muted-foreground">
                          Saldo actual: {formatCurrency(account?.currentBalance ?? 0)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <FormDrawerFooter>
            <SubmitButton
              isPending={isPending}
              pendingText="Guardando..."
              icon={isEditing ? <Check className="size-7" /> : <ArrowRight className="size-7" />}
            >
              {isEditing ? 'Guardar cambios' : 'Crear cuenta'}
            </SubmitButton>
          </FormDrawerFooter>
        </FormDrawerBody>
      </Form>
    </FormDrawer>
  );
}
