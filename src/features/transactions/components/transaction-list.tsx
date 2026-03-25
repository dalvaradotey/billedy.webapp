'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  Clock,
  Calendar,
  Receipt,
  ChevronDown,
  Plus,
  Search,
  X,
  SlidersHorizontal,
  BarChart3,
  Building2,
  Target,
  Check,
} from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { ResponsiveDrawer, Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { PageToolbar } from '@/components/page-toolbar';
import { useRegisterPageActions, type PageAction } from '@/components/layout/bottom-nav-context';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SummaryCard } from '@/components/ui/summary-card';
import { SummaryCardsSlider } from '@/components/ui/summary-cards-slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { TransactionWithCategory, TransactionSummary } from '../types';
import type { AccountWithEntity } from '@/features/accounts/types';
import type { Category } from '@/features/categories/types';
import type { Entity } from '@/features/entities/types';
import { TransactionDialogContent } from './transaction-form';
import { TransactionTable } from './transaction-table';
import { TransactionChartsContent } from './transaction-charts';

function formatCurrency(amount: number | string, currency: string = 'CLP'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

interface Budget {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
}

interface SavingsGoal {
  id: string;
  name: string;
}

interface BillingCycleOption {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

export interface TransactionListProps {
  transactions: TransactionWithCategory[];
  categories: Category[];
  accounts: AccountWithEntity[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
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
  savingsGoals,
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
  const [showPeriodControls, setShowPeriodControls] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isChartsOpen, setIsChartsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [selectedBudgetIds, setSelectedBudgetIds] = useState<Set<string>>(new Set());
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);
  const [isBudgetDrawerOpen, setIsBudgetDrawerOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const toggleAccountFilter = useCallback((id: string) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleBudgetFilter = useCallback((id: string) => {
    setSelectedBudgetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Callbacks simplificados - los datos se actualizan automáticamente via updateTag()
  const onMutationStart = useCallback(() => {
    // No-op: los datos se actualizan automáticamente
  }, []);

  const onMutationSuccess = useCallback((toastId: string | number, message: string) => {
    toast.success(message, { id: toastId });
  }, []);

  const onMutationError = useCallback((toastId: string | number, error: string) => {
    toast.error(error, { id: toastId });
  }, []);

  const handleEdit = (transaction: TransactionWithCategory) => {
    setEditingTransaction(transaction);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingTransaction(null);
  };

  const handleOpenDialog = useCallback(() => {
    setEditingTransaction(null);
    setIsDialogOpen(true);
  }, []);

  const handleOpenCharts = useCallback(() => {
    setIsChartsOpen(true);
  }, []);

  const pageActions = useMemo<PageAction[]>(() => [
    { label: 'Nueva transacción', icon: Plus, onClick: handleOpenDialog },
    { label: 'Gráficos', icon: BarChart3, onClick: handleOpenCharts },
  ], [handleOpenDialog, handleOpenCharts]);

  useRegisterPageActions(pageActions);

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

  // Filtro client-side: búsqueda + cuenta + presupuesto
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Filtro por cuenta
      if (selectedAccountIds.size > 0 && (!t.accountId || !selectedAccountIds.has(t.accountId))) {
        return false;
      }
      // Filtro por presupuesto
      if (selectedBudgetIds.size > 0 && (!t.budgetId || !selectedBudgetIds.has(t.budgetId))) {
        return false;
      }
      // Filtro por búsqueda
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const amount = formatCurrency(t.originalAmount, t.originalCurrency);
        return (
          t.description.toLowerCase().includes(q) ||
          (t.accountName?.toLowerCase().includes(q) ?? false) ||
          (t.categoryName?.toLowerCase().includes(q) ?? false) ||
          (t.entityName?.toLowerCase().includes(q) ?? false) ||
          amount.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, searchQuery, selectedAccountIds, selectedBudgetIds]);

  // Totales de transacciones filtradas
  const filteredTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filteredTransactions) {
      const amount = parseFloat(t.baseAmount);
      if (t.type === 'income') income += amount;
      else expense += amount;
    }
    return { income, expense, balance: income - expense };
  }, [filteredTransactions]);

  const hasActiveFilters = searchQuery || selectedAccountIds.size > 0 || selectedBudgetIds.size > 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <SummaryCardsSlider>
        <SummaryCard
          title="Ingresos"
          value={formatCurrency(summary.totalIncome, defaultCurrency)}
          subtitle={summary.pendingIncome > 0
            ? `Pagado: ${formatCurrency(summary.paidIncome, defaultCurrency)} · Pend: ${formatCurrency(summary.pendingIncome, defaultCurrency)}`
            : undefined
          }
          icon={<ArrowUpCircle className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="success"
        />
        <SummaryCard
          title="Gastos"
          value={formatCurrency(summary.totalExpense, defaultCurrency)}
          subtitle={summary.pendingExpense > 0
            ? `Pagado: ${formatCurrency(summary.paidExpense, defaultCurrency)} · Pend: ${formatCurrency(summary.pendingExpense, defaultCurrency)}`
            : undefined
          }
          icon={<ArrowDownCircle className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="danger"
        />
        <SummaryCard
          title="Saldo"
          value={formatCurrency(summary.balance, defaultCurrency)}
          subtitle="en base a pagados"
          icon={<Wallet className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant={summary.balance >= 0 ? 'success' : 'danger'}
        />
        <SummaryCard
          title="Pendientes"
          value={`${summary.pendingCount} de ${summary.paidCount + summary.pendingCount}`}
          subtitle="transacciones"
          icon={<Clock className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="neutral"
        />
      </SummaryCardsSlider>

      {/* ═══ TOOLBAR + FILTROS ═══ */}
      <PageToolbar label={`${filteredTransactions.length}${searchQuery ? ` de ${transactions.length}` : ''} ${filteredTransactions.length === 1 ? 'transacción' : 'transacciones'}`}>
        {/* ── Mobile filters ── */}
        <div className="sm:hidden space-y-3 w-full">
          {/* Search + filter toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 text-sm bg-background"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`relative shrink-0 h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                showMobileFilters
                  ? 'bg-foreground/10 text-foreground'
                  : 'bg-background text-muted-foreground'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {(currentType !== 'all' || currentPaid !== 'all' || selectedAccountIds.size > 0 || selectedBudgetIds.size > 0) && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          </div>

          {/* Collapsible filters */}
          {showMobileFilters && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Period card */}
              <button
                type="button"
                onClick={() => setShowPeriodControls(!showPeriodControls)}
                className="flex items-center gap-2.5 w-full rounded-xl bg-background px-3 py-2.5"
              >
                <div className="p-1.5 rounded-lg bg-muted/50 shrink-0">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium truncate">
                  {dateRangeFeedback || 'Últimos 30 días'}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground shrink-0 ml-auto transition-transform duration-200 ${
                    showPeriodControls ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Period expanded */}
              {showPeriodControls && (
                <div className="rounded-xl bg-background border border-border/50 p-3 space-y-2.5">
                  {hasCycles && (
                    <Select value={currentCycleId} onValueChange={handleCycleChange}>
                      <SelectTrigger className="h-9 text-sm">
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
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                        Desde
                      </label>
                      <Input
                        type="date"
                        value={currentStartDate}
                        onChange={(e) => handleDateChange('startDate', e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                        Hasta
                      </label>
                      <Input
                        type="date"
                        value={currentEndDate}
                        onChange={(e) => handleDateChange('endDate', e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Filter pills */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    handleFilterChange('type', currentType === 'income' ? 'all' : 'income')
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    currentType === 'income'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                      : 'bg-background/80 text-muted-foreground'
                  }`}
                >
                  Ingresos
                </button>
                <button
                  onClick={() =>
                    handleFilterChange('type', currentType === 'expense' ? 'all' : 'expense')
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    currentType === 'expense'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
                      : 'bg-background/80 text-muted-foreground'
                  }`}
                >
                  Gastos
                </button>
                <div className="w-px h-4 bg-border" />
                <button
                  onClick={() =>
                    handleFilterChange('paid', currentPaid === 'true' ? 'all' : 'true')
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    currentPaid === 'true'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                      : 'bg-background/80 text-muted-foreground'
                  }`}
                >
                  Pagados
                </button>
                <button
                  onClick={() =>
                    handleFilterChange('paid', currentPaid === 'false' ? 'all' : 'false')
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    currentPaid === 'false'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                      : 'bg-background/80 text-muted-foreground'
                  }`}
                >
                  Pendientes
                </button>
              </div>

              {/* Multi-select: Cuentas y Presupuestos */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsAccountDrawerOpen(true)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium transition-colors inline-flex items-center gap-1.5',
                    selectedAccountIds.size > 0
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                      : 'bg-background/80 text-muted-foreground',
                  )}
                >
                  <Building2 className="h-3 w-3" />
                  Cuentas
                  {selectedAccountIds.size > 0 && (
                    <span className="rounded-full bg-blue-200 dark:bg-blue-800 px-1.5 text-[10px]">
                      {selectedAccountIds.size}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setIsBudgetDrawerOpen(true)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium transition-colors inline-flex items-center gap-1.5',
                    selectedBudgetIds.size > 0
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                      : 'bg-background/80 text-muted-foreground',
                  )}
                >
                  <Target className="h-3 w-3" />
                  Presupuestos
                  {selectedBudgetIds.size > 0 && (
                    <span className="rounded-full bg-purple-200 dark:bg-purple-800 px-1.5 text-[10px]">
                      {selectedBudgetIds.size}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Desktop filters ── */}
        <div className="hidden sm:block space-y-2.5 w-full">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 max-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-7 h-8 text-xs bg-background/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Type toggle */}
            <div className="inline-flex rounded-lg border bg-background/50 p-0.5">
              {([
                { value: 'all', label: 'Todos' },
                { value: 'income', label: 'Ingresos' },
                { value: 'expense', label: 'Gastos' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleFilterChange('type', opt.value)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    currentType === opt.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Paid toggle */}
            <div className="inline-flex rounded-lg border bg-background/50 p-0.5">
              {([
                { value: 'all', label: 'Todos' },
                { value: 'true', label: 'Pagados' },
                { value: 'false', label: 'Pendientes' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleFilterChange('paid', opt.value)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    currentPaid === opt.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Account filter */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 h-8 text-xs font-medium transition-colors',
                    selectedAccountIds.size > 0
                      ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
                      : 'bg-background/50 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Cuentas
                  {selectedAccountIds.size > 0 && (
                    <span className="rounded-full bg-blue-200 dark:bg-blue-800 px-1.5 text-[10px] leading-4">
                      {selectedAccountIds.size}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-2">
                <div className="flex items-center justify-between px-2 pb-2">
                  <span className="text-xs font-medium text-muted-foreground">Filtrar por cuenta</span>
                  {selectedAccountIds.size > 0 && (
                    <button
                      onClick={() => setSelectedAccountIds(new Set())}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => toggleAccountFilter(acc.id)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors"
                    >
                      <div className={cn(
                        'h-4 w-4 rounded border flex items-center justify-center shrink-0',
                        selectedAccountIds.has(acc.id)
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-input',
                      )}>
                        {selectedAccountIds.has(acc.id) && <Check className="h-3 w-3" />}
                      </div>
                      <span className="truncate">{acc.name}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Budget filter */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 h-8 text-xs font-medium transition-colors',
                    selectedBudgetIds.size > 0
                      ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300'
                      : 'bg-background/50 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Target className="h-3.5 w-3.5" />
                  Presupuestos
                  {selectedBudgetIds.size > 0 && (
                    <span className="rounded-full bg-purple-200 dark:bg-purple-800 px-1.5 text-[10px] leading-4">
                      {selectedBudgetIds.size}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-2">
                <div className="flex items-center justify-between px-2 pb-2">
                  <span className="text-xs font-medium text-muted-foreground">Filtrar por presupuesto</span>
                  {selectedBudgetIds.size > 0 && (
                    <button
                      onClick={() => setSelectedBudgetIds(new Set())}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {budgets.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => toggleBudgetFilter(b.id)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors"
                    >
                      <div className={cn(
                        'h-4 w-4 rounded border flex items-center justify-center shrink-0',
                        selectedBudgetIds.has(b.id)
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-input',
                      )}>
                        {selectedBudgetIds.has(b.id) && <Check className="h-3 w-3" />}
                      </div>
                      <span className="truncate">{b.name}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

          </div>

          {/* Date controls — segunda fila, alineada a la derecha */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            {hasCycles && (
              <Select value={currentCycleId} onValueChange={handleCycleChange}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
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
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={currentStartDate}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
                className="w-[125px] h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">—</span>
              <Input
                type="date"
                value={currentEndDate}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
                className="w-[125px] h-8 text-xs"
              />
            </div>
            {dateRangeFeedback && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {dateRangeFeedback}
              </span>
            )}
          </div>
        </div>
      </PageToolbar>

      {/* Transaction Dialog */}
      <ResponsiveDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <TransactionDialogContent
          projectId={projectId}
          userId={userId}
          categories={categories}
          accounts={accounts}
          budgets={budgets}
          savingsGoals={savingsGoals}
          entities={entities}
          transaction={editingTransaction}
          defaultCurrency={defaultCurrency}
          onSuccess={handleDialogClose}
          onMutationStart={onMutationStart}
          onMutationSuccess={onMutationSuccess}
          onMutationError={onMutationError}
        />
      </ResponsiveDrawer>

      {/* Charts Drawer */}
      <ResponsiveDrawer open={isChartsOpen} onOpenChange={setIsChartsOpen}>
        <TransactionChartsContent
          transactions={filteredTransactions}
          defaultCurrency={defaultCurrency}
        />
      </ResponsiveDrawer>

      {/* Account Filter Drawer (mobile) */}
      <Drawer open={isAccountDrawerOpen} onOpenChange={setIsAccountDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Filtrar por cuenta</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-1">
            {selectedAccountIds.size > 0 && (
              <button
                onClick={() => setSelectedAccountIds(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground mb-2"
              >
                Limpiar selección
              </button>
            )}
            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => toggleAccountFilter(acc.id)}
                className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm hover:bg-muted/50 transition-colors active:bg-muted"
              >
                <div className={cn(
                  'h-5 w-5 rounded border-2 flex items-center justify-center shrink-0',
                  selectedAccountIds.has(acc.id)
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-input',
                )}>
                  {selectedAccountIds.has(acc.id) && <Check className="h-3.5 w-3.5" />}
                </div>
                <span>{acc.name}</span>
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Budget Filter Drawer (mobile) */}
      <Drawer open={isBudgetDrawerOpen} onOpenChange={setIsBudgetDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Filtrar por presupuesto</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-1">
            {selectedBudgetIds.size > 0 && (
              <button
                onClick={() => setSelectedBudgetIds(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground mb-2"
              >
                Limpiar selección
              </button>
            )}
            {budgets.map((b) => (
              <button
                key={b.id}
                onClick={() => toggleBudgetFilter(b.id)}
                className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm hover:bg-muted/50 transition-colors active:bg-muted"
              >
                <div className={cn(
                  'h-5 w-5 rounded border-2 flex items-center justify-center shrink-0',
                  selectedBudgetIds.has(b.id)
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-input',
                )}>
                  {selectedBudgetIds.has(b.id) && <Check className="h-3.5 w-3.5" />}
                </div>
                <span>{b.name}</span>
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Totales filtrados */}
      {filteredTransactions.length > 0 && (
        <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-muted/40 border border-border/50 text-sm">
          <div className="flex items-center gap-1.5">
            <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-muted-foreground">Ingresos:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatCurrency(filteredTotals.income, defaultCurrency)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowDownCircle className="h-3.5 w-3.5 text-red-500" />
            <span className="text-muted-foreground">Gastos:</span>
            <span className="font-semibold text-red-600 dark:text-red-400 tabular-nums">
              {formatCurrency(filteredTotals.expense, defaultCurrency)}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 ml-auto">
            <span className="text-muted-foreground">Saldo:</span>
            <span className={cn(
              'font-semibold tabular-nums',
              filteredTotals.balance >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400',
            )}>
              {formatCurrency(filteredTotals.balance, defaultCurrency)}
            </span>
          </div>
          {hasActiveFilters && (
            <span className="text-[10px] text-muted-foreground/60 ml-auto sm:ml-0">(filtrado)</span>
          )}
        </div>
      )}

      {/* Transaction Table */}
      {transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No hay transacciones registradas"
          description="Registra tus ingresos y gastos para comenzar a controlar tus finanzas."
        />
      ) : filteredTransactions.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Sin resultados"
          description={`No se encontraron transacciones para "${searchQuery}".`}
        />
      ) : (
        <TransactionTable
          transactions={filteredTransactions}
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
