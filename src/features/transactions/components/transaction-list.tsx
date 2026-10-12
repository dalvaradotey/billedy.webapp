'use client';

import { NATURE_LABELS, TRANSACTION_NATURES } from '../nature';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowUpCircle,
  ArrowDownCircle,
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
  ShieldCheck,
} from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { ScrollRow } from '@/components/ui/scroll-row';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { getToday } from '@/lib/formatting';
import type { TransactionWithCategory, TransactionSummary } from '../types';
import type { AccountWithEntity } from '@/features/accounts/types';
import type { Category } from '@/features/categories/types';
import type { Entity } from '@/features/entities/types';
import { TransactionDialogContent } from './transaction-form';
import { TransactionTable } from './transaction-table';
import { TransactionChartsContent } from './transaction-charts';
import { DailyPulseCard } from './daily-pulse-card';

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

const NATURE_FILTER_OPTIONS = [
  { value: 'all', label: 'Toda naturaleza' },
  ...TRANSACTION_NATURES.map((nature) => ({ value: nature, label: NATURE_LABELS[nature] })),
];

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
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
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
    { label: 'Nuevo movimiento', icon: Plus, onClick: handleOpenDialog },
    { label: 'Gráficos', icon: BarChart3, onClick: handleOpenCharts },
  ], [handleOpenDialog, handleOpenCharts]);

  useRegisterPageActions(pageActions);

  const currentType = searchParams.get('type') ?? 'all';
  const currentPaid = searchParams.get('paid') ?? 'all';
  const currentReconciled = searchParams.get('reconciled') ?? 'all';
  const currentNature = searchParams.get('nature') ?? 'all';
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
      // Filtro por día (desde el pulso diario)
      if (selectedDay && new Date(t.date).toISOString().slice(0, 10) !== selectedDay) {
        return false;
      }
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
  }, [transactions, searchQuery, selectedAccountIds, selectedBudgetIds, selectedDay]);

  // Totales de transacciones filtradas
  const filteredTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let reconciledCount = 0;
    for (const t of filteredTransactions) {
      const amount = parseFloat(t.baseAmount);
      if (t.type === 'income') income += amount;
      else expense += amount;
      if (t.isReconciled) reconciledCount++;
    }
    return { income, expense, balance: income - expense, reconciledCount };
  }, [filteredTransactions]);

  const hasActiveFilters = searchQuery || selectedAccountIds.size > 0 || selectedBudgetIds.size > 0 || selectedDay;

  return (
    <div className="space-y-4">
      {/* Pulso diario del período */}
      <DailyPulseCard
        transactions={transactions}
        summary={summary}
        startDate={currentStartDate}
        endDate={currentEndDate}
        todayIso={getToday().toISOString().slice(0, 10)}
        currency={defaultCurrency}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        reconciledCount={transactions.filter((t) => t.isReconciled).length}
      />

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
                className="pl-9 pr-8 h-11 rounded-full text-sm bg-surface border-line"
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
              className={`relative shrink-0 h-11 w-11 rounded-full flex items-center justify-center transition-colors ${
                showMobileFilters
                  ? 'bg-cream text-cream-ink'
                  : 'bg-surface text-muted-foreground border border-line'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {(currentType !== 'all' || currentPaid !== 'all' || currentReconciled !== 'all' || currentNature !== 'all' || selectedAccountIds.size > 0 || selectedBudgetIds.size > 0) && (
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
                className="flex items-center gap-2.5 w-full rounded-2xl bg-surface border border-line px-3 py-2.5"
              >
                <div className="p-1.5 rounded-2xl bg-muted/50 shrink-0">
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
                <div className="rounded-2xl bg-surface border border-line p-3 space-y-2.5">
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
                  className={`rounded-full px-3.5 min-h-9 text-xs font-bold transition-colors ${
                    currentType === 'income'
                      ? 'bg-jade-soft text-jade-text'
                      : 'bg-surface text-muted-foreground'
                  }`}
                >
                  Ingresos
                </button>
                <button
                  onClick={() =>
                    handleFilterChange('type', currentType === 'expense' ? 'all' : 'expense')
                  }
                  className={`rounded-full px-3.5 min-h-9 text-xs font-bold transition-colors ${
                    currentType === 'expense'
                      ? 'bg-coral-soft text-coral-text'
                      : 'bg-surface text-muted-foreground'
                  }`}
                >
                  Gastos
                </button>
                <div className="w-px h-4 bg-border" />
                <button
                  onClick={() =>
                    handleFilterChange('paid', currentPaid === 'true' ? 'all' : 'true')
                  }
                  className={`rounded-full px-3.5 min-h-9 text-xs font-bold transition-colors ${
                    currentPaid === 'true'
                      ? 'bg-sky-soft text-sky-text'
                      : 'bg-surface text-muted-foreground'
                  }`}
                >
                  Pagados
                </button>
                <button
                  onClick={() =>
                    handleFilterChange('paid', currentPaid === 'false' ? 'all' : 'false')
                  }
                  className={`rounded-full px-3.5 min-h-9 text-xs font-bold transition-colors ${
                    currentPaid === 'false'
                      ? 'bg-amber-soft text-amber-text'
                      : 'bg-surface text-muted-foreground'
                  }`}
                >
                  Pendientes
                </button>
                <div className="w-px h-4 bg-border" />
                <button
                  onClick={() =>
                    handleFilterChange('reconciled', currentReconciled === 'true' ? 'all' : 'true')
                  }
                  className={`rounded-full px-3.5 min-h-9 text-xs font-bold transition-colors ${
                    currentReconciled === 'true'
                      ? 'bg-sky-soft text-sky-text'
                      : 'bg-surface text-muted-foreground'
                  }`}
                >
                  Conciliadas
                </button>
                <button
                  onClick={() =>
                    handleFilterChange('reconciled', currentReconciled === 'false' ? 'all' : 'false')
                  }
                  className={`rounded-full px-3.5 min-h-9 text-xs font-bold transition-colors ${
                    currentReconciled === 'false'
                      ? 'bg-surface-3 text-foreground'
                      : 'bg-surface text-muted-foreground'
                  }`}
                >
                  Sin conciliar
                </button>
              </div>

              {/* Naturaleza */}
              <ScrollRow indicator={false} className="flex items-center gap-1.5">
                {NATURE_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleFilterChange('nature', opt.value)}
                    className={`shrink-0 rounded-full px-3.5 min-h-9 text-xs font-bold transition-colors ${
                      currentNature === opt.value
                        ? 'bg-sky-soft text-sky-text'
                        : 'bg-surface text-muted-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </ScrollRow>

              {/* Multi-select: Cuentas y Presupuestos */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsAccountDrawerOpen(true)}
                  className={cn(
                    'rounded-full px-3.5 min-h-9 text-xs font-bold transition-colors inline-flex items-center gap-1.5',
                    selectedAccountIds.size > 0
                      ? 'bg-sky-soft text-sky-text'
                      : 'bg-surface text-muted-foreground',
                  )}
                >
                  <Building2 className="h-3 w-3" />
                  Cuentas
                  {selectedAccountIds.size > 0 && (
                    <span className="rounded-full bg-sky/30 px-1.5 text-[10px]">
                      {selectedAccountIds.size}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setIsBudgetDrawerOpen(true)}
                  className={cn(
                    'rounded-full px-3.5 min-h-9 text-xs font-bold transition-colors inline-flex items-center gap-1.5',
                    selectedBudgetIds.size > 0
                      ? 'bg-violet-soft text-violet-text'
                      : 'bg-surface text-muted-foreground',
                  )}
                >
                  <Target className="h-3 w-3" />
                  Presupuestos
                  {selectedBudgetIds.size > 0 && (
                    <span className="rounded-full bg-violet/30 px-1.5 text-[10px]">
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
                className="pl-8 pr-7 h-9 rounded-full text-xs bg-surface border-line"
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
            <div className="inline-flex rounded-full border border-line bg-surface p-1">
              {([
                { value: 'all', label: 'Todos' },
                { value: 'income', label: 'Ingresos' },
                { value: 'expense', label: 'Gastos' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleFilterChange('type', opt.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                    currentType === opt.value
                      ? 'bg-cream text-cream-ink'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Paid toggle */}
            <div className="inline-flex rounded-full border border-line bg-surface p-1">
              {([
                { value: 'all', label: 'Todos' },
                { value: 'true', label: 'Pagados' },
                { value: 'false', label: 'Pendientes' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleFilterChange('paid', opt.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                    currentPaid === opt.value
                      ? 'bg-cream text-cream-ink'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Reconciled toggle */}
            <div className="inline-flex rounded-full border border-line bg-surface p-1">
              {([
                { value: 'all', label: 'Todas' },
                { value: 'true', label: 'Conciliadas' },
                { value: 'false', label: 'Sin conciliar' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleFilterChange('reconciled', opt.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                    currentReconciled === opt.value
                      ? 'bg-cream text-cream-ink'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Nature filter */}
            <div className="inline-flex rounded-full border border-line bg-surface p-1">
              {NATURE_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleFilterChange('nature', opt.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                    currentNature === opt.value
                      ? 'bg-cream text-cream-ink'
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
                    'inline-flex items-center gap-1.5 rounded-full border px-3 h-9 text-xs font-bold transition-colors',
                    selectedAccountIds.size > 0
                      ? 'bg-sky-soft border-sky/40 text-sky-text'
                      : 'bg-surface border-line text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Cuentas
                  {selectedAccountIds.size > 0 && (
                    <span className="rounded-full bg-sky/30 px-1.5 text-[10px] leading-4">
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
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-xl text-sm hover:bg-muted/50 transition-colors"
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
                    'inline-flex items-center gap-1.5 rounded-full border px-3 h-9 text-xs font-bold transition-colors',
                    selectedBudgetIds.size > 0
                      ? 'bg-violet-soft border-violet/40 text-violet-text'
                      : 'bg-surface border-line text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Target className="h-3.5 w-3.5" />
                  Presupuestos
                  {selectedBudgetIds.size > 0 && (
                    <span className="rounded-full bg-violet/30 px-1.5 text-[10px] leading-4">
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
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-xl text-sm hover:bg-muted/50 transition-colors"
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
      <ResponsiveDrawer
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingTransaction(null);
        }}
      >
        <TransactionDialogContent
          key={editingTransaction?.id ?? 'create'}
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
      {filteredTransactions.length > 0 && hasActiveFilters && (
        <div className="flex items-center gap-4 px-4 py-2.5 rounded-2xl bg-surface border border-line text-sm overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1.5 shrink-0">
            <ArrowUpCircle className="h-3.5 w-3.5 text-jade" />
            <span className="text-muted-foreground whitespace-nowrap">Ingresos:</span>
            <span className="font-semibold text-jade tabular-nums whitespace-nowrap">
              {formatCurrency(filteredTotals.income, defaultCurrency)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <ArrowDownCircle className="h-3.5 w-3.5 text-coral" />
            <span className="text-muted-foreground whitespace-nowrap">Gastos:</span>
            <span className="font-semibold text-coral-text tabular-nums whitespace-nowrap">
              {formatCurrency(filteredTotals.expense, defaultCurrency)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <ShieldCheck className="h-3.5 w-3.5 text-sky" />
            <span className="text-muted-foreground whitespace-nowrap">Conc:</span>
            <span className="font-semibold text-sky tabular-nums whitespace-nowrap">
              {filteredTotals.reconciledCount}/{filteredTransactions.length}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 ml-auto shrink-0">
            <span className="text-muted-foreground whitespace-nowrap">Saldo:</span>
            <span className={cn(
              'font-semibold tabular-nums whitespace-nowrap',
              filteredTotals.balance >= 0
                ? 'text-jade'
                : 'text-coral-text',
            )}>
              {formatCurrency(filteredTotals.balance, defaultCurrency)}
            </span>
          </div>
          {hasActiveFilters && (
            <span className="text-[10px] text-muted-foreground/60 ml-auto sm:ml-0 shrink-0 whitespace-nowrap">(filtrado)</span>
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
