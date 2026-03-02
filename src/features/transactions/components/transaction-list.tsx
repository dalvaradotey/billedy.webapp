'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowRight,
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  Clock,
  Calendar,
  Receipt,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { ResponsiveDrawer } from '@/components/ui/drawer';
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
import type { TransactionWithCategory, TransactionSummary } from '../types';
import type { AccountWithEntity } from '@/features/accounts/types';
import type { Category } from '@/features/categories/types';
import type { Entity } from '@/features/entities/types';
import { TransactionDialogContent } from './transaction-form';
import { TransactionTable } from './transaction-table';

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
  const [showPeriodControls, setShowPeriodControls] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

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

      {/* ═══ MOBILE FILTERS ═══ */}
      <div className="sm:hidden space-y-3">
        {/* Row 1: Period card + CTA */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPeriodControls(!showPeriodControls)}
            className="flex items-center gap-2.5 flex-1 min-w-0 rounded-xl bg-muted/50 px-3 py-2.5"
          >
            <div className="p-1.5 rounded-lg bg-background shadow-sm shrink-0">
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
          <Button variant="cta-sm" className="shrink-0" onClick={handleOpenDialog}>
            Nueva
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Period expanded */}
        {showPeriodControls && (
          <div className="rounded-xl bg-muted/30 border border-border/50 p-3 space-y-2.5">
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

        {/* Row 2: Toggle filter pills */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() =>
              handleFilterChange('type', currentType === 'income' ? 'all' : 'income')
            }
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              currentType === 'income'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                : 'bg-muted/50 text-muted-foreground'
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
                : 'bg-muted/50 text-muted-foreground'
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
                : 'bg-muted/50 text-muted-foreground'
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
                : 'bg-muted/50 text-muted-foreground'
            }`}
          >
            Pendientes
          </button>
        </div>
      </div>

      {/* ═══ DESKTOP FILTERS ═══ */}
      <div className="hidden sm:flex items-center gap-3 flex-wrap">
        <div className="inline-flex rounded-lg border bg-muted/50 p-0.5">
          {([
            { value: 'all', label: 'Todos' },
            { value: 'income', label: 'Ingresos' },
            { value: 'expense', label: 'Gastos' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleFilterChange('type', opt.value)}
              className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                currentType === opt.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="inline-flex rounded-lg border bg-muted/50 p-0.5">
          {([
            { value: 'all', label: 'Todos' },
            { value: 'true', label: 'Pagados' },
            { value: 'false', label: 'Pendientes' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleFilterChange('paid', opt.value)}
              className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                currentPaid === opt.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
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

        <Button variant="cta-sm" className="shrink-0" onClick={handleOpenDialog}>
          Nueva transacción
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Transaction Dialog */}
      <ResponsiveDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
      </ResponsiveDrawer>

      {/* Transaction Table */}
      {transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No hay transacciones registradas"
          description="Registra tus ingresos y gastos para comenzar a controlar tus finanzas."
        />
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
