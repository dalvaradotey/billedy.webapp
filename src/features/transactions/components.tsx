'use client';

import { useState, useTransition, useEffect, useCallback, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowLeftRight,
  Search,
  Filter,
  Calendar,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CategorySelector } from '@/components/category-selector';
import { CurrencyInput } from '@/components/currency-input';
import { EntitySelector } from '@/components/entity-selector';
import {
  createTransaction,
  updateTransaction,
  toggleTransactionPaid,
  deleteTransaction,
  createAccountTransfer,
  payCreditCardTransactions,
  fetchUnpaidCCTransactions,
  setTransactionsHistoricallyPaid,
} from './actions';
import { createTransactionSchema, createAccountTransferSchema, type CreateTransactionInput, type CreateAccountTransferInput, type PayCreditCardInput } from './schemas';
import type { TransactionWithCategory, TransactionSummary } from './types';
import type { Category } from '@/features/categories/types';
import type { Account } from '@/features/accounts/types';
import { ACCOUNT_TYPE_LABELS, type AccountType } from '@/features/accounts/types';
import type { Entity } from '@/features/entities/types';
import { Building2, PiggyBank, Wallet, CreditCard, Store } from 'lucide-react';

function formatCurrency(amount: number | string, currency: string = 'CLP'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

interface Budget {
  id: string;
  name: string;
  categoryId: string | null;
}

interface BillingCycleOption {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface TransactionListProps {
  transactions: TransactionWithCategory[];
  categories: Category[];
  accounts: Account[];
  budgets: Budget[];
  entities: Entity[];
  summary: TransactionSummary;
  projectId: string;
  userId: string;
  defaultCurrency: string;
  defaultStartDate?: string;
  defaultEndDate?: string;
  cycles?: BillingCycleOption[];
  selectedCycleId?: string;
}

export function TransactionList({
  transactions,
  categories,
  accounts,
  budgets,
  entities,
  summary,
  projectId,
  userId,
  defaultCurrency,
  defaultStartDate,
  defaultEndDate,
  cycles = [],
  selectedCycleId,
}: TransactionListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithCategory | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingToast, setPendingToast] = useState<{ id: string | number; message: string } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Ref para trackear los datos anteriores
  const prevTransactionsRef = useRef<TransactionWithCategory[]>(transactions);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detectar cuando transactions cambia y ocultar loading
  useEffect(() => {
    const dataChanged = transactions !== prevTransactionsRef.current ||
                        transactions.length !== prevTransactionsRef.current.length ||
                        JSON.stringify(transactions.map(t => t.id)) !== JSON.stringify(prevTransactionsRef.current.map(t => t.id));

    if (isRefreshing && dataChanged) {
      if (pendingToast) {
        toast.success(pendingToast.message, { id: pendingToast.id });
        setPendingToast(null);
      }
      setIsRefreshing(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    prevTransactionsRef.current = transactions;
  }, [transactions, isRefreshing, pendingToast]);

  // Fallback timeout
  useEffect(() => {
    if (isRefreshing && !timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        if (pendingToast) {
          toast.success(pendingToast.message, { id: pendingToast.id });
          setPendingToast(null);
        }
        setIsRefreshing(false);
        timeoutRef.current = null;
      }, 5000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isRefreshing, pendingToast]);

  const onMutationStart = useCallback(() => {
    setIsRefreshing(true);
  }, []);

  const onMutationSuccess = useCallback((toastId: string | number, message: string) => {
    setPendingToast({ id: toastId, message });
  }, []);

  const onMutationError = useCallback((toastId: string | number, error: string) => {
    toast.error(error, { id: toastId });
    setIsRefreshing(false);
    setPendingToast(null);
  }, []);

  const handleEdit = (transaction: TransactionWithCategory) => {
    setEditingTransaction(transaction);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingTransaction(null);
  };

  const handleOpenDialog = () => {
    setEditingTransaction(null);
    setIsDialogOpen(true);
  };

  const currentType = searchParams.get('type') ?? 'all';
  const currentPaid = searchParams.get('paid') ?? 'all';
  const currentStartDate = searchParams.get('startDate') ?? defaultStartDate ?? '';
  const currentEndDate = searchParams.get('endDate') ?? defaultEndDate ?? '';

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all' || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/dashboard/transactions?${params.toString()}`);
  };

  const handleDateChange = (key: 'startDate' | 'endDate', value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Al cambiar fecha manualmente, quitar el cycleId
    params.delete('cycleId');
    router.push(`/dashboard/transactions?${params.toString()}`);
  };

  const handleCycleChange = (cycleId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (cycleId === 'custom') {
      // Modo personalizado: quitar cycleId y dejar fechas como están
      params.delete('cycleId');
    } else {
      // Seleccionar un ciclo: setear cycleId y actualizar fechas del ciclo
      const selectedCycle = cycles.find((c) => c.id === cycleId);
      if (selectedCycle) {
        params.set('cycleId', cycleId);
        params.set('startDate', selectedCycle.startDate);
        params.set('endDate', selectedCycle.endDate);
      }
    }
    router.push(`/dashboard/transactions?${params.toString()}`);
  };

  const hasCycles = cycles.length > 0;
  const currentCycleId = searchParams.get('cycleId') ?? selectedCycleId ?? 'custom';

  // Generar texto de feedback del período
  const getDateRangeFeedback = () => {
    const formatDateRange = (start: string, end: string) => {
      const startDate = new Date(start + 'T12:00:00');
      const endDate = new Date(end + 'T12:00:00');
      const formatOptions: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
      const startStr = startDate.toLocaleDateString('es-CL', formatOptions);
      const endStr = endDate.toLocaleDateString('es-CL', { ...formatOptions, year: 'numeric' });
      return `${startStr} - ${endStr}`;
    };

    // Si hay un ciclo seleccionado (no custom)
    if (hasCycles && currentCycleId !== 'custom') {
      const cycle = cycles.find((c) => c.id === currentCycleId);
      if (cycle) {
        return cycle.name;
      }
    }

    // Si no hay ciclos, mostrar "Últimos 30 días" si las fechas coinciden con el default
    if (!hasCycles && !searchParams.get('startDate') && !searchParams.get('endDate')) {
      return 'Últimos 30 días';
    }

    // Fechas personalizadas
    if (currentStartDate && currentEndDate) {
      return formatDateRange(currentStartDate, currentEndDate);
    }

    return '';
  };

  const dateRangeFeedback = getDateRangeFeedback();

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Ingresos"
          value={formatCurrency(summary.totalIncome, defaultCurrency)}
          icon={<ArrowUpCircle className="h-4 w-4 text-green-600" />}
          className="text-green-600"
        />
        <SummaryCard
          title="Gastos"
          value={formatCurrency(summary.totalExpense, defaultCurrency)}
          icon={<ArrowDownCircle className="h-4 w-4 text-red-600" />}
          className="text-red-600"
        />
        <SummaryCard
          title="Balance"
          value={formatCurrency(summary.balance, defaultCurrency)}
          className={summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <SummaryCard
          title="Pendientes"
          value={`${summary.pendingCount} de ${summary.paidCount + summary.pendingCount}`}
          subtitle="transacciones"
        />
      </div>

      {/* Filters Section */}
      <div className="space-y-4">
        {/* Period Filter */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Período</span>
            </div>
            {dateRangeFeedback && (
              <span className="text-sm text-muted-foreground">{dateRangeFeedback}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Cycle Selector - solo si hay ciclos */}
            {hasCycles && (
              <Select value={currentCycleId} onValueChange={handleCycleChange}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Seleccionar ciclo" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id}>
                      {cycle.name} {cycle.status === 'open' && '(actual)'}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Input
              type="date"
              value={currentStartDate}
              onChange={(e) => handleDateChange('startDate', e.target.value)}
              className="w-[140px] h-9"
              placeholder="Desde"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="date"
              value={currentEndDate}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
              className="w-[140px] h-9"
              placeholder="Hasta"
            />
          </div>
        </div>

        {/* Other Filters and Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={currentType} onValueChange={(v) => handleFilterChange('type', v)}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Ingresos</SelectItem>
                <SelectItem value="expense">Gastos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={currentPaid} onValueChange={(v) => handleFilterChange('paid', v)}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="true">Pagados</SelectItem>
                <SelectItem value="false">Pendientes</SelectItem>
              </SelectContent>
            </Select>
          </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={handleOpenDialog}>
              <Plus className="h-4 w-4" />
              Nueva transacción
            </Button>
          </DialogTrigger>
          <TransactionDialogContent
            projectId={projectId}
            userId={userId}
            categories={categories}
            accounts={accounts}
            budgets={budgets}
            entities={entities}
            transaction={editingTransaction}
            defaultCurrency={defaultCurrency}
            onSuccess={handleDialogClose}
            onMutationStart={onMutationStart}
            onMutationSuccess={onMutationSuccess}
            onMutationError={onMutationError}
          />
        </Dialog>
        </div>
      </div>

      {/* Transaction Table */}
      {isRefreshing ? (
        <TransactionTableSkeleton rowCount={Math.max(5, transactions.length)} />
      ) : transactions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          No hay transacciones registradas
        </div>
      ) : (
        <TransactionTable
          transactions={transactions}
          accounts={accounts}
          projectId={projectId}
          userId={userId}
          defaultCurrency={defaultCurrency}
          onEdit={handleEdit}
          onMutationStart={onMutationStart}
          onMutationSuccess={onMutationSuccess}
          onMutationError={onMutationError}
        />
      )}
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}

function SummaryCard({ title, value, subtitle, icon, className }: SummaryCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
        {icon}
        {title}
      </div>
      <div className={`text-2xl font-bold ${className ?? ''}`}>{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

function TransactionTableSkeleton({ rowCount = 5 }: { rowCount?: number }) {
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

interface TransactionTableProps {
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

function TransactionTable({ transactions, accounts, projectId, userId, defaultCurrency, onEdit, onMutationStart, onMutationSuccess, onMutationError }: TransactionTableProps) {
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
                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
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
                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
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
                    transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
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
      <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => !open && setTransactionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar transacción</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar esta transacción? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toggle Paid Confirmation Dialog */}
      <AlertDialog open={!!transactionToTogglePaid} onOpenChange={(open) => !open && setTransactionToTogglePaid(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {transactionToTogglePaid?.isPaid ? 'Marcar como pendiente' : 'Marcar como pagado'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {transactionToTogglePaid?.isPaid
                ? '¿Estás seguro de marcar esta transacción como pendiente?'
                : '¿Estás seguro de marcar esta transacción como pagada?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmTogglePaid} disabled={isPending}>
              {isPending ? 'Procesando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar transacciones</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar {selectedIds.size} transaccion{selectedIds.size > 1 ? 'es' : ''}? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Historically Paid Confirmation Dialog */}
      <AlertDialog open={showHistoricallyPaidDialog} onOpenChange={setShowHistoricallyPaidDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como históricamente pagadas</AlertDialogTitle>
            <AlertDialogDescription>
              Selecciona una opción para las {selectedIds.size} transaccion{selectedIds.size > 1 ? 'es' : ''} seleccionada{selectedIds.size > 1 ? 's' : ''}.
              <br /><br />
              <strong>Marcar:</strong> Indica que estas cuotas fueron pagadas antes de usar la app.
              <br />
              <strong>Desmarcar:</strong> Indica que estas cuotas aún no han sido pagadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleBulkHistoricallyPaid(false)}
              disabled={isPending}
            >
              <X className="mr-2 h-4 w-4" />
              Desmarcar
            </Button>
            <Button
              onClick={() => handleBulkHistoricallyPaid(true)}
              disabled={isPending}
            >
              <Check className="mr-2 h-4 w-4" />
              Marcar como histórico
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

interface TransactionDialogContentProps {
  projectId: string;
  userId: string;
  categories: Category[];
  accounts: Account[];
  budgets: Budget[];
  entities: Entity[];
  transaction: TransactionWithCategory | null;
  defaultCurrency: string;
  onSuccess: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

const AccountTypeIcon = ({ type, className }: { type: AccountType; className?: string }) => {
  const icons = {
    checking: Building2,
    savings: PiggyBank,
    cash: Wallet,
    credit_card: CreditCard,
  };
  const Icon = icons[type];
  return <Icon className={className} />;
};

type FormMode = 'expense' | 'income' | 'transfer';

function TransactionDialogContent({
  projectId,
  userId,
  categories,
  accounts,
  budgets,
  entities,
  transaction,
  defaultCurrency,
  onSuccess,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: TransactionDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localCategories, setLocalCategories] = useState(categories);
  const [formMode, setFormMode] = useState<FormMode>('expense');

  // Transfer form state (separate from main form)
  const [transferFromAccountId, setTransferFromAccountId] = useState('');
  const [transferToAccountId, setTransferToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState<number | undefined>(undefined);
  const [transferDate, setTransferDate] = useState<Date>(new Date());
  const [transferDescription, setTransferDescription] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  // Update local categories when props change
  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const handleCategoryCreated = (newCategory: { id: string; name: string; color: string }) => {
    setLocalCategories((prev) => [...prev, { ...newCategory, projectId, isArchived: false, createdAt: new Date(), updatedAt: new Date() }]);
  };

  // Find default account
  const defaultAccount = accounts.find((a) => a.isDefault && !a.isArchived);
  const activeAccounts = accounts.filter((a) => !a.isArchived);

  // Mapa de cuentas para verificar tipo
  const accountsMap = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach((acc) => map.set(acc.id, acc));
    return map;
  }, [accounts]);

  const getDefaultValues = useCallback(() => {
    if (transaction) {
      return {
        projectId,
        description: transaction.description,
        originalAmount: parseFloat(transaction.originalAmount),
        date: transaction.date,
        type: transaction.type as 'income' | 'expense',
        categoryId: transaction.categoryId,
        budgetId: transaction.budgetId ?? undefined,
        entityId: transaction.entityId ?? undefined,
        isPaid: transaction.isPaid,
        notes: transaction.notes ?? '',
        accountId: transaction.accountId ?? defaultAccount?.id ?? '',
      };
    }
    return {
      projectId,
      description: '',
      originalAmount: undefined as unknown as number,
      date: new Date(),
      type: 'expense' as const,
      categoryId: '',
      budgetId: undefined as string | undefined,
      entityId: undefined as string | undefined,
      isPaid: false,
      notes: '',
      accountId: defaultAccount?.id ?? '',
    };
  }, [transaction, projectId, defaultAccount?.id]);

  const form = useForm<CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: getDefaultValues(),
  });

  // Reset form when transaction changes (for edit mode)
  useEffect(() => {
    form.reset(getDefaultValues());
    // Reset transfer form too
    setTransferFromAccountId(defaultAccount?.id ?? '');
    setTransferToAccountId('');
    setTransferAmount(undefined);
    setTransferDate(new Date());
    setTransferDescription('');
    setTransferNotes('');
    // Reset form mode when editing
    if (transaction) {
      setFormMode(transaction.type as FormMode);
    } else {
      setFormMode('expense');
    }
  }, [transaction, form, getDefaultValues, defaultAccount?.id]);

  const activeCategories = localCategories.filter((c) => !c.isArchived);

  // Detectar si es un gasto en tarjeta de crédito para ocultar el switch de isPaid
  const watchedAccountId = form.watch('accountId');
  const watchedType = form.watch('type');
  const selectedAccount = accountsMap.get(watchedAccountId);
  const isCreditCardExpense = selectedAccount?.type === 'credit_card' && watchedType === 'expense';

  const onSubmit = (data: CreateTransactionInput) => {
    setError(null);
    const toastId = toast.loading(transaction ? 'Actualizando transacción...' : 'Creando transacción...');
    onMutationStart?.();

    startTransition(async () => {
      const result = transaction
        ? await updateTransaction(transaction.id, userId, data)
        : await createTransaction(userId, data);

      if (result.success) {
        form.reset();
        onSuccess();
        onMutationSuccess?.(toastId, transaction ? 'Transacción actualizada' : 'Transacción creada');
      } else {
        setError(result.error);
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const onSubmitTransfer = () => {
    setError(null);

    // Validate transfer fields
    if (!transferFromAccountId) {
      setError('Selecciona una cuenta de origen');
      return;
    }
    if (!transferToAccountId) {
      setError('Selecciona una cuenta de destino');
      return;
    }
    if (transferFromAccountId === transferToAccountId) {
      setError('La cuenta de origen y destino deben ser diferentes');
      return;
    }
    if (!transferAmount || transferAmount <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }

    const toastId = toast.loading('Creando transferencia...');
    onMutationStart?.();

    startTransition(async () => {
      const transferData: CreateAccountTransferInput = {
        projectId,
        fromAccountId: transferFromAccountId,
        toAccountId: transferToAccountId,
        amount: transferAmount,
        date: transferDate,
        description: transferDescription || undefined,
        notes: transferNotes || undefined,
      };

      const result = await createAccountTransfer(userId, transferData);

      if (result.success) {
        // Reset transfer form
        setTransferFromAccountId(defaultAccount?.id ?? '');
        setTransferToAccountId('');
        setTransferAmount(undefined);
        setTransferDate(new Date());
        setTransferDescription('');
        setTransferNotes('');
        onSuccess();
        onMutationSuccess?.(toastId, 'Transferencia creada');
      } else {
        setError(result.error);
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const isEditing = !!transaction;
  const isTransferMode = formMode === 'transfer';

  // Handle form mode change
  const handleModeChange = (mode: FormMode) => {
    setFormMode(mode);
    setError(null);
    if (mode !== 'transfer') {
      form.setValue('type', mode);
    }
  };

  return (
    <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>
          {isEditing ? 'Editar transacción' : isTransferMode ? 'Nueva transferencia' : 'Nueva transacción'}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Modifica los datos de la transacción.'
            : isTransferMode
            ? 'Mueve dinero entre tus cuentas.'
            : 'Registra un nuevo ingreso o gasto.'}
        </DialogDescription>
      </DialogHeader>

      {/* Type Selector - 3 buttons */}
      {!isEditing && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant={formMode === 'expense' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => handleModeChange('expense')}
          >
            <ArrowDownCircle className="mr-2 h-4 w-4" />
            Gasto
          </Button>
          <Button
            type="button"
            variant={formMode === 'income' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => handleModeChange('income')}
          >
            <ArrowUpCircle className="mr-2 h-4 w-4" />
            Ingreso
          </Button>
          <Button
            type="button"
            variant={formMode === 'transfer' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => handleModeChange('transfer')}
          >
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Transferencia
          </Button>
        </div>
      )}

      {/* Transfer Form */}
      {isTransferMode && !isEditing ? (
        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          {/* Amount and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Monto</label>
              <CurrencyInput
                value={transferAmount}
                onChange={setTransferAmount}
                currency={defaultCurrency}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha</label>
              <Input
                type="date"
                value={transferDate.toISOString().split('T')[0]}
                onChange={(e) => setTransferDate(new Date(e.target.value + 'T12:00:00'))}
              />
            </div>
          </div>

          {/* From Account */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Cuenta origen</label>
            <Select value={transferFromAccountId} onValueChange={setTransferFromAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona cuenta de origen" />
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id} disabled={acc.id === transferToAccountId}>
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
            <Select value={transferToAccountId} onValueChange={setTransferToAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona cuenta de destino" />
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id} disabled={acc.id === transferFromAccountId}>
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
              value={transferDescription}
              onChange={(e) => setTransferDescription(e.target.value)}
            />
          </div>

          {/* Notes (optional) */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Notas (opcional)</label>
            <Input
              placeholder="Notas adicionales..."
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" onClick={onSubmitTransfer} disabled={isPending} className="w-full sm:w-auto">
              {isPending ? 'Creando...' : 'Crear transferencia'}
            </Button>
          </DialogFooter>
        </div>
      ) : (
        /* Regular Transaction Form */
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto flex-1 pr-2">
            {/* Type Selector for editing */}
            {isEditing && (
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={field.value === 'expense' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => field.onChange('expense')}
                      >
                        <ArrowDownCircle className="mr-2 h-4 w-4" />
                        Gasto
                      </Button>
                      <Button
                        type="button"
                        variant={field.value === 'income' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => field.onChange('income')}
                      >
                        <ArrowUpCircle className="mr-2 h-4 w-4" />
                        Ingreso
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Amount and Date */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="originalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                        currency={defaultCurrency}
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
                        value={field.value instanceof Date
                          ? field.value.toISOString().split('T')[0]
                          : String(field.value).split('T')[0]}
                        onChange={(e) => field.onChange(new Date(e.target.value + 'T12:00:00'))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Supermercado Jumbo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Budget (optional) */}
            {budgets.length > 0 && (
              <FormField
                control={form.control}
                name="budgetId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Presupuesto (opcional)</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        const budgetId = value === '_none_' ? null : value;
                        field.onChange(budgetId);
                        // Auto-select category if budget has one
                        if (budgetId) {
                          const selectedBudget = budgets.find((b) => b.id === budgetId);
                          if (selectedBudget?.categoryId) {
                            form.setValue('categoryId', selectedBudget.categoryId);
                          }
                        }
                      }}
                      value={field.value ?? '_none_'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sin presupuesto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_none_">Sin presupuesto</SelectItem>
                        {budgets.map((budget) => (
                          <SelectItem key={budget.id} value={budget.id}>
                            {budget.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Category */}
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <FormControl>
                    <CategorySelector
                      categories={activeCategories}
                      value={field.value}
                      onValueChange={(value) => field.onChange(value ?? '')}
                      projectId={projectId}
                      userId={userId}
                      placeholder="Selecciona una categoría"
                      onCategoryCreated={handleCategoryCreated}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Account */}
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una cuenta" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          <div className="flex items-center gap-2">
                            <AccountTypeIcon type={acc.type as AccountType} className="h-4 w-4" />
                            {acc.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Entity (optional) */}
            {entities.length > 0 && (
              <FormField
                control={form.control}
                name="entityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entidad (opcional)</FormLabel>
                    <FormControl>
                      <EntitySelector
                        entities={entities}
                        value={field.value}
                        onValueChange={(value) => field.onChange(value)}
                        placeholder="Selecciona una entidad"
                        searchPlaceholder="Buscar entidad..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Notas adicionales..." {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Paid Switch - oculto para gastos en TC (siempre se marcan como pagados automáticamente) */}
            {!isCreditCardExpense && (
              <FormField
                control={form.control}
                name="isPaid"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Marcar como pagado</FormLabel>
                      <p className="text-[0.8rem] text-muted-foreground">
                        Indica si esta transacción ya fue pagada
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear transacción'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      )}
    </DialogContent>
  );
}

// ============================================================================
// PAGO DE TARJETA DE CRÉDITO
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

  // Filtrar transacciones pendientes de pago (sin paidByTransferId y no históricas)
  const unpaidTransactions = transactions.filter(
    (t) => t.accountId === creditCardAccount.id && t.type === 'expense' && !t.paidByTransferId && !t.isHistoricallyPaid
  );

  // Calcular total seleccionado
  const selectedTotal = unpaidTransactions
    .filter((t) => selectedIds.has(t.id))
    .reduce((sum, t) => sum + parseFloat(t.baseAmount), 0);

  // Reset al abrir
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
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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
        toast.success(
          `Pago realizado: ${formatCurrency(result.data.totalPaid, defaultCurrency)}`,
          { id: toastId }
        );
        setOpen(false);
        onSuccess?.();
      } else {
        toast.error(result.error, { id: toastId });
        setError(result.error);
      }
    });
  };

  // Solo cuentas no-TC como origen
  const availableSourceAccounts = sourceAccounts.filter(
    (a) => a.type !== 'credit_card' && !a.isArchived && a.id !== creditCardAccount.id
  );

  if (unpaidTransactions.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CreditCard className="mr-2 h-4 w-4" />
          Pagar tarjeta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pagar {creditCardAccount.name}</DialogTitle>
          <DialogDescription>
            Selecciona las transacciones a pagar y la cuenta de origen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1">
          {/* Cuenta origen */}
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

          {/* Lista de transacciones */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Transacciones pendientes ({unpaidTransactions.length})
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedIds.size === unpaidTransactions.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
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
                  {unpaidTransactions.map((t) => (
                    <TableRow
                      key={t.id}
                      className={selectedIds.has(t.id) ? 'bg-muted/50' : ''}
                      onClick={() => handleToggleSelect(t.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(t.id)}
                          onCheckedChange={() => handleToggleSelect(t.id)}
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(t.date)}
                      </TableCell>
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
                      <TableCell className="text-right font-medium text-red-600">
                        {formatCurrency(t.baseAmount, t.baseCurrency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Total */}
          <div className="rounded-lg border p-4 bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Total a pagar ({selectedIds.size} transacciones)
              </span>
              <span className="text-xl font-bold">
                {formatCurrency(selectedTotal, defaultCurrency)}
              </span>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || selectedIds.size === 0 || !sourceAccountId}
          >
            {isPending ? 'Procesando...' : `Pagar ${formatCurrency(selectedTotal, defaultCurrency)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// BOTÓN AUTÓNOMO PARA PAGAR TARJETA DE CRÉDITO
// ============================================================================

interface PayCreditCardButtonProps {
  projectId: string;
  userId: string;
  creditCardAccount: Account;
  sourceAccounts: Account[];
  defaultCurrency: string;
  onSuccess?: () => void;
}

/**
 * Botón que obtiene las transacciones pendientes automáticamente y abre el diálogo de pago.
 * Útil para usar en páginas que no tienen las transacciones precargadas.
 */
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

  // Cargar transacciones cuando se abre el diálogo
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
        .catch((err) => {
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
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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
        toast.success(
          `Pago realizado: ${formatCurrency(result.data.totalPaid, defaultCurrency)}`,
          { id: toastId }
        );
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CreditCard className="mr-2 h-4 w-4" />
          Pagar tarjeta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pagar {creditCardAccount.name}</DialogTitle>
          <DialogDescription>
            Selecciona las transacciones a pagar y la cuenta de origen.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : unpaidTransactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay transacciones pendientes de pago</p>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto flex-1">
            {/* Cuenta origen */}
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

            {/* Lista de transacciones */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Transacciones pendientes ({unpaidTransactions.length})
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedIds.size === unpaidTransactions.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
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
                    {unpaidTransactions.map((t) => (
                      <TableRow
                        key={t.id}
                        className={selectedIds.has(t.id) ? 'bg-muted/50' : ''}
                        onClick={() => handleToggleSelect(t.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(t.id)}
                            onCheckedChange={() => handleToggleSelect(t.id)}
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(t.date)}
                        </TableCell>
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
                        <TableCell className="text-right font-medium text-red-600">
                          {formatCurrency(t.baseAmount, t.baseCurrency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Total */}
            <div className="rounded-lg border p-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Total a pagar ({selectedIds.size} transacciones)
                </span>
                <span className="text-xl font-bold">
                  {formatCurrency(selectedTotal, defaultCurrency)}
                </span>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || selectedIds.size === 0 || !sourceAccountId || isLoading}
          >
            {isPending ? 'Procesando...' : `Pagar ${formatCurrency(selectedTotal, defaultCurrency)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// PAGO MASIVO DE TARJETA DE CRÉDITO DESDE SELECCIÓN
// ============================================================================

interface BulkPayCreditCardDialogProps {
  projectId: string;
  userId: string;
  transactions: TransactionWithCategory[];
  accounts: Account[];
  accountsMap: Map<string, Account>;
  defaultCurrency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

interface CreditCardGroup {
  accountId: string;
  accountName: string;
  transactions: TransactionWithCategory[];
  subtotal: number;
  interestAmount: number;
}

function BulkPayCreditCardDialog({
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

  // Agrupar transacciones por tarjeta de crédito
  const groupedByCard = useMemo(() => {
    const groups = new Map<string, CreditCardGroup>();

    transactions.forEach((t) => {
      const accountId = t.accountId ?? '';
      const account = accountsMap.get(accountId);

      if (!groups.has(accountId)) {
        groups.set(accountId, {
          accountId,
          accountName: account?.name ?? 'Tarjeta desconocida',
          transactions: [],
          subtotal: 0,
          interestAmount: 0,
        });
      }

      const group = groups.get(accountId)!;
      group.transactions.push(t);
      group.subtotal += parseFloat(t.baseAmount);
    });

    return Array.from(groups.values());
  }, [transactions, accountsMap]);

  // Calcular totales
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

  // Cuentas disponibles como origen (no-TC)
  const availableSourceAccounts = useMemo(() => {
    return accounts.filter((a) => a.type !== 'credit_card' && !a.isArchived);
  }, [accounts]);

  // Reset al abrir
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

      // Procesar cada tarjeta
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
        const message = totalInterest > 0
          ? `Pago realizado: ${formatCurrency(totalPaid, defaultCurrency)} + ${formatCurrency(totalInterest, defaultCurrency)} intereses`
          : `Pago realizado: ${formatCurrency(totalPaid, defaultCurrency)}`;
        onMutationSuccess?.(toastId, message);
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pagar tarjeta de crédito</DialogTitle>
          <DialogDescription>
            {groupedByCard.length === 1
              ? `Pagando ${transactions.length} transacción${transactions.length > 1 ? 'es' : ''} de ${groupedByCard[0]?.accountName}`
              : `Pagando ${transactions.length} transacciones de ${groupedByCard.length} tarjetas`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          {/* Cuenta origen y fecha */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Pagar desde</label>
              <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {availableSourceAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <div className="flex items-center gap-2">
                        <AccountTypeIcon type={acc.type as AccountType} className="h-4 w-4" />
                        {acc.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha de pago</label>
              <Input
                type="date"
                value={paymentDate.toISOString().split('T')[0]}
                onChange={(e) => setPaymentDate(new Date(e.target.value + 'T12:00:00'))}
              />
            </div>
          </div>

          {/* Grupos por tarjeta */}
          {groupedByCard.map((group) => (
            <div key={group.accountId} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{group.accountName}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {group.transactions.length} transacción{group.transactions.length > 1 ? 'es' : ''}
                </span>
              </div>

              {/* Lista de transacciones */}
              <div className="max-h-[150px] overflow-y-auto rounded border">
                <Table>
                  <TableBody>
                    {group.transactions.map((t) => (
                      <TableRow key={t.id} className="text-sm">
                        <TableCell className="py-1.5 w-[70px]">
                          {formatDate(t.date)}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="truncate max-w-[200px]">{t.description}</div>
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-medium text-red-600 w-[100px]">
                          {formatCurrency(t.baseAmount, t.baseCurrency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Subtotal y intereses */}
              <div className="flex items-end gap-4 pt-2 border-t">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Subtotal compras</label>
                  <div className="font-medium">{formatCurrency(group.subtotal, defaultCurrency)}</div>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Intereses/Cargos (opcional)</label>
                  <CurrencyInput
                    value={interestAmounts.get(group.accountId)}
                    onChange={(v) => handleInterestChange(group.accountId, v)}
                    currency={defaultCurrency}
                    placeholder="0"
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Total general */}
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
              <span className="text-xl font-bold">
                {formatCurrency(totals.grandTotal, defaultCurrency)}
              </span>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !sourceAccountId}
          >
            {isPending ? 'Procesando...' : `Pagar ${formatCurrency(totals.grandTotal, defaultCurrency)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
