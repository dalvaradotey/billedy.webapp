'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Image from 'next/image';
import { Building2, PiggyBank, Wallet, CreditCard, AlertTriangle } from 'lucide-react';

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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
        onSuccess();
        onMutationSuccess?.(toastId, isEditing ? 'Cuenta actualizada' : 'Cuenta creada');
      } else {
        setError(result.error);
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const watchType = form.watch('type');

  return (
    <DrawerContent>
      <div className="mx-auto w-full max-w-lg">
        <DrawerHeader>
          <DrawerTitle>{isEditing ? 'Editar cuenta' : 'Nueva cuenta'}</DrawerTitle>
          <DrawerDescription>
            {isEditing
              ? 'Modifica los detalles de la cuenta.'
              : 'Agrega una cuenta bancaria, efectivo o tarjeta de crédito.'}
          </DrawerDescription>
        </DrawerHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 pb-4 max-h-[70vh] md:max-h-[calc(100vh-8rem)] overflow-y-auto">
          {/* Type */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de cuenta</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="checking">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Cuenta Corriente
                      </div>
                    </SelectItem>
                    <SelectItem value="savings">
                      <div className="flex items-center gap-2">
                        <PiggyBank className="h-4 w-4" />
                        Cuenta de Ahorro
                      </div>
                    </SelectItem>
                    <SelectItem value="cash">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        Efectivo
                      </div>
                    </SelectItem>
                    <SelectItem value="credit_card">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Tarjeta de Crédito
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Cuenta Corriente BCI" {...field} />
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
              render={({ field }) => {
                const financialEntities = entities.filter(
                  (e) => e.type === 'bank' || e.type === 'credit_card'
                );
                return (
                  <FormItem>
                    <FormLabel>Banco / Tarjeta (opcional)</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === '_none' ? undefined : value)
                      }
                      value={field.value ?? '_none'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona institución" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_none">Sin institución</SelectItem>
                        {financialEntities.map((entity) => (
                          <SelectItem key={entity.id} value={entity.id}>
                            <div className="flex items-center gap-2">
                              {entity.imageUrl && (
                                <Image
                                  src={entity.imageUrl}
                                  alt={entity.name}
                                  width={20}
                                  height={20}
                                  className="rounded"
                                />
                              )}
                              {entity.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          )}

          {/* Currency Selector */}
          <div className="space-y-3">
            <div className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Moneda diferente
                </label>
                <p className="text-[0.8rem] text-muted-foreground">Por defecto se usa CLP</p>
              </div>
              <Switch
                checked={showCurrencySelector}
                onCheckedChange={(checked) => {
                  setShowCurrencySelector(checked);
                  if (!checked) {
                    form.setValue('currency', 'CLP');
                  }
                }}
              />
            </div>

            {showCurrencySelector && (
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una moneda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          {/* Initial Balance */}
          <FormField
            control={form.control}
            name="initialBalance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {watchType === 'credit_card' ? 'Deuda actual' : 'Saldo inicial'}
                </FormLabel>
                <FormControl>
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    currency={form.watch('currency') ?? 'CLP'}
                    placeholder="0"
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
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cupo total</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value ?? undefined}
                      onChange={field.onChange}
                      currency={form.watch('currency') ?? 'CLP'}
                      placeholder="0"
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

          {/* Is Default */}
          <FormField
            control={form.control}
            name="isDefault"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Cuenta principal</FormLabel>
                  <FormDescription>
                    Se usará como cuenta predeterminada para nuevas transacciones
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Balance Adjustment - Only when editing */}
          {isEditing && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Ajustar saldo actual
                  </label>
                  <p className="text-[0.8rem] text-muted-foreground">
                    Corrige el saldo manualmente (reconciliación)
                  </p>
                </div>
                <Switch
                  checked={adjustBalance}
                  onCheckedChange={(checked) => {
                    setAdjustBalance(checked);
                    if (checked && account) {
                      setNewBalance(parseFloat(account.currentBalance));
                    }
                  }}
                />
              </div>

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
                    <label className="text-sm font-medium leading-none">
                      {watchType === 'credit_card' ? 'Nueva deuda' : 'Nuevo saldo'}
                    </label>
                    <CurrencyInput
                      value={newBalance}
                      onChange={(value) => setNewBalance(value ?? 0)}
                      currency={form.watch('currency') ?? 'CLP'}
                      placeholder="0"
                    />
                    <p className="text-[0.8rem] text-muted-foreground">
                      Saldo actual: {formatCurrency(account?.currentBalance ?? 0)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DrawerFooter className="pt-4">
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear cuenta'}
            </Button>
          </DrawerFooter>
        </form>
      </Form>
      </div>
    </DrawerContent>
  );
}
