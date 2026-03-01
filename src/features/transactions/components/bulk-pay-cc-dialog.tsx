'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { CreditCard, Wallet } from 'lucide-react';
import { SubmitButton } from '@/components/submit-button';
import {
  ResponsiveDrawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { FloatingLabelDateInput } from '@/components/floating-label-date-input';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { CurrencyInput } from '@/components/currency-input';
import { AccountSelector } from '@/components/account-selector';
import { formatCurrency, formatDate } from '@/lib/formatting';
import { payCreditCardTransactions } from '../actions';
import type { TransactionWithCategory } from '../types';
import type { AccountWithEntity } from '@/features/accounts/types';

interface CreditCardGroup {
  accountId: string;
  accountName: string;
  accountImageUrl: string | null;
  transactions: TransactionWithCategory[];
  subtotal: number;
}

export interface BulkPayCreditCardDialogProps {
  projectId: string;
  userId: string;
  transactions: TransactionWithCategory[];
  accounts: AccountWithEntity[];
  accountsMap: Map<string, AccountWithEntity>;
  defaultCurrency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

export function BulkPayCreditCardDialog({
  projectId,
  userId,
  transactions,
  accounts,
  accountsMap,
  defaultCurrency,
  open,
  onOpenChange,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: BulkPayCreditCardDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [interestAmounts, setInterestAmounts] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());

  // Group transactions by credit card
  const groupedByCard = useMemo(() => {
    const groups = new Map<string, CreditCardGroup>();

    transactions.forEach((t) => {
      const accountId = t.accountId ?? '';
      const account = accountsMap.get(accountId);

      if (!groups.has(accountId)) {
        groups.set(accountId, {
          accountId,
          accountName: account?.name ?? 'Tarjeta desconocida',
          accountImageUrl: account?.entity?.imageUrl ?? null,
          transactions: [],
          subtotal: 0,
        });
      }

      const group = groups.get(accountId)!;
      group.transactions.push(t);
      group.subtotal += parseFloat(t.baseAmount);
    });

    return Array.from(groups.values());
  }, [transactions, accountsMap]);

  // Calculate totals
  const totals = useMemo(() => {
    let transactionsTotal = 0;
    let interestTotal = 0;

    groupedByCard.forEach((group) => {
      transactionsTotal += group.subtotal;
      interestTotal += interestAmounts.get(group.accountId) ?? 0;
    });

    return {
      transactionsTotal,
      interestTotal,
      grandTotal: transactionsTotal + interestTotal,
    };
  }, [groupedByCard, interestAmounts]);

  // Available source accounts (non-credit cards)
  const availableSourceAccounts = useMemo(() => {
    return accounts.filter((a) => a.type !== 'credit_card' && !a.isArchived);
  }, [accounts]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSourceAccountId('');
      setInterestAmounts(new Map());
      setError(null);
      setPaymentDate(new Date());
    }
  }, [open]);

  const handleInterestChange = (accountId: string, amount: number | undefined) => {
    setInterestAmounts((prev) => {
      const next = new Map(prev);
      if (amount === undefined || amount === 0) {
        next.delete(accountId);
      } else {
        next.set(accountId, amount);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    setError(null);

    if (!sourceAccountId) {
      setError('Selecciona una cuenta de origen');
      return;
    }

    if (groupedByCard.length === 0) {
      setError('No hay transacciones para pagar');
      return;
    }

    const toastId = toast.loading('Procesando pago...');
    onMutationStart?.();

    startTransition(async () => {
      let totalPaid = 0;
      let totalInterest = 0;
      let errorOccurred = false;

      for (const group of groupedByCard) {
        const result = await payCreditCardTransactions(userId, {
          projectId,
          transactionIds: group.transactions.map((t) => t.id),
          sourceAccountId,
          creditCardAccountId: group.accountId,
          date: paymentDate,
          interestAmount: interestAmounts.get(group.accountId),
        });

        if (result.success) {
          totalPaid += result.data.totalPaid;
          totalInterest += result.data.interestPaid ?? 0;
        } else {
          errorOccurred = true;
          onMutationError?.(toastId, result.error);
          setError(result.error);
          break;
        }
      }

      if (!errorOccurred) {
        const message =
          totalInterest > 0
            ? `Pago realizado: ${formatCurrency(totalPaid, defaultCurrency)} + ${formatCurrency(totalInterest, defaultCurrency)} intereses`
            : `Pago realizado: ${formatCurrency(totalPaid, defaultCurrency)}`;
        onMutationSuccess?.(toastId, message);
        onOpenChange(false);
      }
    });
  };

  return (
    <ResponsiveDrawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Pagar tarjeta de crédito</DrawerTitle>
            <DrawerDescription>
              {groupedByCard.length === 1
                ? `Pagando ${transactions.length} transacción${transactions.length > 1 ? 'es' : ''} de ${groupedByCard[0]?.accountName}`
                : `Pagando ${transactions.length} transacciones de ${groupedByCard.length} tarjetas`}
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 px-4 pt-2 pb-4 max-h-[70vh] md:max-h-[calc(100vh-8rem)] overflow-y-auto">
          {/* Source account */}
          <AccountSelector
            accounts={availableSourceAccounts}
            value={sourceAccountId || null}
            onValueChange={(value) => setSourceAccountId(value ?? '')}
            label="Pagar desde"
            placeholder="Selecciona cuenta de origen"
            searchPlaceholder="Buscar cuenta..."
            valid={!!sourceAccountId}
          />

          {/* Payment date */}
          <FloatingLabelDateInput
            label="Fecha de pago"
            value={paymentDate}
            onChange={(date) => setPaymentDate(date ?? new Date())}
          />

          {/* Groups by card */}
          {groupedByCard.map((group) => (
            <div key={group.accountId} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {group.accountImageUrl ? (
                    <img
                      src={group.accountImageUrl}
                      alt={group.accountName}
                      className="h-5 w-5 rounded object-contain bg-white"
                    />
                  ) : (
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">{group.accountName}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {group.transactions.length} transacción{group.transactions.length > 1 ? 'es' : ''}
                </span>
              </div>

              {/* Transaction list */}
              <div className="max-h-[150px] overflow-y-auto rounded border">
                <Table>
                  <TableBody>
                    {group.transactions.map((t) => (
                      <TableRow key={t.id} className="text-sm">
                        <TableCell className="py-1.5 w-[70px]">{formatDate(t.date)}</TableCell>
                        <TableCell className="py-1.5">
                          <div className="truncate max-w-[200px]">{t.description}</div>
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-medium text-red-600 dark:text-red-400 w-[100px]">
                          {formatCurrency(t.baseAmount, t.baseCurrency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Subtotal and interest */}
              <div className="flex items-end gap-3 pt-2 border-t">
                <div className="flex-1 pb-2">
                  <span className="text-xs text-muted-foreground">Subtotal</span>
                  <div className="font-medium text-lg">{formatCurrency(group.subtotal, defaultCurrency)}</div>
                </div>
                <div className="flex-1">
                  <CurrencyInput
                    value={interestAmounts.get(group.accountId)}
                    onChange={(v) => handleInterestChange(group.accountId, v)}
                    currency={defaultCurrency}
                    placeholder="0"
                    label="Intereses"
                    className="h-14 pt-5 pb-1"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Grand total */}
          <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total compras/cuotas</span>
              <span>{formatCurrency(totals.transactionsTotal, defaultCurrency)}</span>
            </div>
            {totals.interestTotal > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total intereses/cargos</span>
                <span>{formatCurrency(totals.interestTotal, defaultCurrency)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="font-medium">Total a pagar</span>
              <span className="text-xl font-bold">{formatCurrency(totals.grandTotal, defaultCurrency)}</span>
            </div>
          </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DrawerFooter className="pt-4 px-0">
              <SubmitButton
                type="button"
                isPending={isPending}
                pendingText="Procesando pago..."
                disabled={!sourceAccountId}
                icon={<Wallet className="size-6" />}
                onClick={handleSubmit}
              >
                Pagar {formatCurrency(totals.grandTotal, defaultCurrency)}
              </SubmitButton>
            </DrawerFooter>
          </div>
        </div>
      </DrawerContent>
    </ResponsiveDrawer>
  );
}
