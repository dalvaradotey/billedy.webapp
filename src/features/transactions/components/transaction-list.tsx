'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  Filter,
  Calendar,
  Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { ResponsiveDrawer, DrawerTrigger } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TransactionWithCategory, TransactionSummary } from '../types';
import type { AccountWithEntity } from '@/features/accounts/types';
import type { Category } from '@/features/categories/types';
import type { Entity } from '@/features/entities/types';
import { TransactionDialogContent } from './transaction-form';
import { TransactionTable } from './transaction-table';
import { SummaryCard } from './summary-card';

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
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Ingresos"
          value={formatCurrency(summary.totalIncome, defaultCurrency)}
          icon={<ArrowUpCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          className="text-emerald-600 dark:text-emerald-400"
        />
        <SummaryCard
          title="Gastos"
          value={formatCurrency(summary.totalExpense, defaultCurrency)}
          icon={<ArrowDownCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
          className="text-red-600 dark:text-red-400"
        />
        <SummaryCard
          title="Balance"
          value={formatCurrency(summary.balance, defaultCurrency)}
          className={summary.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
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

        <ResponsiveDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DrawerTrigger asChild>
            <Button size="sm" className="gap-2" onClick={handleOpenDialog}>
              <Plus className="h-4 w-4" />
              Nueva transacción
            </Button>
          </DrawerTrigger>
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
        </div>
      </div>

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
