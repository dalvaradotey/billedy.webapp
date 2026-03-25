'use client';

import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import { Receipt, Calendar, Store, Search, X, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cardStyles } from '@/components/card-styles';
import { formatCurrency, formatDate } from '@/lib/formatting';
import { cn } from '@/lib/utils';

import { fetchBudgetDetail } from '../actions';

export type CycleOption = {
  id: string;
  name: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
  status: string;
};

interface BudgetDetailProps {
  budgetId: string;
  userId: string;
  budgetedAmount: number;
  currency: string;
  categoryColor: string | null;
  cycles: CycleOption[];
  defaultCycleId?: string;
}

type DetailTransaction = {
  id: string;
  date: Date;
  description: string;
  baseAmount: string;
  categoryName: string | null;
  categoryColor: string | null;
  accountName: string | null;
  entityId: string | null;
  entityName: string | null;
  entityImageUrl: string | null;
};

type DetailData = {
  spentAmount: number;
  budgetedAmount: number;
  progressPercentage: number;
  remainingAmount: number;
  transactions: DetailTransaction[];
};

export function BudgetDetail({
  budgetId,
  userId,
  budgetedAmount,
  currency,
  categoryColor,
  cycles,
  defaultCycleId,
}: BudgetDetailProps) {
  const hasCycles = cycles.length > 0;
  const defaultCycle = defaultCycleId
    ? cycles.find((c) => c.id === defaultCycleId)
    : cycles.find((c) => c.status === 'open') ?? cycles[0];

  const [selectedCycleId, setSelectedCycleId] = useState<string>(
    defaultCycle?.id ?? 'custom'
  );
  const [customStartDate, setCustomStartDate] = useState(() => {
    if (defaultCycle) return defaultCycle.startDate;
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    if (defaultCycle) return defaultCycle.endDate;
    return new Date().toISOString().split('T')[0];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<'date' | 'amount' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [data, setData] = useState<DetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const getActiveDates = useCallback((): { start: string; end: string } => {
    if (selectedCycleId === 'custom') {
      return { start: customStartDate, end: customEndDate };
    }
    const cycle = cycles.find((c) => c.id === selectedCycleId);
    if (cycle) {
      return { start: cycle.startDate, end: cycle.endDate };
    }
    return { start: customStartDate, end: customEndDate };
  }, [selectedCycleId, customStartDate, customEndDate, cycles]);

  const loadData = useCallback(() => {
    const { start, end } = getActiveDates();
    startTransition(async () => {
      const result = await fetchBudgetDetail(budgetId, userId, start, end);
      if (result.success) {
        setData(result.data);
      }
      setIsLoading(false);
    });
  }, [budgetId, userId, getActiveDates]);

  useEffect(() => {
    setIsLoading(true);
    loadData();
  }, [loadData]);

  const handleCycleChange = (value: string) => {
    setSelectedCycleId(value);
    if (value !== 'custom') {
      const cycle = cycles.find((c) => c.id === value);
      if (cycle) {
        setCustomStartDate(cycle.startDate);
        setCustomEndDate(cycle.endDate);
      }
    }
  };

  const isCustom = selectedCycleId === 'custom';
  const isCycleSelected = !isCustom && hasCycles;
  const isOverBudget = data ? data.spentAmount > data.budgetedAmount : false;

  const handleSort = useCallback((column: 'date' | 'amount') => {
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

  const filteredTransactions = useMemo(() => {
    const filtered = data?.transactions.filter((tx) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        tx.description.toLowerCase().includes(q) ||
        (tx.entityName && tx.entityName.toLowerCase().includes(q))
      );
    }) ?? [];

    if (!sortColumn) return filtered;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortColumn === 'date') {
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else {
        cmp = parseFloat(a.baseAmount) - parseFloat(b.baseAmount);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [data?.transactions, searchQuery, sortColumn, sortDirection]);

  return (
    <div className={cardStyles.detailsContainer}>
      <div className="space-y-4">
        {/* Filtro de ciclo/fechas */}
        <div className="space-y-2">
          {hasCycles && (
            <Select value={selectedCycleId} onValueChange={handleCycleChange}>
              <SelectTrigger className="h-9 text-sm">
                <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Seleccionar período" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((cycle) => (
                  <SelectItem key={cycle.id} value={cycle.id}>
                    {cycle.name}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          )}

          {(isCustom || !hasCycles) && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
          )}
        </div>

        {/* Progreso — solo cuando hay un ciclo seleccionado */}
        {isCycleSelected && (
          isLoading ? (
            <div className={cardStyles.progressSection}>
              <div className="flex justify-between mb-2.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-6 flex-1 rounded-full" />
                <Skeleton className="h-5 w-10" />
              </div>
            </div>
          ) : data ? (
            <div className={isOverBudget ? cardStyles.progressSectionDanger : cardStyles.progressSection}>
              <div className="flex justify-between mb-2.5">
                <div>
                  <p className={cn('text-xs', isOverBudget ? cardStyles.progressSecondaryDanger : cardStyles.progressSecondary)}>Gastado</p>
                  <p className={cn('text-sm', isOverBudget ? cardStyles.progressLabelDanger : cardStyles.progressLabel, 'font-semibold')}>
                    {formatCurrency(data.spentAmount, currency)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn('text-xs', isOverBudget ? cardStyles.progressSecondaryDanger : cardStyles.progressSecondary)}>
                    {isOverBudget ? 'Excedido' : 'Disponible'}
                  </p>
                  <p className={cn('text-sm', isOverBudget ? cardStyles.progressLabelDanger : cardStyles.progressLabel, 'font-semibold')}>
                    {formatCurrency(Math.abs(data.remainingAmount), currency)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Progress
                  value={Math.min(100, data.progressPercentage)}
                  className={cardStyles.progressBar}
                  indicatorClassName={isOverBudget ? cardStyles.progressIndicatorDanger : cardStyles.progressIndicator}
                />
                <span className={cn('text-lg', isOverBudget ? cardStyles.progressPercentageDanger : cardStyles.progressPercentage)}>
                  {data.progressPercentage}%
                </span>
              </div>
            </div>
          ) : null
        )}

        {/* Buscador */}
        {!isLoading && data && data.transactions.length > 0 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por descripción o entidad..."
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Transacciones */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 py-2">
                <Skeleton className="h-4 w-12 shrink-0 bg-muted-foreground/10" />
                <Skeleton className="h-6 w-6 rounded shrink-0 bg-muted-foreground/10" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32 bg-muted-foreground/10" />
                  <Skeleton className="h-3 w-20 bg-muted-foreground/10" />
                </div>
                <Skeleton className="h-4 w-20 bg-muted-foreground/10" />
              </div>
            ))}
          </div>
        ) : data && filteredTransactions.length > 0 ? (
          <div className="-mx-3 overflow-x-auto">
            <div className="min-w-[420px] px-3 divide-y divide-border/40">
              {/* Header */}
              <div className="flex items-center gap-2.5 pb-1.5 text-[11px] font-medium tracking-wider">
                <button
                  onClick={() => handleSort('date')}
                  className={cn(
                    'inline-flex items-center gap-1 hover:text-foreground transition-colors -ml-1 px-1 py-0.5 rounded shrink-0',
                    sortColumn === 'date' ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  Fecha
                  {sortColumn === 'date' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                  )}
                </button>
                <span className="w-6 shrink-0" />
                <span className="flex-1 text-muted-foreground">Descripción</span>
                <button
                  onClick={() => handleSort('amount')}
                  className={cn(
                    'inline-flex items-center gap-1 hover:text-foreground transition-colors px-1 py-0.5 rounded shrink-0 justify-end',
                    sortColumn === 'amount' ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  Monto
                  {sortColumn === 'amount' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                  )}
                </button>
              </div>
              {filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-2.5 py-2 -mx-1.5 px-1.5 rounded-md transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/30"
                >
                  {/* Fecha */}
                  <span className="text-xs text-muted-foreground whitespace-nowrap w-12 shrink-0">
                    {formatDate(tx.date)}
                  </span>
                  {/* Entidad */}
                  {tx.entityImageUrl ? (
                    <img
                      src={tx.entityImageUrl}
                      alt={tx.entityName ?? ''}
                      className="h-6 w-6 rounded object-contain bg-white shrink-0"
                    />
                  ) : tx.entityId ? (
                    <div className="h-6 w-6 rounded bg-muted flex items-center justify-center shrink-0">
                      <Store className="h-3 w-3 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="h-6 w-6 shrink-0" />
                  )}
                  {/* Descripción */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{tx.description}</p>
                    {(tx.entityName || tx.accountName) && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[tx.entityName, tx.accountName].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  {/* Monto */}
                  <span className="text-sm font-semibold tabular-nums text-red-500 dark:text-red-400 shrink-0">
                    -{formatCurrency(parseFloat(tx.baseAmount), currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : data && data.transactions.length > 0 && filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <Search className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No se encontraron resultados para &quot;{searchQuery}&quot;</p>
          </div>
        ) : data ? (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <Receipt className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No hay transacciones en este período</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
