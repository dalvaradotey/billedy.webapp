'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CurrencyInput } from '@/components/currency-input';
import { createAccountTransfer } from '../actions';
import type { CreateAccountTransferInput } from '../schemas';
import type { Account } from '@/features/accounts/types';
import { type AccountType } from '@/features/accounts/types';
import { AccountTypeIcon } from '@/features/accounts/components/account-type-icon';

export interface TransferFormProps {
  projectId: string;
  userId: string;
  accounts: Account[];
  defaultCurrency: string;
  onSuccess: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

export function TransferForm({
  projectId,
  userId,
  accounts,
  defaultCurrency,
  onSuccess,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: TransferFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const defaultAccount = accounts.find((a) => a.isDefault && !a.isArchived);
  const activeAccounts = accounts.filter((a) => !a.isArchived);

  const [fromAccountId, setFromAccountId] = useState(defaultAccount?.id ?? '');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [date, setDate] = useState<Date>(new Date());
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setFromAccountId(defaultAccount?.id ?? '');
    setToAccountId('');
    setAmount(undefined);
    setDate(new Date());
    setDescription('');
    setNotes('');
    setError(null);
  };

  const handleSubmit = () => {
    setError(null);

    if (!fromAccountId) {
      setError('Selecciona una cuenta de origen');
      return;
    }
    if (!toAccountId) {
      setError('Selecciona una cuenta de destino');
      return;
    }
    if (fromAccountId === toAccountId) {
      setError('La cuenta de origen y destino deben ser diferentes');
      return;
    }
    if (!amount || amount <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }

    const toastId = toast.loading('Creando transferencia...');
    onMutationStart?.();

    startTransition(async () => {
      const transferData: CreateAccountTransferInput = {
        projectId,
        fromAccountId,
        toAccountId,
        amount,
        date,
        description: description || undefined,
        notes: notes || undefined,
      };

      const result = await createAccountTransfer(userId, transferData);

      if (result.success) {
        resetForm();
        onSuccess();
        onMutationSuccess?.(toastId, 'Transferencia creada');
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
          <DrawerTitle>Nueva transferencia</DrawerTitle>
          <DrawerDescription>
            Mueve dinero entre tus cuentas.
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-4 px-4 pb-4 max-h-[70vh] md:max-h-[calc(100vh-8rem)] overflow-y-auto">
        {/* Amount and Date */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Monto</label>
            <CurrencyInput
              value={amount}
              onChange={setAmount}
              currency={defaultCurrency}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Fecha</label>
            <Input
              type="date"
              value={date.toISOString().split('T')[0]}
              onChange={(e) => setDate(new Date(e.target.value + 'T12:00:00'))}
            />
          </div>
        </div>

        {/* From Account */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Cuenta origen</label>
          <Select value={fromAccountId} onValueChange={setFromAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona cuenta de origen" />
            </SelectTrigger>
            <SelectContent>
              {activeAccounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id} disabled={acc.id === toAccountId}>
                  <div className="flex items-center gap-2">
                    <AccountTypeIcon type={acc.type as AccountType} className="h-4 w-4" />
                    {acc.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* To Account */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Cuenta destino</label>
          <Select value={toAccountId} onValueChange={setToAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona cuenta de destino" />
            </SelectTrigger>
            <SelectContent>
              {activeAccounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id} disabled={acc.id === fromAccountId}>
                  <div className="flex items-center gap-2">
                    <AccountTypeIcon type={acc.type as AccountType} className="h-4 w-4" />
                    {acc.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Description (optional) */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Descripción (opcional)</label>
          <Input
            placeholder="Ej: Ahorro mensual"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Notes (optional) */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Notas (opcional)</label>
          <Input
            placeholder="Notas adicionales..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DrawerFooter className="pt-4">
            <Button type="button" onClick={handleSubmit} disabled={isPending} className="w-full">
              {isPending ? 'Creando...' : 'Crear transferencia'}
            </Button>
          </DrawerFooter>
        </div>
      </div>
    </DrawerContent>
  );
}
