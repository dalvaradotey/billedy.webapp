'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, ArrowRight, Settings, Pencil, Store } from 'lucide-react';

import { useFormValidation, useSuccessAnimation } from '@/hooks';
import { SubmitButton } from '@/components/submit-button';
import { FloatingLabelInput } from '@/components/floating-label-input';
import { FloatingLabelDateInput } from '@/components/floating-label-date-input';
import { FloatingLabelTextarea } from '@/components/floating-label-textarea';
import { FormDrawer, FormDrawerBody, FormDrawerFooter } from '@/components/form-drawer';
import { ProgressIndicator } from '@/components/progress-indicator';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ResponsiveDrawer,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { CurrencyInput } from '@/components/currency-input';
import { InstallmentSelector } from '@/components/installment-selector';
import { Separator } from '@/components/ui/separator';
import { SwitchCard } from '@/components/switch-card';
import { EntitySelector } from '@/components/entity-selector';
import { CategorySelector } from '@/components/category-selector';
import { AccountSelector } from '@/components/account-selector';

import { formatCurrency } from '@/lib/formatting';
import { createCardPurchaseSchema, type CreateCardPurchaseInput } from '../schemas';
import { createCardPurchase } from '../actions';
import type { AccountWithEntity } from '@/features/accounts/types';
import type { Category } from '@/features/categories/types';
import type { Entity } from '@/features/entities/types';

/**
 * Calcula cuántas cuotas están vencidas basándose en la fecha de primer cobro
 * y la fecha actual (solo cuenta cuotas cuya fecha ya pasó)
 */
function calculateChargedInstallments(
  firstChargeDate: Date | undefined,
  totalInstallments: number | undefined
): number {
  if (!firstChargeDate || !totalInstallments) return 0;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(firstChargeDate);

  if (start >= today) return 0;

  let paidCount = 0;
  for (let i = 0; i < totalInstallments; i++) {
    const chargeDate = new Date(start);
    chargeDate.setMonth(chargeDate.getMonth() + i);

    if (chargeDate < today) {
      paidCount++;
    } else {
      break;
    }
  }

  return paidCount;
}

interface CreatePurchaseDialogProps {
  projectId: string;
  userId: string;
  accounts: AccountWithEntity[];
  categories: Category[];
  entities: Entity[];
  onSuccess: () => void;
}

export function CreatePurchaseDialog({
  projectId,
  userId,
  accounts,
  categories,
  entities,
  onSuccess,
}: CreatePurchaseDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showManualStore, setShowManualStore] = useState(false);
  const [localCategories, setLocalCategories] = useState<{ id: string; name: string; color: string }[]>(
    categories.map((c) => ({ id: c.id, name: c.name, color: c.color }))
  );

  // Form UX hooks
  const { onInvalid } = useFormValidation();
  const { showSuccess, triggerSuccess } = useSuccessAnimation({
    onComplete: () => {
      setOpen(false);
      onSuccess();
    },
  });

  const form = useForm({
    resolver: zodResolver(createCardPurchaseSchema),
    defaultValues: {
      userId,
      projectId,
      accountId: '',
      categoryId: '',
      entityId: undefined as string | undefined,
      description: '',
      storeName: '',
      purchaseDate: new Date(),
      originalAmount: 0,
      interestRate: 0,
      installments: 3,
      firstChargeDate: new Date(),
      chargedInstallments: 0,
      isExternalDebt: false,
      notes: '',
    },
  });

  // Watch fields for conditional rendering
  const watchPurchaseDate = form.watch('purchaseDate');
  const watchOriginalAmount = form.watch('originalAmount');
  const watchInterestRate = form.watch('interestRate');
  const watchInstallments = form.watch('installments');
  const watchFirstChargeDate = form.watch('firstChargeDate');

  // Sync firstChargeDate with purchaseDate
  useEffect(() => {
    if (watchPurchaseDate) {
      form.setValue('firstChargeDate', watchPurchaseDate);
    }
  }, [watchPurchaseDate, form]);

  // Calculate amounts
  const interestMultiplier = 1 + ((watchInterestRate || 0) / 100);
  const totalAmount = (watchOriginalAmount || 0) * interestMultiplier;
  const interestAmount = totalAmount - (watchOriginalAmount || 0);
  const installmentAmount = watchInstallments > 0 ? totalAmount / watchInstallments : 0;

  const calculatedChargedInstallments = calculateChargedInstallments(
    watchFirstChargeDate,
    watchInstallments
  );

  useEffect(() => {
    form.setValue('chargedInstallments', calculatedChargedInstallments);
  }, [calculatedChargedInstallments, form]);

  // Track form progress
  const calculateProgress = useCallback((values: any) => {
    return [
      !!values.accountId,
      !!values.description,
      values.originalAmount !== undefined && values.originalAmount > 0,
    ].filter(Boolean).length;
  }, []);

  const [formProgress, setFormProgress] = useState(() => calculateProgress(form.getValues()));

  useEffect(() => {
    setFormProgress(calculateProgress(form.getValues()));

    const subscription = form.watch((values) => {
      setFormProgress(calculateProgress(values));
    });
    return () => subscription.unsubscribe();
  }, [form, calculateProgress]);

  async function onSubmit(data: any) {
    setError(null);
    const toastId = toast.loading('Creando compra en cuotas...');

    startTransition(async () => {
      const result = await createCardPurchase(data);

      if (result.success) {
        toast.success('Compra registrada', { id: toastId });
        form.reset();
        triggerSuccess();
      } else {
        const errorMessage = result.error || 'Error al crear la compra';
        toast.error(errorMessage, { id: toastId });
        setError(errorMessage);
      }
    });
  }

  return (
    <ResponsiveDrawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Nueva compra en cuotas
        </Button>
      </DrawerTrigger>
      <FormDrawer
        title="Registrar compra en cuotas"
        description="Registra una compra con tarjeta de crédito en cuotas para hacer seguimiento del pago."
        showSuccess={showSuccess}
        headerExtra={<ProgressIndicator current={formProgress} total={3} />}
      >
        <Form {...form}>
          <FormDrawerBody as="form" onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
            {/* Credit Card */}
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
                      label="Tarjeta de crédito"
                      searchPlaceholder="Buscar tarjeta..."
                      filterByType={['credit_card']}
                      valid={!!field.value}
                      invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dates */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field, fieldState }) => (
                  <FormItem data-field="purchaseDate">
                    <FormControl>
                      <FloatingLabelDateInput
                        label="Fecha de compra"
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

              <FormField
                control={form.control}
                name="firstChargeDate"
                render={({ field, fieldState }) => (
                  <FormItem data-field="firstChargeDate">
                    <FormControl>
                      <FloatingLabelDateInput
                        label="Vencimiento 1ra cuota"
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
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <FormItem data-field="description">
                  <FormControl>
                    <FloatingLabelInput
                      label="Descripción"
                      placeholder="ej: MacBook Pro M3"
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

            {/* Entity or Manual Store */}
            {entities.length > 0 && !showManualStore ? (
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
                          onValueChange={field.onChange}
                          label="Tienda (opcional)"
                          searchPlaceholder="Buscar tienda..."
                          allowNone
                          noneLabel="Sin tienda"
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
                    setShowManualStore(true);
                    form.setValue('entityId', undefined);
                  }}
                >
                  <Pencil className="mr-1.5 h-3 w-3" />
                  Escribir tienda manualmente
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="storeName"
                  render={({ field, fieldState }) => (
                    <FormItem data-field="storeName">
                      <FormControl>
                        <FloatingLabelInput
                          label="Tienda (opcional)"
                          placeholder="ej: Apple Store"
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
                {entities.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground h-auto p-0"
                    onClick={() => {
                      setShowManualStore(false);
                      form.setValue('storeName', '');
                    }}
                  >
                    <Store className="mr-1.5 h-3 w-3" />
                    Seleccionar tienda
                  </Button>
                )}
              </div>
            )}

            {/* Category */}
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field, fieldState }) => (
                <FormItem data-field="categoryId">
                  <FormControl>
                    <CategorySelector
                      categories={localCategories}
                      value={field.value}
                      onValueChange={(value) => field.onChange(value ?? '')}
                      projectId={projectId}
                      userId={userId}
                      label="Categoría"
                      searchPlaceholder="Buscar categoría..."
                      onCategoryCreated={(newCat) => {
                        setLocalCategories((prev) => [...prev, newCat]);
                      }}
                      valid={!!field.value}
                      invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount */}
            <FormField
              control={form.control}
              name="originalAmount"
              render={({ field, fieldState }) => (
                <FormItem data-field="originalAmount">
                  <FormControl>
                    <CurrencyInput
                      value={field.value}
                      onChange={field.onChange}
                      currency="CLP"
                      placeholder="0"
                      size="lg"
                      label="Monto total"
                      valid={field.value !== undefined && field.value > 0 && !fieldState.error}
                      invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Installments and Interest Rate */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4 items-end">
              <FormField
                control={form.control}
                name="installments"
                render={({ field, fieldState }) => (
                  <FormItem data-field="installments">
                    <FormControl>
                      <InstallmentSelector
                        value={field.value}
                        onChange={field.onChange}
                        min={1}
                        max={60}
                        label="Número de cuotas"
                        valid={field.value > 0 && !fieldState.error}
                        invalid={!!fieldState.error}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interestRate"
                render={({ field, fieldState }) => (
                  <FormItem data-field="interestRate">
                    <FormControl>
                      <FloatingLabelInput
                        label="Tasa de interés (%)"
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        placeholder="0"
                        value={field.value?.toString() ?? '0'}
                        onChange={(value) => field.onChange(parseFloat(value) || 0)}
                        valid={!fieldState.error}
                        invalid={!!fieldState.error}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Summary Card */}
            {(watchOriginalAmount ?? 0) > 0 && watchInstallments > 0 && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Monto original:</span>
                    <span className="font-medium">
                      {formatCurrency(watchOriginalAmount ?? 0)}
                    </span>
                  </div>
                  {interestAmount > 0 && (
                    <div className="flex justify-between text-destructive">
                      <span>Interés ({watchInterestRate}%):</span>
                      <span className="font-medium">
                        +{formatCurrency(interestAmount)}
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>Total a pagar:</span>
                    <span>{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-primary">
                    <span>Cuota mensual:</span>
                    <span className="font-bold">
                      {formatCurrency(installmentAmount)} x {watchInstallments}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Charged Installments Notice */}
            {calculatedChargedInstallments > 0 && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Cuotas vencidas (se marcarán como pagadas)
                  </span>
                  <span className="font-medium">
                    {calculatedChargedInstallments} de {watchInstallments}
                  </span>
                </div>
              </div>
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
                Más opciones
              </Button>
            )}

            {/* Advanced Options */}
            {showAdvancedOptions && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Más opciones</span>
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

                {/* External Debt Switch */}
                <FormField
                  control={form.control}
                  name="isExternalDebt"
                  render={({ field }) => (
                    <FormItem data-field="isExternalDebt">
                      <FormControl>
                        <SwitchCard
                          title="Deuda externa (familiar/tercero)"
                          description="Marca si compraste para alguien que te pagará las cuotas. No se contará en tu límite de endeudamiento."
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
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
                          placeholder="Notas adicionales..."
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
                icon={<ArrowRight className="size-7" />}
              >
                Guardar compra
              </SubmitButton>
            </FormDrawerFooter>
          </FormDrawerBody>
        </Form>
      </FormDrawer>
    </ResponsiveDrawer>
  );
}
