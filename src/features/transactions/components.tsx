'use client';

import { useState, useTransition, useEffect, useCallback, useRef } from 'react';
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
} from './actions';
import { createTransactionSchema, createAccountTransferSchema, type CreateTransactionInput, type CreateAccountTransferInput } from './schemas';
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

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/dashboard/transactions?${params.toString()}`);
  };

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

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
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
          userId={userId}
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
  userId: string;
  onEdit: (transaction: TransactionWithCategory) => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

function TransactionTable({ transactions, userId, onEdit, onMutationStart, onMutationSuccess, onMutationError }: TransactionTableProps) {
  const [isPending, startTransition] = useTransition();
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionWithCategory | null>(null);

  const handleTogglePaid = (transaction: TransactionWithCategory) => {
    const toastId = toast.loading(transaction.isPaid ? 'Marcando como pendiente...' : 'Marcando como pagado...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await toggleTransactionPaid(transaction.id, userId, { isPaid: !transaction.isPaid });
      if (result.success) {
        onMutationSuccess?.(toastId, transaction.isPaid ? 'Marcado como pendiente' : 'Marcado como pagado');
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
          {transactions.map((transaction) => (
            <TableRow key={transaction.id} className={transaction.isPaid ? 'opacity-60' : ''}>
              <TableCell>
                <Checkbox
                  checked={transaction.isPaid}
                  onCheckedChange={() => handleTogglePaid(transaction)}
                  disabled={isPending}
                />
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
                    <div className={transaction.isPaid ? 'line-through' : ''}>
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
          ))}
        </TableBody>
      </Table>

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

            {/* Paid Switch */}
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
