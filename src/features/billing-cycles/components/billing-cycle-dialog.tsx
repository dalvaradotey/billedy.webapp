'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowRight, Check } from 'lucide-react';

import { useFormValidation, useSuccessAnimation } from '@/hooks';
import { SubmitButton } from '@/components/submit-button';
import { FloatingLabelInput } from '@/components/floating-label-input';
import { FloatingLabelDateInput } from '@/components/floating-label-date-input';
import { FloatingLabelTextarea } from '@/components/floating-label-textarea';
import { FormDrawer, FormDrawerBody, FormDrawerFooter } from '@/components/form-drawer';
import { ProgressIndicator } from '@/components/progress-indicator';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';

import { createBillingCycle, updateBillingCycle } from '../actions';
import { createBillingCycleSchema, type CreateBillingCycleInput } from '../schemas';
import type { BillingCycleWithTotals } from '../types';

interface BillingCycleDialogContentProps {
  projectId: string;
  userId: string;
  cycle: BillingCycleWithTotals | null;
  suggestedDates: { startDate: Date; endDate: Date; name: string } | null;
  onSuccess: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

export function BillingCycleDialogContent({
  projectId,
  userId,
  cycle,
  suggestedDates,
  onSuccess,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: BillingCycleDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!cycle;

  // Form UX hooks
  const { onInvalid } = useFormValidation();
  const { showSuccess, triggerSuccess } = useSuccessAnimation({
    onComplete: onSuccess,
  });

  const defaultValues = isEditing
    ? {
        projectId,
        name: cycle.name,
        startDate: new Date(cycle.startDate),
        endDate: new Date(cycle.endDate),
        notes: cycle.notes ?? '',
      }
    : {
        projectId,
        name: suggestedDates?.name ?? '',
        startDate: suggestedDates?.startDate ?? new Date(),
        endDate: suggestedDates?.endDate ?? new Date(),
        notes: '',
      };

  const form = useForm<CreateBillingCycleInput>({
    resolver: zodResolver(createBillingCycleSchema),
    defaultValues,
  });

  // Track form progress
  const calculateProgress = useCallback((values: any) => {
    return [
      !!values.name,
      !!values.startDate,
      !!values.endDate,
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

  const onSubmit = (data: CreateBillingCycleInput) => {
    setError(null);
    const toastId = toast.loading(isEditing ? 'Actualizando ciclo...' : 'Creando ciclo...');
    onMutationStart?.();

    startTransition(async () => {
      const result = isEditing
        ? await updateBillingCycle(cycle.id, userId, {
            name: data.name,
            startDate: data.startDate,
            endDate: data.endDate,
            notes: data.notes,
          })
        : await createBillingCycle(userId, data);

      if (result.success) {
        form.reset();
        triggerSuccess();
        onMutationSuccess?.(toastId, isEditing ? 'Ciclo actualizado' : 'Ciclo creado');
      } else {
        setError(result.error);
        onMutationError?.(toastId, result.error);
      }
    });
  };

  return (
    <FormDrawer
      title={isEditing ? 'Editar ciclo' : 'Nuevo ciclo de facturación'}
      description={
        isEditing
          ? 'Modifica los detalles del ciclo.'
          : 'Crea un nuevo ciclo para organizar tus finanzas por período.'
      }
      showSuccess={showSuccess}
      headerExtra={!isEditing ? <ProgressIndicator current={formProgress} total={3} /> : undefined}
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
                    placeholder="Ej: Ciclo Enero 2025"
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

          {/* Dates */}
          <div className="grid gap-2 sm:gap-4 grid-cols-2">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field, fieldState }) => (
                <FormItem data-field="startDate">
                  <FormControl>
                    <FloatingLabelDateInput
                      label="Fecha inicio"
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
              name="endDate"
              render={({ field, fieldState }) => (
                <FormItem data-field="endDate">
                  <FormControl>
                    <FloatingLabelDateInput
                      label="Fecha fin"
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

          {/* Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field, fieldState }) => (
              <FormItem data-field="notes">
                <FormControl>
                  <FloatingLabelTextarea
                    label="Notas (opcional)"
                    placeholder="Ej: Mes con bono de fin de año"
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <FormDrawerFooter>
            <SubmitButton
              isPending={isPending}
              pendingText="Guardando..."
              icon={isEditing ? <Check className="size-7" /> : <ArrowRight className="size-7" />}
            >
              {isEditing ? 'Guardar cambios' : 'Crear ciclo'}
            </SubmitButton>
          </FormDrawerFooter>
        </FormDrawerBody>
      </Form>
    </FormDrawer>
  );
}
