'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Check, ArrowRight, Settings } from 'lucide-react';

import { useFormValidation, useSuccessAnimation } from '@/hooks';
import { SubmitButton } from '@/components/submit-button';
import { FloatingLabelInput } from '@/components/floating-label-input';
import { FloatingLabelDateInput } from '@/components/floating-label-date-input';
import { FloatingLabelTextarea } from '@/components/floating-label-textarea';
import { FormDrawer, FormDrawerBody, FormDrawerFooter } from '@/components/form-drawer';
import { ProgressIndicator } from '@/components/progress-indicator';
import { CurrencyInput } from '@/components/currency-input';
import { InstallmentSelector } from '@/components/installment-selector';
import { CategorySelector } from '@/components/category-selector';
import { EntitySelector } from '@/components/entity-selector';
import { AccountSelector } from '@/components/account-selector';
import { SearchableSelect, type SearchableSelectOption } from '@/components/searchable-select';
// SearchableSelect is used for frequency selector
import { Button } from '@/components/ui/button';
import type { Entity } from '@/features/entities/types';
import type { AccountWithEntity } from '@/features/accounts/types';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';

import { formatCurrency } from '@/lib/formatting';
import { createCredit, updateCredit } from '../actions';
import { createCreditSchema, type CreateCreditInput } from '../schemas';
import type { CreditWithProgress } from '../types';
import { calculatePaidInstallments } from './utils';

interface CreditDialogContentProps {
  projectId: string;
  userId: string;
  categories: { id: string; name: string; color: string }[];
  entities: Entity[];
  accounts: AccountWithEntity[];
  credit: CreditWithProgress | null;
  onSuccess: () => void;
  onMutationStart?: (toastId: string | number) => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

export function CreditDialogContent({
  projectId,
  userId,
  categories,
  entities,
  accounts,
  credit,
  onSuccess,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: CreditDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [localCategories, setLocalCategories] = useState<
    { id: string; name: string; color: string }[]
  >(categories.map((c) => ({ id: c.id, name: c.name, color: c.color })));

  // Form UX hooks
  const { onInvalid } = useFormValidation();
  const { showSuccess, triggerSuccess } = useSuccessAnimation({ onComplete: onSuccess });

  const isEditing = !!credit;

  const defaultAccountId =
    accounts.find((a) => a.type !== 'credit_card')?.id ?? accounts[0]?.id ?? '';

  const form = useForm<CreateCreditInput>({
    resolver: zodResolver(createCreditSchema),
    defaultValues: {
      projectId,
      categoryId: credit?.categoryId ?? '',
      entityId: credit?.entityId ?? undefined,
      accountId: credit?.accountId ?? defaultAccountId,
      name: credit?.name ?? '',
      principalAmount: credit ? parseFloat(credit.basePrincipalAmount) : undefined,
      installmentAmount: credit ? parseFloat(credit.installmentAmount) : undefined,
      installments: credit?.installments ?? 12,
      paidInstallments: 0,
      startDate: credit?.startDate ?? new Date(),
      frequency: credit?.frequency ?? 'monthly',
      description: credit?.description ?? '',
      notes: credit?.notes ?? '',
    },
  });

  const watchedStartDate = useWatch({ control: form.control, name: 'startDate' });
  const watchedFrequency = useWatch({ control: form.control, name: 'frequency' });
  const watchedInstallments = useWatch({ control: form.control, name: 'installments' });
  const watchedPrincipal = useWatch({ control: form.control, name: 'principalAmount' });
  const watchedInstallmentAmount = useWatch({
    control: form.control,
    name: 'installmentAmount',
  });

  const calculatedTotal = (watchedInstallmentAmount ?? 0) * (watchedInstallments ?? 0);
  const calculatedInterest = calculatedTotal - (watchedPrincipal ?? 0);

  const calculatedPaidInstallments = calculatePaidInstallments(
    watchedStartDate,
    watchedFrequency,
    watchedInstallments
  );

  useEffect(() => {
    if (!isEditing) {
      form.setValue('paidInstallments', calculatedPaidInstallments);
    }
  }, [calculatedPaidInstallments, form, isEditing]);

  // Track form progress
  const calculateProgress = useCallback((values: Partial<CreateCreditInput>) => {
    if (isEditing) {
      return [!!values.name].filter(Boolean).length;
    }
    return [
      !!values.name,
      !!values.categoryId,
      values.principalAmount != null && values.principalAmount > 0,
      values.installmentAmount != null && values.installmentAmount > 0,
    ].filter(Boolean).length;
  }, [isEditing]);

  const [formProgress, setFormProgress] = useState(() => calculateProgress(form.getValues()));

  useEffect(() => {
    setFormProgress(calculateProgress(form.getValues()));

    const subscription = form.watch((values) => {
      setFormProgress(calculateProgress(values));
    });
    return () => subscription.unsubscribe();
  }, [form, calculateProgress]);

  const onSubmit = (data: CreateCreditInput) => {
    setError(null);
    const toastId = toast.loading(
      isEditing ? 'Actualizando crédito...' : 'Creando crédito...'
    );
    onMutationStart?.(toastId);

    startTransition(async () => {
      const result = isEditing
        ? await updateCredit(credit.id, userId, {
            name: data.name,
            description: data.description,
            notes: data.notes,
          })
        : await createCredit(userId, data);

      if (result.success) {
        form.reset();
        onMutationSuccess?.(toastId, isEditing ? 'Crédito actualizado' : 'Crédito creado');
        triggerSuccess();
      } else {
        setError(result.error);
        onMutationError?.(toastId, result.error);
      }
    });
  };

  return (
    <FormDrawer
      title={isEditing ? 'Editar crédito' : 'Nuevo crédito'}
      description={isEditing ? 'Modifica los detalles del crédito.' : 'Registra un nuevo crédito o préstamo.'}
      showSuccess={showSuccess}
      headerExtra={<ProgressIndicator current={formProgress} total={isEditing ? 1 : 4} />}
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
                    placeholder="Ej: Crédito de consumo"
                    valid={!!field.value && !fieldState.error}
                    invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Category & Entity */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field, fieldState }) => (
                <FormItem data-field="categoryId">
                  <FormControl>
                    <CategorySelector
                      label="Categoría"
                      categories={localCategories}
                      value={field.value}
                      onValueChange={field.onChange}
                      onCategoryCreated={(cat) =>
                        setLocalCategories((prev) => [
                          ...prev,
                          { id: cat.id, name: cat.name, color: cat.color },
                        ])
                      }
                      projectId={projectId}
                      userId={userId}
                      disabled={isEditing}
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
              name="entityId"
              render={({ field, fieldState }) => (
                <FormItem data-field="entityId">
                  <FormControl>
                    <EntitySelector
                      label="Tienda"
                      entities={entities}
                      value={field.value ?? undefined}
                      onValueChange={(val) => field.onChange(val ?? null)}
                      disabled={isEditing}
                      valid={!!field.value && !fieldState.error}
                      invalid={!!fieldState.error}
                      allowNone
                      noneLabel="Sin tienda"
                      searchPlaceholder="Buscar tienda..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Account selector */}
          <FormField
            control={form.control}
            name="accountId"
            render={({ field, fieldState }) => (
              <FormItem data-field="accountId">
                <FormControl>
                  <AccountSelector
                    accounts={accounts}
                    value={field.value}
                    onValueChange={(value) => field.onChange(value ?? '')}
                    label="Cuenta de cargo"
                    searchPlaceholder="Buscar cuenta..."
                    valid={!!field.value}
                    invalid={!!fieldState.error}
                    disabled={isEditing}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {!isEditing && (
            <>
              {/* Principal Amount */}
              <FormField
                control={form.control}
                name="principalAmount"
                render={({ field, fieldState }) => (
                  <FormItem data-field="principalAmount">
                    <FormControl>
                      <CurrencyInput
                        size="lg"
                        label="Monto capital"
                        value={field.value ?? undefined}
                        onChange={field.onChange}
                        placeholder="0"
                        valid={field.value != null && field.value > 0 && !fieldState.error}
                        invalid={!!fieldState.error}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Installment Amount */}
              <FormField
                control={form.control}
                name="installmentAmount"
                render={({ field, fieldState }) => (
                  <FormItem data-field="installmentAmount">
                    <FormControl>
                      <CurrencyInput
                        size="lg"
                        label="Valor de la cuota"
                        value={field.value ?? undefined}
                        onChange={field.onChange}
                        placeholder="0"
                        valid={field.value != null && field.value > 0 && !fieldState.error}
                        invalid={!!fieldState.error}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Installments & Frequency */}
              <div className="grid grid-cols-2 gap-2 sm:gap-4 items-end">
                <FormField
                  control={form.control}
                  name="installments"
                  render={({ field, fieldState }) => (
                    <FormItem data-field="installments">
                      <FormControl>
                        <InstallmentSelector
                          label="N° de cuotas"
                          value={field.value}
                          onChange={field.onChange}
                          min={1}
                          max={60}
                          valid={field.value != null && field.value > 0 && !fieldState.error}
                          invalid={!!fieldState.error}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field, fieldState }) => {
                    const frequencyOptions: SearchableSelectOption[] = [
                      { id: 'monthly', label: 'Mensual' },
                      { id: 'biweekly', label: 'Quincenal' },
                      { id: 'weekly', label: 'Semanal' },
                    ];

                    return (
                      <FormItem data-field="frequency">
                        <FormControl>
                          <SearchableSelect
                            options={frequencyOptions}
                            value={field.value}
                            onValueChange={(value) => field.onChange(value ?? 'monthly')}
                            label="Frecuencia"
                            searchPlaceholder="Buscar..."
                            emptyMessage="No encontrado."
                            valid={!!field.value}
                            invalid={!!fieldState.error}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              {/* Calculated totals */}
              {watchedPrincipal && watchedInstallmentAmount && watchedInstallments && (
                <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total a pagar:</span>
                      <span className="font-medium">{formatCurrency(calculatedTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Intereses:</span>
                      <span
                        className={`font-medium ${calculatedInterest > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}
                      >
                        {formatCurrency(calculatedInterest)}
                      </span>
                    </div>
                  </div>
                  {calculatedInterest > 0 && watchedPrincipal > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Pagarás {((calculatedInterest / watchedPrincipal) * 100).toFixed(1)}%
                      adicional en intereses
                    </p>
                  )}
                </div>
              )}

              {/* Start Date */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field, fieldState }) => (
                  <FormItem data-field="startDate">
                    <FormControl>
                      <FloatingLabelDateInput
                        label="Fecha 1ra cuota"
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

              {/* Paid Installments - Calculated */}
              {watchedStartDate && watchedFrequency && watchedInstallments && (
                <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Cuotas ya pagadas</span>
                    <span className="text-lg font-bold">{calculatedPaidInstallments}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Basado en la fecha de inicio, se registrarán {calculatedPaidInstallments} cuotas como pagadas.
                  </p>
                </div>
              )}
            </>
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

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field, fieldState }) => (
                  <FormItem data-field="description">
                    <FormControl>
                      <FloatingLabelTextarea
                        label="Descripción (opcional)"
                        placeholder="Detalles adicionales del crédito..."
                        value={field.value ?? ''}
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <FormDrawerFooter>
            <SubmitButton
              isPending={isPending}
              pendingText="Guardando..."
              icon={isEditing ? <Check className="size-7" /> : <ArrowRight className="size-7" />}
            >
              {isEditing ? 'Guardar cambios' : 'Crear crédito'}
            </SubmitButton>
          </FormDrawerFooter>
        </FormDrawerBody>
      </Form>
    </FormDrawer>
  );
}
