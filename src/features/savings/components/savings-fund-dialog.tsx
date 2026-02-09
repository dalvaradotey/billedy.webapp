'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Check, ArrowRight, Settings } from 'lucide-react';

import { useFormValidation, useSuccessAnimation } from '@/hooks';
import { SubmitButton } from '@/components/submit-button';
import { FloatingLabelInput } from '@/components/floating-label-input';
import { FormDrawer, FormDrawerBody, FormDrawerFooter } from '@/components/form-drawer';
import { ProgressIndicator } from '@/components/progress-indicator';
import { CurrencyInput } from '@/components/currency-input';
import { SearchableSelect } from '@/components/searchable-select';
import { SwitchCard } from '@/components/switch-card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';

import { createSavingsFund, updateSavingsFund } from '../actions';
import { createSavingsFundSchema, type CreateSavingsFundInput } from '../schemas';
import type { SavingsFundWithProgress } from '../types';
import { ACCOUNT_TYPE_OPTIONS } from './constants';

interface SavingsFundDialogContentProps {
  projectId?: string;
  userId: string;
  currencies: { id: string; code: string }[];
  defaultCurrencyId: string;
  fund: SavingsFundWithProgress | null;
  onSuccess: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

export function SavingsFundDialogContent({
  projectId,
  userId,
  currencies,
  defaultCurrencyId,
  fund,
  onSuccess,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: SavingsFundDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState(
    fund?.currencyId ?? defaultCurrencyId
  );
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Form UX hooks
  const { onInvalid } = useFormValidation();
  const { showSuccess, triggerSuccess } = useSuccessAnimation({ onComplete: onSuccess });

  const selectedCurrencyCode = currencies.find((c) => c.id === selectedCurrencyId)?.code ?? 'CLP';

  const isEditing = !!fund;

  const form = useForm<CreateSavingsFundInput>({
    resolver: zodResolver(createSavingsFundSchema),
    defaultValues: {
      projectId: fund?.projectId ?? projectId ?? undefined,
      name: fund?.name ?? '',
      type: fund?.type ?? 'goal',
      accountType: fund?.accountType ?? 'Cuenta de ahorro',
      currencyId: fund?.currencyId ?? defaultCurrencyId,
      targetAmount: fund?.targetAmount ? parseFloat(fund.targetAmount) : undefined,
      monthlyTarget: fund ? parseFloat(fund.monthlyTarget) : undefined,
      currentBalance: isEditing ? undefined : 0,
    },
  });

  // Track form progress with subscription pattern
  const calculateProgress = useCallback((values: Partial<CreateSavingsFundInput>) => {
    return [
      !!values.name,
      values.monthlyTarget !== undefined && values.monthlyTarget > 0,
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

  const onSubmit = (data: CreateSavingsFundInput) => {
    setError(null);
    const toastId = toast.loading(isEditing ? 'Actualizando fondo...' : 'Creando fondo...');
    onMutationStart?.();

    startTransition(async () => {
      const result = isEditing
        ? await updateSavingsFund(fund.id, userId, {
            name: data.name,
            type: data.type,
            accountType: data.accountType,
            targetAmount: data.targetAmount,
            monthlyTarget: data.monthlyTarget,
          })
        : await createSavingsFund(userId, selectedCurrencyId, data);

      if (result.success) {
        form.reset();
        onMutationSuccess?.(toastId, isEditing ? 'Fondo actualizado' : 'Fondo creado');
        triggerSuccess();
      } else {
        setError(result.error);
        onMutationError?.(toastId, result.error);
      }
    });
  };

  // Fund type options
  const fundTypeOptions = [
    { id: 'emergency', label: 'Emergencia' },
    { id: 'investment', label: 'Inversión' },
    { id: 'goal', label: 'Meta específica' },
    { id: 'other', label: 'Otro' },
  ];

  // Account type options
  const accountTypeOptions = ACCOUNT_TYPE_OPTIONS.map((type) => ({
    id: type,
    label: type,
  }));

  // Currency options
  const currencyOptions = currencies.map((c) => ({
    id: c.id,
    label: c.code,
  }));

  return (
    <FormDrawer
      title={isEditing ? 'Editar fondo' : 'Nuevo fondo de ahorro'}
      description={
        isEditing
          ? 'Modifica los detalles del fondo de ahorro.'
          : 'Crea un nuevo fondo para organizar tus ahorros.'
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
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Ej: Fondo de emergencia"
                    valid={fieldState.isDirty && !fieldState.invalid}
                    invalid={fieldState.invalid}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Type and Account Type */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field, fieldState }) => (
                <FormItem data-field="type">
                  <FormControl>
                    <SearchableSelect
                      options={fundTypeOptions}
                      value={field.value}
                      onValueChange={(value) => field.onChange(value ?? 'goal')}
                      label="Tipo de fondo"
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

            <FormField
              control={form.control}
              name="accountType"
              render={({ field, fieldState }) => (
                <FormItem data-field="accountType">
                  <FormControl>
                    <SearchableSelect
                      options={accountTypeOptions}
                      value={field.value}
                      onValueChange={(value) => field.onChange(value ?? 'Cuenta de ahorro')}
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
          </div>

          {/* Monthly Target */}
          <FormField
            control={form.control}
            name="monthlyTarget"
            render={({ field, fieldState }) => (
              <FormItem data-field="monthlyTarget">
                <FormControl>
                  <CurrencyInput
                    size="lg"
                    label="Meta mensual"
                    value={field.value}
                    onChange={field.onChange}
                    currency={selectedCurrencyCode}
                    placeholder="0"
                    valid={fieldState.isDirty && !fieldState.invalid && field.value != null && field.value > 0}
                    invalid={fieldState.invalid}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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

              {/* Target Amount */}
              <FormField
                control={form.control}
                name="targetAmount"
                render={({ field, fieldState }) => (
                  <FormItem data-field="targetAmount">
                    <FormControl>
                      <CurrencyInput
                        size="lg"
                        label="Meta total (opcional)"
                        value={field.value ?? undefined}
                        onChange={field.onChange}
                        currency={selectedCurrencyCode}
                        placeholder="0"
                        valid={fieldState.isDirty && !fieldState.invalid && field.value != null && field.value > 0}
                        invalid={fieldState.invalid}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Initial Balance - Only when creating */}
              {!isEditing && (
                <FormField
                  control={form.control}
                  name="currentBalance"
                  render={({ field, fieldState }) => (
                    <FormItem data-field="currentBalance">
                      <FormControl>
                        <CurrencyInput
                          size="lg"
                          label="Balance inicial (opcional)"
                          value={field.value}
                          onChange={(value) => field.onChange(value ?? 0)}
                          currency={selectedCurrencyCode}
                          placeholder="0"
                          valid={fieldState.isDirty && !fieldState.invalid && field.value != null && field.value > 0}
                          invalid={fieldState.invalid}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Currency Selector - Only when creating and multiple currencies */}
              {!isEditing && currencies.length > 1 && (
                <div className="space-y-3">
                  <SwitchCard
                    title="Moneda diferente"
                    description={`Por defecto se usa ${currencies.find((c) => c.id === defaultCurrencyId)?.code ?? 'CLP'}`}
                    checked={selectedCurrencyId !== defaultCurrencyId}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        // Select first non-default currency
                        const otherCurrency = currencies.find((c) => c.id !== defaultCurrencyId);
                        if (otherCurrency) {
                          setSelectedCurrencyId(otherCurrency.id);
                        }
                      } else {
                        setSelectedCurrencyId(defaultCurrencyId);
                      }
                    }}
                  />

                  {selectedCurrencyId !== defaultCurrencyId && (
                    <SearchableSelect
                      options={currencyOptions}
                      value={selectedCurrencyId}
                      onValueChange={(value) => setSelectedCurrencyId(value ?? defaultCurrencyId)}
                      label="Moneda"
                      searchPlaceholder="Buscar moneda..."
                      emptyMessage="No se encontraron monedas."
                      valid={!!selectedCurrencyId}
                    />
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
              {isEditing ? 'Guardar cambios' : 'Crear fondo'}
            </SubmitButton>
          </FormDrawerFooter>
        </FormDrawerBody>
      </Form>
    </FormDrawer>
  );
}
