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
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import { formatCurrency } from '@/lib/formatting';
import { createMovement } from '../actions';
import { createMovementSchema, type CreateMovementInput } from '../schemas';

interface MovementDialogContentProps {
  fundId: string;
  fundName: string;
  userId: string;
  type: 'deposit' | 'withdrawal';
  currentBalance: number;
  currencyCode: string;
  onSuccess: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

export function MovementDialogContent({
  fundId,
  fundName,
  userId,
  type,
  currentBalance,
  currencyCode,
  onSuccess,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: MovementDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isDeposit = type === 'deposit';

  const form = useForm<CreateMovementInput>({
    resolver: zodResolver(createMovementSchema),
    defaultValues: {
      savingsFundId: fundId,
      type,
      amount: undefined,
      date: new Date(),
      description: '',
    },
  });

  const onSubmit = (data: CreateMovementInput) => {
    setError(null);

    if (type === 'withdrawal' && data.amount > currentBalance) {
      setError(`No puedes retirar más de ${formatCurrency(currentBalance, currencyCode)}`);
      return;
    }

    const toastId = toast.loading(isDeposit ? 'Registrando depósito...' : 'Registrando retiro...');
    onMutationStart?.();

    startTransition(async () => {
      const result = await createMovement(userId, data);

      if (result.success) {
        form.reset();
        onSuccess();
        onMutationSuccess?.(toastId, isDeposit ? 'Depósito registrado' : 'Retiro registrado');
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
          <DrawerTitle>{isDeposit ? 'Depositar' : 'Retirar'}</DrawerTitle>
          <DrawerDescription>
            {isDeposit ? 'Registra un depósito en' : 'Registra un retiro de'} {fundName}
          </DrawerDescription>
        </DrawerHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 pb-4 max-h-[70vh] md:max-h-[calc(100vh-8rem)] overflow-y-auto">
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Balance actual</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(currentBalance, currencyCode)}
              </span>
            </div>
          </div>

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monto</FormLabel>
                <FormControl>
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    currency={currencyCode}
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
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción (opcional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Ej: Depósito mensual"
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
              <Button
                type="submit"
                disabled={isPending}
                className={`w-full ${isDeposit ? '' : 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'}`}
              >
                {isPending
                  ? 'Guardando...'
                  : isDeposit
                    ? 'Registrar depósito'
                    : 'Registrar retiro'}
              </Button>
            </DrawerFooter>
          </form>
        </Form>
      </div>
    </DrawerContent>
  );
}
