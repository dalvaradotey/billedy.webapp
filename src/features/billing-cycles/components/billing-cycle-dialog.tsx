'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import { createBillingCycle, updateBillingCycle } from '../actions';
import { createBillingCycleSchema, type CreateBillingCycleInput } from '../schemas';
import type { BillingCycleWithTotals } from '../types';
import { formatDateInput } from './utils';

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
        onSuccess();
        onMutationSuccess?.(toastId, isEditing ? 'Ciclo actualizado' : 'Ciclo creado');
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
          <DrawerTitle>{isEditing ? 'Editar ciclo' : 'Nuevo ciclo de facturación'}</DrawerTitle>
          <DrawerDescription>
            {isEditing
              ? 'Modifica los detalles del ciclo.'
              : 'Crea un nuevo ciclo para organizar tus finanzas por período.'}
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
                  <Input placeholder="Ej: Ciclo Enero 2025" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Dates */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha inicio</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={formatDateInput(field.value)}
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
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha fin (cierre)</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={formatDateInput(field.value)}
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
          </div>

          {/* Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notas (opcional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Ej: Mes con bono de fin de año"
                    {...field}
                    value={field.value ?? ''}
                    rows={2}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

            <DrawerFooter className="pt-4">
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear ciclo'}
              </Button>
            </DrawerFooter>
          </form>
        </Form>
      </div>
    </DrawerContent>
  );
}
