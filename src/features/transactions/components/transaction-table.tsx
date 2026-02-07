'use client';

import { useState, useTransition, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Pencil,
  Trash2,
  Check,
  X,
  History,
  CreditCard,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  toggleTransactionPaid,
  deleteTransaction,
  setTransactionsHistoricallyPaid,
} from '../actions';
import type { TransactionWithCategory } from '../types';
import type { Account } from '@/features/accounts/types';
import { formatCurrency, formatDate } from '@/lib/formatting';
import { BulkPayCreditCardDialog } from './bulk-pay-cc-dialog';
import {
  DeleteTransactionDialog,
  TogglePaidDialog,
  BulkDeleteDialog,
  HistoricallyPaidDialog,
} from './confirmation-dialogs';

export function TransactionTableSkeleton({ rowCount = 5 }: { rowCount?: number }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">Pagado</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rowCount }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-4 rounded" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </TableCell>
              <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export interface TransactionTableProps {
  transactions: TransactionWithCategory[];
  accounts: Account[];
  projectId: string;
  userId: string;
  defaultCurrency: string;
  onEdit: (transaction: TransactionWithCategory) => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

export function TransactionTable({
  transactions,
  accounts,
  projectId,
  userId,
  defaultCurrency,
  onEdit,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: TransactionTableProps) {
  const [isPending, startTransition] = useTransition();
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionWithCategory | null>(null);
  const [transactionToTogglePaid, setTransactionToTogglePaid] = useState<TransactionWithCategory | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showHistoricallyPaidDialog, setShowHistoricallyPaidDialog] = useState(false);
  const [showPayCCDialog, setShowPayCCDialog] = useState(false);

  // Mapa de cuentas por ID para verificar tipo
  const accountsMap = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach((acc) => map.set(acc.id, acc));
    return map;
  }, [accounts]);

  // Verificar si una transacción es elegible para pago de TC
  const isCreditCardEligible = useCallback((t: TransactionWithCategory) => {
    const account = accountsMap.get(t.accountId ?? '');
    return (
      account?.type === 'credit_card' &&
      t.type === 'expense' &&
      !t.paidByTransferId &&
      !t.isHistoricallyPaid
    );
  }, [accountsMap]);

  // Obtener transacciones de TC elegibles seleccionadas
  const selectedCCTransactions = useMemo(() => {
    return transactions.filter((t) => selectedIds.has(t.id) && isCreditCardEligible(t));
  }, [transactions, selectedIds, isCreditCardEligible]);

  const handleConfirmTogglePaid = () => {
    if (!transactionToTogglePaid) return;
    const toastId = toast.loading(transactionToTogglePaid.isPaid ? 'Marcando como pendiente...' : 'Marcando como pagado...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await toggleTransactionPaid(transactionToTogglePaid.id, userId, { isPaid: !transactionToTogglePaid.isPaid });
      setTransactionToTogglePaid(null);
      if (result.success) {
        onMutationSuccess?.(toastId, transactionToTogglePaid.isPaid ? 'Marcado como pendiente' : 'Marcado como pagado');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleDelete = () => {
    if (!transactionToDelete) return;
    const toastId = toast.loading('Eliminando transacción...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await deleteTransaction(transactionToDelete.id, userId);
      setTransactionToDelete(null);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Transacción eliminada');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  };

  const handleBulkDelete = () => {
    const toastId = toast.loading(`Eliminando ${selectedIds.size} transacciones...`);
    onMutationStart?.();
    setShowBulkDeleteDialog(false);
    startTransition(async () => {
      let successCount = 0;
      let errorCount = 0;
      for (const id of selectedIds) {
        const result = await deleteTransaction(id, userId);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }
      setSelectedIds(new Set());
      if (errorCount === 0) {
        onMutationSuccess?.(toastId, `${successCount} transacciones eliminadas`);
      } else {
        onMutationError?.(toastId, `${successCount} eliminadas, ${errorCount} errores`);
      }
    });
  };

  const handleBulkHistoricallyPaid = (isHistoricallyPaid: boolean) => {
    const action = isHistoricallyPaid ? 'Marcando' : 'Desmarcando';
    const toastId = toast.loading(`${action} ${selectedIds.size} transacciones...`);
    onMutationStart?.();
    setShowHistoricallyPaidDialog(false);
    startTransition(async () => {
      const result = await setTransactionsHistoricallyPaid(userId, {
        projectId,
        transactionIds: Array.from(selectedIds),
        isHistoricallyPaid,
      });
      setSelectedIds(new Set());
      if (result.success) {
        const actionDone = isHistoricallyPaid ? 'marcadas como histórico' : 'desmarcadas';
        onMutationSuccess?.(toastId, `${result.data.updatedCount} transacciones ${actionDone}`);
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  // Determinar si una transacción es de tarjeta de crédito (cualquier gasto en cuenta TC)
  const isCreditCardTransaction = useCallback((t: TransactionWithCategory) => {
    const account = accountsMap.get(t.accountId ?? '');
    return account?.type === 'credit_card' && t.type === 'expense';
  }, [accountsMap]);

  // Determinar si una transacción TC fue liquidada (pagada con transferencia o históricamente)
  const isSettled = (t: TransactionWithCategory) => t.paidByTransferId !== null || t.isHistoricallyPaid;

  return (
    <div className="space-y-2">
      {/* Barra de acciones masivas */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} seleccionada{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Cancelar
            </Button>
            {selectedCCTransactions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPayCCDialog(true)}
                disabled={isPending}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Pagar TC ({selectedCCTransactions.length})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistoricallyPaidDialog(true)}
              disabled={isPending}
            >
              <History className="mr-2 h-4 w-4" />
              Histórico
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteDialog(true)}
              disabled={isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={transactions.length > 0 && selectedIds.size === transactions.length}
                onCheckedChange={handleSelectAll}
                disabled={isPending}
              />
            </TableHead>
            <TableHead className="w-[70px]">Estado</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => {
            const isCC = isCreditCardTransaction(transaction);
            const settled = isSettled(transaction);
            return (
            <TableRow key={transaction.id} className={(isCC ? settled : transaction.isPaid) ? 'opacity-60' : ''}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.has(transaction.id)}
                  onCheckedChange={() => handleToggleSelect(transaction.id)}
                  disabled={isPending}
                />
              </TableCell>
              <TableCell>
                {isCC ? (
                  // Para transacciones de TC: mostrar badge de estado
                  transaction.paidByTransferId ? (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Liq.
                    </span>
                  ) : transaction.isHistoricallyPaid ? (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      Hist.
                    </span>
                  ) : null
                ) : (
                  // Para transacciones normales: mostrar estado pagado
                  transaction.isPaid && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Pagado
                    </span>
                  )
                )}
              </TableCell>
              <TableCell className="font-medium">
                {formatDate(transaction.date)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {transaction.entityImageUrl ? (
                    <img
                      src={transaction.entityImageUrl}
                      alt={transaction.entityName ?? ''}
                      className="h-6 w-6 rounded object-contain bg-white shrink-0"
                    />
                  ) : transaction.entityId ? (
                    <div className="h-6 w-6 rounded bg-muted flex items-center justify-center shrink-0">
                      <Store className="h-3 w-3 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="h-6 w-6 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className={(isCC ? settled : transaction.isPaid) ? 'line-through' : ''}>
                      {transaction.description}
                    </div>
                    {(transaction.entityName || transaction.accountName) && (
                      <div className="text-xs text-muted-foreground">
                        {[transaction.entityName, transaction.accountName].filter(Boolean).join(' • ')}
                      </div>
                    )}
                    {transaction.notes && (
                      <div className="text-xs text-muted-foreground/70 truncate max-w-[200px]">
                        {transaction.notes}
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: transaction.categoryColor }}
                  />
                  <span className="text-sm">{transaction.categoryName}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={`font-medium ${
                    transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatCurrency(transaction.originalAmount, transaction.originalCurrency)}
                </span>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
                      <span className="sr-only">Acciones</span>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v.01M12 12v.01M12 18v.01" />
                      </svg>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {/* Toggle pagado solo para transacciones normales (no TC) */}
                    {!isCC && (
                      <DropdownMenuItem onClick={() => setTransactionToTogglePaid(transaction)}>
                        {transaction.isPaid ? (
                          <>
                            <X className="mr-2 h-4 w-4" />
                            Marcar como pendiente
                          </>
                        ) : (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Marcar como pagado
                          </>
                        )}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onEdit(transaction)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTransactionToDelete(transaction)} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteTransactionDialog
        transaction={transactionToDelete}
        isPending={isPending}
        onConfirm={handleDelete}
        onClose={() => setTransactionToDelete(null)}
      />

      {/* Toggle Paid Confirmation Dialog */}
      <TogglePaidDialog
        transaction={transactionToTogglePaid}
        isPending={isPending}
        onConfirm={handleConfirmTogglePaid}
        onClose={() => setTransactionToTogglePaid(null)}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteDialog
        open={showBulkDeleteDialog}
        count={selectedIds.size}
        isPending={isPending}
        onConfirm={handleBulkDelete}
        onOpenChange={setShowBulkDeleteDialog}
      />

      {/* Historically Paid Confirmation Dialog */}
      <HistoricallyPaidDialog
        open={showHistoricallyPaidDialog}
        count={selectedIds.size}
        isPending={isPending}
        onMark={() => handleBulkHistoricallyPaid(true)}
        onUnmark={() => handleBulkHistoricallyPaid(false)}
        onOpenChange={setShowHistoricallyPaidDialog}
      />

      {/* Pay Credit Card Dialog */}
      {showPayCCDialog && (
        <BulkPayCreditCardDialog
          projectId={projectId}
          userId={userId}
          transactions={selectedCCTransactions}
          accounts={accounts}
          accountsMap={accountsMap}
          defaultCurrency={defaultCurrency}
          open={showPayCCDialog}
          onOpenChange={(open) => {
            setShowPayCCDialog(open);
            if (!open) {
              setSelectedIds(new Set());
            }
          }}
          onMutationStart={onMutationStart}
          onMutationSuccess={onMutationSuccess}
          onMutationError={onMutationError}
        />
      )}
    </div>
  );
}
