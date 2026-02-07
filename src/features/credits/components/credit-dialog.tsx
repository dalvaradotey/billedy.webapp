'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/currency-input';
import { InstallmentSelector } from '@/components/installment-selector';
import { CategorySelector } from '@/components/category-selector';
import { EntitySelector } from '@/components/entity-selector';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Entity } from '@/features/entities/types';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
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
  accounts: { id: string; name: string; type: string }[];
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
  const [localCategories, setLocalCategories] = useState<
    { id: string; name: string; color: string }[]
  >(categories.map((c) => ({ id: c.id, name: c.name, color: c.color })));

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
        onSuccess();
        onMutationSuccess?.(toastId, isEditing ? 'Crédito actualizado' : 'Crédito creado');
      } else {
        setError(result.error);
        onMutationError?.(toastId, result.error);
      }
    });
  };

  return (
    <DrawerContent>
      <div className="mx-auto w-full max-w-lg">
        <DrawerHeader>
          <DrawerTitle>{isEditing ? 'Editar crédito' : 'Nuevo crédito'}</DrawerTitle>
          <DrawerDescription>
            {isEditing
              ? 'Modifica los detalles del crédito.'
              : 'Registra un nuevo crédito o préstamo.'}
          </DrawerDescription>
        </DrawerHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 pb-4 max-h-[70vh] md:max-h-[calc(100vh-8rem)] overflow-y-auto">
          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Crédito de consumo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Category & Entity */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <FormControl>
                    <CategorySelector
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
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="entityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entidad (opcional)</FormLabel>
                  <FormControl>
                    <EntitySelector
                      entities={entities}
                      value={field.value ?? undefined}
                      onValueChange={(val) => field.onChange(val ?? null)}
                      disabled={isEditing}
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
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cuenta de cargo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una cuenta" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {!isEditing && (
            <>
              {/* Principal & Installments */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="principalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto solicitado (capital)</FormLabel>
                      <FormControl>
                        <CurrencyInput
                          value={field.value ?? undefined}
                          onChange={field.onChange}
                          placeholder="0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="installments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>N° de cuotas</FormLabel>
                      <FormControl>
                        <InstallmentSelector
                          value={field.value}
                          onChange={field.onChange}
                          min={1}
                          max={60}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Installment Amount */}
              <FormField
                control={form.control}
                name="installmentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor de la cuota</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value ?? undefined}
                        onChange={field.onChange}
                        placeholder="0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Calculated totals */}
              {watchedPrincipal && watchedInstallmentAmount && watchedInstallments && (
                <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monto total a pagar:</span>
                      <span className="font-medium">{formatCurrency(calculatedTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total intereses:</span>
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

              {/* Start Date & Frequency */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha primera cuota</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value ? field.value.toISOString().split('T')[0] : ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? new Date(e.target.value + 'T12:00:00') : undefined
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frecuencia</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">Mensual</SelectItem>
                          <SelectItem value="biweekly">Quincenal</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Paid Installments - Calculated */}
              {watchedStartDate && watchedFrequency && watchedInstallments && (
                <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Cuotas ya pagadas (calculado)</span>
                    <span className="text-lg font-bold">{calculatedPaidInstallments}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Basado en la fecha de inicio y frecuencia, se registrarán{' '}
                    {calculatedPaidInstallments} cuotas como pagadas.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción (opcional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Detalles adicionales del crédito..."
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

            <DrawerFooter className="pt-4">
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear crédito'}
              </Button>
            </DrawerFooter>
          </form>
        </Form>
      </div>
    </DrawerContent>
  );
}
