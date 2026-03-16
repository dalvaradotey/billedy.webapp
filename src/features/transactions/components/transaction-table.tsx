'use client';

import { useState, useTransition, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Pencil,
  Trash2,
  Check,
  CheckCircle2,
  Calendar,
  X,
  History,
  CreditCard,
  Store,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
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
  bulkToggleTransactionsPaid,
  bulkUpdateTransactionDates,
  deleteTransaction,
  setTransactionsHistoricallyPaid,
} from '../actions';
import type { TransactionWithCategory } from '../types';
import type { AccountWithEntity } from '@/features/accounts/types';
import { formatCurrency, formatDate } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import { cardStyles } from '@/components/card-styles';
import { BulkPayCreditCardDialog } from './bulk-pay-cc-dialog';

type SortColumn = 'status' | 'date' | 'description' | 'category' | 'amount';
type SortDirection = 'asc' | 'desc';
import {
  DeleteTransactionDialog,
  TogglePaidDialog,
  BulkDeleteDialog,
  BulkTogglePaidDialog,
  BulkDateChangeDialog,
  HistoricallyPaidDialog,
} from './confirmation-dialogs';

export function TransactionTableSkeleton({ rowCount = 5 }: { rowCount?: number }) {
  return (
    <div className={`${cardStyles.base} p-0 overflow-hidden`}>
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
  accounts: AccountWithEntity[];
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
  const [showBulkTogglePaidDialog, setShowBulkTogglePaidDialog] = useState(false);
  const [showBulkDateChangeDialog, setShowBulkDateChangeDialog] = useState(false);
  const [revealedAction, setRevealedAction] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Mapa de cuentas por ID para verificar tipo
  const accountsMap = useMemo(() => {
    const map = new Map<string, AccountWithEntity>();
    accounts.forEach((acc) => map.set(acc.id, acc));
    return map;
  }, [accounts]);

  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn, sortDirection]);

  const getStatusPriority = useCallback((t: TransactionWithCategory) => {
    const acc = accountsMap.get(t.accountId ?? '');
    const isCC = acc?.type === 'credit_card' && t.type === 'expense';
    if (isCC) {
      if (t.paidByTransferId) return 4; // Liquidada
      if (t.isHistoricallyPaid) return 3; // Histórico
      if (t.isPaid) return 2; // Cargado
      return 0; // Pendiente
    }
    return t.isPaid ? 1 : 0; // Pagado o Pendiente
  }, [accountsMap]);

  const sortedTransactions = useMemo(() => {
    if (!sortColumn) return transactions;
    return [...transactions].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'status':
          cmp = getStatusPriority(a) - getStatusPriority(b);
          break;
        case 'date':
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'description':
          cmp = (a.description ?? '').localeCompare(b.description ?? '', 'es');
          break;
        case 'category':
          cmp = (a.categoryName ?? '').localeCompare(b.categoryName ?? '', 'es');
          break;
        case 'amount': {
          const amtA = parseFloat(a.originalAmount) * (a.type === 'expense' ? -1 : 1);
          const amtB = parseFloat(b.originalAmount) * (b.type === 'expense' ? -1 : 1);
          cmp = amtA - amtB;
          break;
        }
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [transactions, sortColumn, sortDirection, getStatusPriority]);

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

  // Obtener transacciones pendientes seleccionadas (incluye TC no liquidadas)
  const selectedUnpaid = useMemo(() => {
    return transactions.filter((t) => {
      if (!selectedIds.has(t.id)) return false;
      const account = accountsMap.get(t.accountId ?? '');
      const isCC = account?.type === 'credit_card' && t.type === 'expense';
      // Para TC: elegible si no está pagada y no está liquidada
      if (isCC) return !t.isPaid && !t.paidByTransferId && !t.isHistoricallyPaid;
      // Para regulares: elegible si no está pagada
      return !t.isPaid;
    });
  }, [transactions, selectedIds, accountsMap]);

  // Totales de selección
  const selectionTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (!selectedIds.has(t.id)) continue;
      const amount = Math.abs(parseFloat(t.originalAmount));
      if (t.type === 'income') income += amount;
      else expense += amount;
    }
    return { income, expense };
  }, [transactions, selectedIds]);

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

  const handleBulkTogglePaid = () => {
    const toastId = toast.loading(`Marcando ${selectedUnpaid.length} transacciones como pagadas...`);
    onMutationStart?.();
    setShowBulkTogglePaidDialog(false);
    startTransition(async () => {
      const result = await bulkToggleTransactionsPaid(userId, {
        projectId,
        transactionIds: selectedUnpaid.map(t => t.id),
        isPaid: true,
      });
      setSelectedIds(new Set());
      if (result.success) {
        onMutationSuccess?.(toastId, `${result.data.updatedCount} transacciones marcadas como pagadas`);
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleBulkDateChange = (date: Date) => {
    const toastId = toast.loading(`Cambiando fecha de ${selectedIds.size} transacciones...`);
    onMutationStart?.();
    setShowBulkDateChangeDialog(false);
    startTransition(async () => {
      const result = await bulkUpdateTransactionDates(userId, {
        projectId,
        transactionIds: Array.from(selectedIds),
        date,
      });
      setSelectedIds(new Set());
      if (result.success) {
        onMutationSuccess?.(toastId, `Fecha actualizada en ${result.data.updatedCount} transacciones`);
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

  // Resetear reveal cuando cambia la selección
  useEffect(() => {
    setRevealedAction(null);
  }, [selectedIds.size]);

  // Acciones masivas para mobile (reveal-on-tap)
  const mobileActions = useMemo(() => {
    const actions: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; variant: 'outline' | 'destructive'; onExecute: () => void }[] = [];
    if (selectedUnpaid.length > 0) {
      actions.push({ id: 'paid', label: `Pagado (${selectedUnpaid.length})`, icon: CheckCircle2, variant: 'outline', onExecute: () => setShowBulkTogglePaidDialog(true) });
    }
    actions.push({ id: 'date', label: 'Fecha', icon: Calendar, variant: 'outline', onExecute: () => setShowBulkDateChangeDialog(true) });
    if (selectedCCTransactions.length > 0) {
      actions.push({ id: 'cc', label: `Pagar TC (${selectedCCTransactions.length})`, icon: CreditCard, variant: 'outline', onExecute: () => setShowPayCCDialog(true) });
    }
    actions.push({ id: 'history', label: 'Histórico', icon: History, variant: 'outline', onExecute: () => setShowHistoricallyPaidDialog(true) });
    actions.push({ id: 'delete', label: 'Eliminar', icon: Trash2, variant: 'destructive', onExecute: () => setShowBulkDeleteDialog(true) });
    return actions;
  }, [selectedUnpaid.length, selectedCCTransactions.length]);

  // Si la acción revelada ya no existe (ej: se deseleccionaron las pendientes), resetear
  useEffect(() => {
    if (revealedAction && !mobileActions.find((a) => a.id === revealedAction)) {
      setRevealedAction(null);
    }
  }, [revealedAction, mobileActions]);

  return (
    <div className="space-y-2">
      {/* Sticky bottom bar de acciones masivas */}
      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-0 inset-x-0 z-[60] px-4 animate-in slide-in-from-bottom-2 duration-200"
          style={{ paddingBottom: `calc(0.5rem + env(safe-area-inset-bottom))` }}
        >
          <div className="relative rounded-2xl overflow-hidden max-w-screen-lg mx-auto">
            {/* Glass background */}
            <div className="absolute inset-0 bg-background/85 dark:bg-background/75 backdrop-blur-2xl backdrop-saturate-150" />
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08]" />

            {/* ── Mobile layout (reveal-on-tap) ── */}
            <div className="relative sm:hidden px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {selectedIds.size} seleccionada{selectedIds.size > 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    {selectionTotals.income > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400">+{formatCurrency(selectionTotals.income, defaultCurrency)}</span>
                    )}
                    {selectionTotals.expense > 0 && (
                      <span className="text-red-600 dark:text-red-400">-{formatCurrency(selectionTotals.expense, defaultCurrency)}</span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedIds(new Set()); setRevealedAction(null); }}>
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
              </div>
              <div className="flex items-center gap-2 justify-center min-h-[36px]">
                {revealedAction === null ? (
                  // Estado inicial: iconos
                  mobileActions.map((action) => (
                    <Button
                      key={action.id}
                      variant={action.variant}
                      size="icon"
                      onClick={() => setRevealedAction(action.id)}
                      disabled={isPending}
                    >
                      <action.icon className="h-4 w-4" />
                    </Button>
                  ))
                ) : (
                  // Estado revelado: dots + botón expandido
                  <>
                    {mobileActions.map((action) => {
                      if (action.id === revealedAction) {
                        return (
                          <Button
                            key={action.id}
                            variant={action.variant}
                            size="sm"
                            onClick={() => { action.onExecute(); setRevealedAction(null); }}
                            disabled={isPending}
                            className="animate-in fade-in zoom-in-95 duration-150"
                          >
                            <action.icon className="h-4 w-4 mr-2" />
                            {action.label}
                          </Button>
                        );
                      }
                      return (
                        <button
                          key={action.id}
                          onClick={() => setRevealedAction(action.id)}
                          className="w-2 h-2 rounded-full bg-muted-foreground/30 hover:bg-muted-foreground/50 transition-colors"
                        />
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* ── Desktop layout ── */}
            <div className="relative hidden sm:flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {selectedIds.size} seleccionada{selectedIds.size > 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2 text-xs">
                  {selectionTotals.income > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">+{formatCurrency(selectionTotals.income, defaultCurrency)}</span>
                  )}
                  {selectionTotals.expense > 0 && (
                    <span className="text-red-600 dark:text-red-400 font-medium">-{formatCurrency(selectionTotals.expense, defaultCurrency)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedUnpaid.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBulkTogglePaidDialog(true)}
                    disabled={isPending}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Pagado ({selectedUnpaid.length})
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkDateChangeDialog(true)}
                  disabled={isPending}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Fecha
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
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`${cardStyles.base} p-0 overflow-hidden`}>
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
            <TableHead className="w-[70px]">
              <SortableHeader column="status" label="Estado" current={sortColumn} direction={sortDirection} onSort={handleSort} />
            </TableHead>
            <TableHead>
              <SortableHeader column="date" label="Fecha" current={sortColumn} direction={sortDirection} onSort={handleSort} />
            </TableHead>
            <TableHead>
              <SortableHeader column="description" label="Descripción" current={sortColumn} direction={sortDirection} onSort={handleSort} />
            </TableHead>
            <TableHead>
              <SortableHeader column="category" label="Categoría" current={sortColumn} direction={sortDirection} onSort={handleSort} />
            </TableHead>
            <TableHead className="text-right">
              <SortableHeader column="amount" label="Monto" current={sortColumn} direction={sortDirection} onSort={handleSort} className="justify-end" />
            </TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTransactions.map((transaction) => {
            const isCC = isCreditCardTransaction(transaction);
            const settled = isSettled(transaction);
            return (
            <TableRow key={transaction.id} className={`hover:bg-blue-50 dark:hover:bg-blue-950/30 ${(isCC ? settled : transaction.isPaid) ? 'opacity-60' : ''}`}>
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
                  ) : transaction.isPaid ? (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Cargado
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
                    style={{ backgroundColor: transaction.categoryColor ?? undefined }}
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
                    {/* Toggle pagado - para TC solo si no está liquidada */}
                    {(!isCC || !settled) && (
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

      {/* Spacer para que las últimas filas no queden tapadas por la sticky bar */}
      {selectedIds.size > 0 && <div className="h-24" />}

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

      {/* Bulk Toggle Paid Confirmation Dialog */}
      <BulkTogglePaidDialog
        open={showBulkTogglePaidDialog}
        count={selectedUnpaid.length}
        isPending={isPending}
        onConfirm={handleBulkTogglePaid}
        onOpenChange={setShowBulkTogglePaidDialog}
      />

      {/* Bulk Date Change Dialog */}
      <BulkDateChangeDialog
        open={showBulkDateChangeDialog}
        count={selectedIds.size}
        isPending={isPending}
        onConfirm={handleBulkDateChange}
        onOpenChange={setShowBulkDateChangeDialog}
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

function SortableHeader({
  column,
  label,
  current,
  direction,
  onSort,
  className,
}: {
  column: SortColumn;
  label: string;
  current: SortColumn | null;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
  className?: string;
}) {
  const isActive = current === column;
  return (
    <button
      onClick={() => onSort(column)}
      className={cn(
        'inline-flex items-center gap-1 hover:text-foreground transition-colors -ml-1 px-1 py-0.5 rounded',
        isActive ? 'text-foreground' : 'text-muted-foreground',
        className,
      )}
    >
      {label}
      {isActive ? (
        direction === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </button>
  );
}
