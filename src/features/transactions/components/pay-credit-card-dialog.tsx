'use client';

import { useState, useTransition, useEffect } from 'react';
import { toast } from 'sonner';
import { CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDrawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency, formatDate } from '@/lib/formatting';
import { payCreditCardTransactions, fetchUnpaidCCTransactions } from '../actions';
import type { TransactionWithCategory } from '../types';
import type { Account } from '@/features/accounts/types';
import { type AccountType } from '@/features/accounts/types';
import { AccountTypeIcon } from '@/features/accounts/components/account-type-icon';

// ============================================================================
// SHARED TRANSACTION SELECTOR TABLE
// ============================================================================

interface TransactionSelectorProps {
  transactions: TransactionWithCategory[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
}

function TransactionSelector({
  transactions,
  selectedIds,
  onToggleSelect,
  onSelectAll,
}: TransactionSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">
          Transacciones pendientes ({transactions.length})
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={onSelectAll}>
          {selectedIds.size === transactions.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
        </Button>
      </div>

      <div className="rounded-lg border max-h-[300px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow
                key={t.id}
                className={selectedIds.has(t.id) ? 'bg-muted/50' : ''}
                onClick={() => onToggleSelect(t.id)}
                style={{ cursor: 'pointer' }}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(t.id)}
                    onCheckedChange={() => onToggleSelect(t.id)}
                  />
                </TableCell>
                <TableCell className="text-sm">{formatDate(t.date)}</TableCell>
                <TableCell>
                  <div className="text-sm">{t.description}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: t.categoryColor }}
                    />
                    {t.categoryName}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium text-red-600 dark:text-red-400">
                  {formatCurrency(t.baseAmount, t.baseCurrency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ============================================================================
// PAY CREDIT CARD DIALOG (with pre-loaded transactions)
// ============================================================================

interface PayCreditCardDialogProps {
  projectId: string;
  userId: string;
  creditCardAccount: Account;
  transactions: TransactionWithCategory[];
  sourceAccounts: Account[];
  defaultCurrency: string;
  onSuccess?: () => void;
}

export function PayCreditCardDialog({
  projectId,
  userId,
  creditCardAccount,
  transactions,
  sourceAccounts,
  defaultCurrency,
  onSuccess,
}: PayCreditCardDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const unpaidTransactions = transactions.filter(
    (t) =>
      t.accountId === creditCardAccount.id &&
      t.type === 'expense' &&
      !t.paidByTransferId &&
      !t.isHistoricallyPaid
  );

  const selectedTotal = unpaidTransactions
    .filter((t) => selectedIds.has(t.id))
    .reduce((sum, t) => sum + parseFloat(t.baseAmount), 0);

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      setSourceAccountId('');
      setError(null);
    }
  }, [open]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === unpaidTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unpaidTransactions.map((t) => t.id)));
    }
  };

  const handleSubmit = () => {
    setError(null);

    if (selectedIds.size === 0) {
      setError('Selecciona al menos una transacción');
      return;
    }
    if (!sourceAccountId) {
      setError('Selecciona una cuenta de origen');
      return;
    }

    const toastId = toast.loading('Procesando pago...');

    startTransition(async () => {
      const result = await payCreditCardTransactions(userId, {
        projectId,
        transactionIds: Array.from(selectedIds),
        sourceAccountId,
        creditCardAccountId: creditCardAccount.id,
        date: new Date(),
      });

      if (result.success) {
        toast.success(`Pago realizado: ${formatCurrency(result.data.totalPaid, defaultCurrency)}`, { id: toastId });
        setOpen(false);
        onSuccess?.();
      } else {
        toast.error(result.error, { id: toastId });
        setError(result.error);
      }
    });
  };

  const availableSourceAccounts = sourceAccounts.filter(
    (a) => a.type !== 'credit_card' && !a.isArchived && a.id !== creditCardAccount.id
  );

  if (unpaidTransactions.length === 0) return null;

  return (
    <ResponsiveDrawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm">
          <CreditCard className="mr-2 h-4 w-4" />
          Pagar tarjeta
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Pagar {creditCardAccount.name}</DrawerTitle>
            <DrawerDescription>
              Selecciona las transacciones a pagar y la cuenta de origen.
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 px-4 pb-4 max-h-[70vh] md:max-h-[calc(100vh-8rem)] overflow-y-auto">
          {/* Source Account */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Pagar desde</label>
            <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona cuenta de origen" />
              </SelectTrigger>
              <SelectContent>
                {availableSourceAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    <div className="flex items-center gap-2">
                      <AccountTypeIcon type={acc.type as AccountType} className="h-4 w-4" />
                      {acc.name}
                      <span className="text-muted-foreground ml-auto">
                        {formatCurrency(parseFloat(acc.currentBalance), acc.currency)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <TransactionSelector
            transactions={unpaidTransactions}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
          />

          {/* Total */}
          <div className="rounded-lg border p-4 bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Total a pagar ({selectedIds.size} transacciones)
              </span>
              <span className="text-xl font-bold">{formatCurrency(selectedTotal, defaultCurrency)}</span>
            </div>
          </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DrawerFooter className="pt-4">
              <Button onClick={handleSubmit} disabled={isPending || selectedIds.size === 0 || !sourceAccountId} className="w-full">
                {isPending ? 'Procesando...' : `Pagar ${formatCurrency(selectedTotal, defaultCurrency)}`}
              </Button>
            </DrawerFooter>
          </div>
        </div>
      </DrawerContent>
    </ResponsiveDrawer>
  );
}

// ============================================================================
// PAY CREDIT CARD BUTTON (fetches transactions on open)
// ============================================================================

interface PayCreditCardButtonProps {
  projectId: string;
  userId: string;
  creditCardAccount: Account;
  sourceAccounts: Account[];
  defaultCurrency: string;
  onSuccess?: () => void;
}

export function PayCreditCardButton({
  projectId,
  userId,
  creditCardAccount,
  sourceAccounts,
  defaultCurrency,
  onSuccess,
}: PayCreditCardButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const [unpaidTransactions, setUnpaidTransactions] = useState<TransactionWithCategory[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setError(null);
      setSelectedIds(new Set());
      setSourceAccountId('');

      fetchUnpaidCCTransactions(creditCardAccount.id, projectId, userId)
        .then((txns) => {
          setUnpaidTransactions(txns);
          setIsLoading(false);
        })
        .catch(() => {
          setError('Error al cargar transacciones');
          setIsLoading(false);
        });
    }
  }, [open, creditCardAccount.id, projectId, userId]);

  const selectedTotal = unpaidTransactions
    .filter((t) => selectedIds.has(t.id))
    .reduce((sum, t) => sum + parseFloat(t.baseAmount), 0);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === unpaidTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unpaidTransactions.map((t) => t.id)));
    }
  };

  const handleSubmit = () => {
    setError(null);

    if (selectedIds.size === 0) {
      setError('Selecciona al menos una transacción');
      return;
    }
    if (!sourceAccountId) {
      setError('Selecciona una cuenta de origen');
      return;
    }

    const toastId = toast.loading('Procesando pago...');

    startTransition(async () => {
      const result = await payCreditCardTransactions(userId, {
        projectId,
        transactionIds: Array.from(selectedIds),
        sourceAccountId,
        creditCardAccountId: creditCardAccount.id,
        date: new Date(),
      });

      if (result.success) {
        toast.success(`Pago realizado: ${formatCurrency(result.data.totalPaid, defaultCurrency)}`, { id: toastId });
        setOpen(false);
        onSuccess?.();
      } else {
        toast.error(result.error, { id: toastId });
        setError(result.error);
      }
    });
  };

  const availableSourceAccounts = sourceAccounts.filter(
    (a) => a.type !== 'credit_card' && !a.isArchived && a.id !== creditCardAccount.id
  );

  return (
    <ResponsiveDrawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm">
          <CreditCard className="mr-2 h-4 w-4" />
          Pagar tarjeta
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Pagar {creditCardAccount.name}</DrawerTitle>
            <DrawerDescription>
              Selecciona las transacciones a pagar y la cuenta de origen.
            </DrawerDescription>
          </DrawerHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8 px-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : unpaidTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground px-4">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay transacciones pendientes de pago</p>
            </div>
          ) : (
            <div className="space-y-4 px-4 pb-4 max-h-[70vh] md:max-h-[calc(100vh-8rem)] overflow-y-auto">
            {/* Source Account */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Pagar desde</label>
              <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona cuenta de origen" />
                </SelectTrigger>
                <SelectContent>
                  {availableSourceAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <div className="flex items-center gap-2">
                        <AccountTypeIcon type={acc.type as AccountType} className="h-4 w-4" />
                        {acc.name}
                        <span className="text-muted-foreground ml-auto">
                          {formatCurrency(parseFloat(acc.currentBalance), acc.currency)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TransactionSelector
              transactions={unpaidTransactions}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
            />

            {/* Total */}
            <div className="rounded-lg border p-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Total a pagar ({selectedIds.size} transacciones)
                </span>
                <span className="text-xl font-bold">{formatCurrency(selectedTotal, defaultCurrency)}</span>
              </div>
            </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <DrawerFooter className="pt-4">
                <Button
                  onClick={handleSubmit}
                  disabled={isPending || selectedIds.size === 0 || !sourceAccountId || isLoading}
                  className="w-full"
                >
                  {isPending ? 'Procesando...' : `Pagar ${formatCurrency(selectedTotal, defaultCurrency)}`}
                </Button>
              </DrawerFooter>
            </div>
          )}
        </div>
      </DrawerContent>
    </ResponsiveDrawer>
  );
}
