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
import { CurrencyInput } from '@/components/currency-input';
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
        onSuccess();
        onMutationSuccess?.(toastId, isEditing ? 'Fondo actualizado' : 'Fondo creado');
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
          <DrawerTitle>{isEditing ? 'Editar fondo' : 'Nuevo fondo de ahorro'}</DrawerTitle>
          <DrawerDescription>
            {isEditing
              ? 'Modifica los detalles del fondo de ahorro.'
              : 'Crea un nuevo fondo para organizar tus ahorros.'}
          </DrawerDescription>
        </DrawerHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 pb-4 max-h-[70vh] md:max-h-[calc(100vh-8rem)] overflow-y-auto">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Fondo de emergencia" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de fondo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="emergency">Emergencia</SelectItem>
                      <SelectItem value="investment">Inversión</SelectItem>
                      <SelectItem value="goal">Meta específica</SelectItem>
                      <SelectItem value="other">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accountType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de cuenta</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACCOUNT_TYPE_OPTIONS.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {!isEditing && currencies.length > 1 && (
            <div>
              <label className="text-sm font-medium">Moneda</label>
              <Select value={selectedCurrencyId} onValueChange={setSelectedCurrencyId}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.id} value={currency.id}>
                      {currency.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="targetAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meta total (opcional)</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value ?? undefined}
                      onChange={field.onChange}
                      currency={selectedCurrencyCode}
                      placeholder="0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="monthlyTarget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meta mensual</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value}
                      onChange={field.onChange}
                      currency={selectedCurrencyCode}
                      placeholder="0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {!isEditing && (
            <FormField
              control={form.control}
              name="currentBalance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Balance inicial (opcional)</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value}
                      onChange={(value) => field.onChange(value ?? 0)}
                      currency={selectedCurrencyCode}
                      placeholder="0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

            <DrawerFooter className="pt-4">
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear fondo'}
              </Button>
            </DrawerFooter>
          </form>
        </Form>
      </div>
    </DrawerContent>
  );
}
