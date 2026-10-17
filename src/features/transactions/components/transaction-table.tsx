'use client';

import { NATURE_LABELS } from '../nature';
import { useState, useTransition, useCallback, useMemo } from 'react';
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
  ShieldCheck,
  ShieldX,
  MoreHorizontal,
  MoreVertical,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  toggleTransactionPaid,
  toggleTransactionReconciled,
  bulkToggleTransactionsPaid,
  bulkToggleTransactionsReconciled,
  bulkUpdateTransactionDates,
  deleteTransaction,
  setTransactionsHistoricallyPaid,
} from '../actions';
import type { TransactionWithCategory } from '../types';
import type { AccountWithEntity } from '@/features/accounts/types';
import { formatCurrency, formatDate } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import { TONE_CLASSES, toneForName } from '@/lib/pulse-tone';
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
  BulkToggleReconciledDialog,
} from './confirmation-dialogs';

export function TransactionTableSkeleton({ rowCount = 5 }: { rowCount?: number }) {
  const tones = ['amber', 'sky', 'jade', 'rose', 'violet'] as const;
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando movimientos">
      {[Math.min(2, rowCount), Math.max(1, rowCount - 2)].map((count, g) => (
        <div key={g}>
          <Skeleton className="mb-2.5 ml-1 h-3 w-28 rounded-full" />
          <div className="rounded-[22px] border border-line bg-surface px-3.5 py-0.5">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="flex min-h-[66px] items-center gap-3 border-b border-surface-3 last:border-0">
                <Skeleton tone={tones[(g * 2 + i) % tones.length]} className="h-10 w-10 rounded-[13px]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-32 rounded-full" />
                  <Skeleton tone="quiet" className="h-2.5 w-24 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
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
  const [showBulkToggleReconciledDialog, setShowBulkToggleReconciledDialog] = useState(false);
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

  const handleToggleReconciled = (transaction: TransactionWithCategory) => {
    const newState = !transaction.isReconciled;
    const toastId = toast.loading(newState ? 'Marcando como conciliada...' : 'Desmarcando conciliada...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await toggleTransactionReconciled(transaction.id, userId, { isReconciled: newState });
      if (result.success) {
        onMutationSuccess?.(toastId, newState ? 'Marcada como conciliada' : 'Conciliación removida');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleBulkToggleReconciled = (isReconciled: boolean) => {
    const action = isReconciled ? 'Marcando' : 'Desmarcando';
    const toastId = toast.loading(`${action} ${selectedIds.size} transacciones...`);
    onMutationStart?.();
    setShowBulkToggleReconciledDialog(false);
    startTransition(async () => {
      const result = await bulkToggleTransactionsReconciled(userId, {
        projectId,
        transactionIds: Array.from(selectedIds),
        isReconciled,
      });
      setSelectedIds(new Set());
      if (result.success) {
        const actionDone = isReconciled ? 'marcadas como conciliadas' : 'desmarcadas';
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

  // Agrupar por día cuando el orden es por fecha (el orden por defecto)
  const groupByDay = sortColumn === null || sortColumn === 'date';
  const dayGroups = useMemo(() => {
    if (!groupByDay) return [{ key: 'all', label: '', rows: sortedTransactions, income: 0, spent: 0 }];
    const groups: { key: string; label: string; rows: TransactionWithCategory[]; income: number; spent: number }[] = [];
    for (const t of sortedTransactions) {
      const key = new Date(t.date).toISOString().slice(0, 10);
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: dayLabel(key), rows: [], income: 0, spent: 0 };
        groups.push(g);
      }
      const amount = parseFloat(t.baseAmount);
      g.rows.push(t);
      // Pagos de tarjeta y traspasos entre tus cuentas no son ni ingreso ni gasto, y lo
      // que entra a una tarjeta (diferencias, devoluciones) tampoco es ingreso
      if (t.linkedTransactionId) continue;
      if (t.type === 'income' && accountsMap.get(t.accountId ?? '')?.type === 'credit_card') continue;
      // La plata de otra persona que entra no es ingreso tuyo
      if (t.type === 'income' && t.nature === 'external') continue;
      // El aporte a una inversión no es gasto
      if (t.investmentRole === 'aporte') continue;
      if (t.type === 'income') g.income += amount;
      if (t.type === 'expense') g.spent += amount;
    }
    return groups;
  }, [sortedTransactions, groupByDay, accountsMap]);
  const maxDaySpent = Math.max(1, ...dayGroups.map((g) => g.spent));
  const allSelected = transactions.length > 0 && selectedIds.size === transactions.length;

  return (
    <div className="space-y-2">
      {/* Barra de acciones masivas: pastilla crema sobre la navegación */}
      {selectedIds.size > 0 && (
        <div
          className="fixed inset-x-0 bottom-[84px] z-[60] px-4 animate-in slide-in-from-bottom-2 duration-200 md:bottom-6 md:left-[248px] md:px-8"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto flex max-w-[1136px] items-center gap-2 rounded-[22px] bg-cream p-1.5 pl-4 text-cream-ink shadow-[0_12px_32px_rgba(8,6,12,0.5)]">
            <div className="flex min-w-0 shrink-0 flex-col">
              <span className="text-[13px] font-extrabold">
                {selectedIds.size} {selectedIds.size === 1 ? 'elegido' : 'elegidos'}
              </span>
              <span className="num text-[11px] font-semibold text-[#6B6172]">
                {selectionTotals.income > 0 && `+${formatCurrency(selectionTotals.income, defaultCurrency)} `}
                {selectionTotals.expense > 0 && `−${formatCurrency(selectionTotals.expense, defaultCurrency)}`}
              </span>
            </div>
            <div className="scrollbar-hide ml-auto flex items-center gap-1.5 overflow-x-auto">
              {selectedUnpaid.length > 0 && (
                <BulkButton tone="jade" icon={CheckCircle2} disabled={isPending} onClick={() => setShowBulkTogglePaidDialog(true)}>
                  Pagado ({selectedUnpaid.length})
                </BulkButton>
              )}
              <BulkButton tone="sky" icon={ShieldCheck} disabled={isPending} onClick={() => setShowBulkToggleReconciledDialog(true)}>
                Conciliar
              </BulkButton>
              {selectedCCTransactions.length > 0 && (
                <BulkButton tone="amber" icon={CreditCard} disabled={isPending} onClick={() => setShowPayCCDialog(true)}>
                  Pagar TC ({selectedCCTransactions.length})
                </BulkButton>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Más acciones"
                    disabled={isPending}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream-ink text-cream"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="rounded-2xl">
                  <DropdownMenuItem onClick={() => setShowBulkDateChangeDialog(true)}>
                    <Calendar className="h-4 w-4" />Cambiar fecha
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowHistoricallyPaidDialog(true)}>
                    <History className="h-4 w-4" />Histórico
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSelectAll}>
                    <CheckCircle2 className="h-4 w-4" />{allSelected ? 'Quitar todos' : 'Elegir todos'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowBulkDeleteDialog(true)} className="text-coral-text focus:text-coral-text">
                    <Trash2 className="h-4 w-4" />Eliminar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedIds(new Set())}>
                    <X className="h-4 w-4" />Cancelar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      )}

      {/* Orden */}
      <div className="flex items-center justify-between gap-2 px-1">
        <label className="flex min-h-10 items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={allSelected} onCheckedChange={handleSelectAll} disabled={isPending} aria-label="Elegir todos" />
          Elegir todos
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-muted-foreground hover:bg-surface-2 hover:text-foreground">
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortColumn ? `${SORT_LABELS[sortColumn]} ${sortDirection === 'asc' ? '↑' : '↓'}` : 'Más recientes'}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl">
            {(Object.keys(SORT_LABELS) as SortColumn[]).map((col) => (
              <DropdownMenuItem key={col} onClick={() => handleSort(col)}>
                {SORT_LABELS[col]}
                {sortColumn === col && (sortDirection === 'asc' ? <ArrowUp className="ml-auto h-3.5 w-3.5" /> : <ArrowDown className="ml-auto h-3.5 w-3.5" />)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-4">
        {dayGroups.map((group) => (
          <section key={group.key} aria-label={group.label || 'Movimientos'}>
            {groupByDay && (
              /* Encabezado del día: queda pegado arriba hasta que llega el siguiente */
              <div className="sticky top-16 z-20 -mx-4 flex items-center gap-2.5 bg-background/95 px-5 py-2 backdrop-blur-sm md:top-0 md:-mx-2 md:px-3">
                <span className="text-[13px] font-extrabold">{group.label}</span>
                <span aria-hidden className="h-1 min-w-4 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-1 rounded-full bg-coral" style={{ width: `${Math.round((group.spent / maxDaySpent) * 100)}%` }} />
                </span>
                {/* Lo que entró y lo que salió ese día (el neto no dice mucho) */}
                {group.income > 0 && (
                  <span className="num text-xs font-extrabold text-jade" aria-label={`Entró ${formatCurrency(group.income, defaultCurrency)}`}>
                    +{formatCurrency(group.income, defaultCurrency)}
                  </span>
                )}
                {group.spent > 0 && (
                  <span className="num text-xs font-extrabold text-coral-text" aria-label={`Salió ${formatCurrency(group.spent, defaultCurrency)}`}>
                    −{formatCurrency(group.spent, defaultCurrency)}
                  </span>
                )}
              </div>
            )}
            <ul className="rounded-[22px] border border-line bg-surface px-3.5 py-0.5 md:px-4">
              {group.rows.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  isCC={isCreditCardTransaction(transaction)}
                  settled={isSettled(transaction)}
                  selected={selectedIds.has(transaction.id)}
                  showDate={!groupByDay}
                  disabled={isPending}
                  onToggleSelect={() => handleToggleSelect(transaction.id)}
                  onEdit={() => onEdit(transaction)}
                  onTogglePaid={() => setTransactionToTogglePaid(transaction)}
                  onToggleReconciled={() => handleToggleReconciled(transaction)}
                  onDelete={() => setTransactionToDelete(transaction)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Espacio para que las últimas filas no queden tapadas por la barra de selección */}
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

      {/* Bulk Toggle Reconciled Dialog */}
      <BulkToggleReconciledDialog
        open={showBulkToggleReconciledDialog}
        count={selectedIds.size}
        isPending={isPending}
        onMark={() => handleBulkToggleReconciled(true)}
        onUnmark={() => handleBulkToggleReconciled(false)}
        onOpenChange={setShowBulkToggleReconciledDialog}
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

const SORT_LABELS: Record<SortColumn, string> = {
  date: 'Fecha',
  status: 'Estado',
  description: 'Descripción',
  category: 'Categoría',
  amount: 'Monto',
};

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "Domingo 11 oct" (fecha como día calendario, sin zona horaria) */
function dayLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

const BULK_TONES = {
  jade: 'bg-jade text-jade-ink',
  sky: 'bg-sky text-sky-ink',
  amber: 'bg-amber text-amber-ink',
} as const;

function BulkButton({
  tone,
  icon: Icon,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone: keyof typeof BULK_TONES; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <button
      type="button"
      className={cn('flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-extrabold disabled:opacity-50', BULK_TONES[tone])}
      {...props}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function TransactionRow({
  transaction: t,
  isCC,
  settled,
  selected,
  showDate,
  disabled,
  onToggleSelect,
  onEdit,
  onTogglePaid,
  onToggleReconciled,
  onDelete,
}: {
  transaction: TransactionWithCategory;
  isCC: boolean;
  settled: boolean;
  selected: boolean;
  showDate: boolean;
  disabled: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onTogglePaid: () => void;
  onToggleReconciled: () => void;
  onDelete: () => void;
}) {
  const income = t.type === 'income';
  const tone = TONE_CLASSES[income ? 'jade' : toneForName(t.categoryName)];
  const state = isCC
    ? t.paidByTransferId
      ? { label: 'liquidada', className: 'text-faint' }
      : t.isHistoricallyPaid
        ? { label: 'histórico', className: 'text-faint' }
        : t.isPaid
          ? { label: 'cargada', className: 'text-faint' }
          : { label: 'pendiente', className: 'text-amber-text' }
    : t.isPaid
      ? null
      : { label: 'pendiente', className: 'text-amber-text' };
  const meta = [showDate ? formatDate(t.date) : null, t.categoryName, t.accountName].filter(Boolean).join(' · ');
  const nature = t.nature !== 'own' ? NATURE_TAGS[t.nature] : null;

  return (
    <li className={cn('flex min-h-[66px] items-center gap-3 border-b border-surface-3 last:border-0', settled && 'opacity-60')}>
      {/* El ícono también sirve para elegir el movimiento */}
      <button
        type="button"
        onClick={onToggleSelect}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={selected ? `Quitar ${t.description} de la selección` : `Elegir ${t.description}`}
        className={cn(
          'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] text-sm font-extrabold transition-colors',
          selected ? 'bg-cream text-cream-ink' : cn(tone.soft, tone.text)
        )}
      >
        {selected ? (
          <Check className="h-5 w-5" strokeWidth={3} />
        ) : t.entityImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.entityImageUrl} alt="" className="h-7 w-7 rounded-2xl bg-white object-contain p-0.5" />
        ) : t.entityId ? (
          <Store className="h-[18px] w-[18px]" />
        ) : (
          (t.categoryName ?? t.description).charAt(0).toUpperCase()
        )}
        {t.isReconciled && !selected && (
          <span title="Conciliada" className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-surface bg-sky">
            <Check className="h-2 w-2 text-sky-ink" strokeWidth={4} />
          </span>
        )}
      </button>

      <button type="button" onClick={onEdit} className="min-w-0 flex-1 py-2 text-left">
        <span className={cn('block truncate text-sm font-bold', settled && 'line-through')}>{t.description}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">{meta}</span>
          {nature && (
            <span className={cn('shrink-0 rounded-full px-2 py-px text-[11px] font-bold', nature.className)}>{nature.label}</span>
          )}
        </span>
        {t.notes && <span className="mt-0.5 hidden truncate text-xs text-faint md:block">{t.notes}</span>}
      </button>

      <span className="shrink-0 text-right">
        <span className={cn('num block text-[15px] font-extrabold', income ? 'text-jade' : 'text-foreground')}>
          {income ? '+' : '−'}
          {formatCurrency(t.originalAmount, t.originalCurrency)}
        </span>
        {state && <span className={cn('block text-[11px] font-bold', state.className)}>{state.label}</span>}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={`Acciones de ${t.description}`}
            className="-mr-1.5 flex h-11 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-2xl">
          {(!isCC || !settled) && (
            <DropdownMenuItem onClick={onTogglePaid}>
              {t.isPaid ? <><X className="h-4 w-4" />Marcar como pendiente</> : <><Check className="h-4 w-4" />Marcar como pagado</>}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onToggleReconciled}>
            {t.isReconciled ? <><ShieldX className="h-4 w-4" />Desmarcar conciliada</> : <><ShieldCheck className="h-4 w-4" />Marcar como conciliada</>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4" />Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-coral-text focus:text-coral-text">
            <Trash2 className="h-4 w-4" />Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

const NATURE_TAGS: Record<string, { label: string; className: string }> = {
  external: { label: NATURE_LABELS.external.toLowerCase(), className: 'bg-sky-soft text-sky-text' },
  reimbursable: { label: NATURE_LABELS.reimbursable.toLowerCase(), className: 'bg-amber-soft text-amber-text' },
  fund: { label: NATURE_LABELS.fund.toLowerCase(), className: 'bg-violet-soft text-violet-text' },
  reimbursement: { label: NATURE_LABELS.reimbursement.toLowerCase(), className: 'bg-jade-soft text-jade-text' },
};
