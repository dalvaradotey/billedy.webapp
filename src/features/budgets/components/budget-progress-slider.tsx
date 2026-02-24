'use client';

import { useRef, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus, ArrowRight, Target, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatting';
import { AnimatedCurrency } from '@/components/animated-currency';
import { Button } from '@/components/ui/button';
import type { BudgetProgress } from '../types';

interface BudgetProgressSliderProps {
  budgets: BudgetProgress[];
  onAddTransaction?: (budgetId: string) => void;
}

function BudgetCard({ budget, onAddTransaction }: { budget: BudgetProgress; onAddTransaction?: (budgetId: string) => void }) {
  const isOverBudget = budget.spentAmount > budget.budgetedAmount;
  const categoryColor = budget.categoryColor || '#6366f1';
  const accentColor = isOverBudget ? '#ef4444' : categoryColor;

  return (
    <div
      className="h-full rounded-xl overflow-hidden"
      style={{
        background: isOverBudget
          ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%)'
          : `linear-gradient(135deg, ${categoryColor}15 0%, ${categoryColor}05 100%)`,
        border: `1px solid ${isOverBudget ? 'rgba(239, 68, 68, 0.4)' : `${categoryColor}30`}`
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: isOverBudget ? 'rgba(239, 68, 68, 0.2)' : `${categoryColor}20` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isOverBudget ? (
            <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            </div>
          ) : (
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: categoryColor }}
            />
          )}
          <span className="text-white font-medium text-sm truncate">{budget.name}</span>
        </div>
        {/* Botón + solo en desktop */}
        {onAddTransaction && (
          <Button
            variant="subtle"
            size="icon-sm"
            className="hidden md:flex"
            onClick={() => onAddTransaction(budget.id)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Monto principal */}
        <div className="text-center">
          <AnimatedCurrency
            value={Math.abs(budget.remainingAmount)}
            prefix={isOverBudget ? '-' : ''}
            className={`text-2xl font-bold ${isOverBudget ? 'text-red-400' : 'text-white'}`}
          />
          <p className="text-xs text-slate-400">
            {isOverBudget ? 'Excedido' : 'Disponible'} de {formatCurrency(budget.budgetedAmount)}
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="h-3 rounded-full bg-slate-700/50 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, budget.progressPercentage)}%`,
                backgroundColor: accentColor
              }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className={isOverBudget ? 'text-red-400' : 'text-slate-400'}>
              <AnimatedCurrency value={budget.spentAmount} className="text-xs" /> gastado
            </span>
            <span className={isOverBudget ? 'text-red-400' : 'text-slate-500'}>
              {Math.round(budget.progressPercentage)}%
            </span>
          </div>
        </div>

        {/* Botón agregar transacción - solo en mobile */}
        {onAddTransaction && (
          <Button
            variant="subtle"
            className="md:hidden w-full"
            onClick={() => onAddTransaction(budget.id)}
          >
            Nueva transacción
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function BudgetProgressSlider({ budgets, onAddTransaction }: BudgetProgressSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Calcular totales
  const totals = useMemo(() => {
    const totalBudgeted = budgets.reduce((sum, b) => sum + b.budgetedAmount, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.spentAmount, 0);
    const totalRemaining = totalBudgeted - totalSpent;
    const overallPercentage = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
    const isOverBudget = totalSpent > totalBudgeted;

    return { totalBudgeted, totalSpent, totalRemaining, overallPercentage, isOverBudget };
  }, [budgets]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 296; // card width + gap
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (budgets.length === 0) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950 p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
              <Target className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">Sin presupuestos</p>
              <p className="text-slate-400 text-xs">Crea presupuestos para controlar tus gastos</p>
            </div>
          </div>
          <Button asChild variant="secondary">
            <Link href="/dashboard/budgets">
              Crear presupuesto
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950 p-4 md:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-medium text-sm">Presupuestos</p>
            <p className="text-slate-400 text-xs">{budgets.length} activo{budgets.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Navigation buttons - hidden on mobile if few budgets */}
          <div className="hidden md:flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700"
              onClick={() => scroll('left')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700"
              onClick={() => scroll('right')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button asChild variant="secondary" size="icon">
            <Link href="/dashboard/budgets">
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Balance Summary - Mobile: compact single row / Desktop: 3 columns */}
      {/* Mobile Summary */}
      <div
        className="md:hidden progress-container bg-slate-700/30 rounded-xl p-4"
        style={{
          ['--fill-percentage' as string]: `${Math.min(100, totals.overallPercentage)}%`,
          ['--fill-color' as string]: totals.overallPercentage > 80 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(148, 163, 184, 0.12)',
        }}
      >
        <div className="progress-fill rounded-l-xl" />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 mb-1">
                {totals.isOverBudget ? 'Excedido del presupuesto' : 'Disponible para gastar'}
              </p>
              <AnimatedCurrency
                value={Math.abs(totals.totalRemaining)}
                prefix={totals.isOverBudget ? '-' : ''}
                className={`text-2xl font-bold ${totals.isOverBudget ? 'text-red-400' : 'text-emerald-400'}`}
              />
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">
                <AnimatedCurrency value={totals.totalSpent} className="text-xs" /> gastado ({Math.round(totals.overallPercentage)}%)
              </p>
              <p className="text-xs text-slate-500">
                de {formatCurrency(totals.totalBudgeted)}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-3 rounded-full bg-slate-600/50 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, totals.overallPercentage)}%`,
                backgroundColor: totals.isOverBudget ? '#ef4444' : totals.overallPercentage > 80 ? '#f59e0b' : '#10b981'
              }}
            />
          </div>
        </div>
      </div>

      {/* Desktop Summary */}
      <div className="hidden md:grid grid-cols-3 gap-3">
        <div className="bg-slate-700/30 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-white tabular-nums">
            {formatCurrency(totals.totalBudgeted)}
          </p>
          <p className="text-xs text-slate-400">Presupuestado</p>
        </div>
        <div className="bg-slate-700/30 rounded-xl p-3 text-center">
          <AnimatedCurrency
            value={Math.abs(totals.totalRemaining)}
            prefix={totals.isOverBudget ? '-' : ''}
            className={`text-xl font-bold ${totals.isOverBudget ? 'text-red-400' : 'text-emerald-400'}`}
          />
          <p className="text-xs text-slate-400">{totals.isOverBudget ? 'Excedido' : 'Disponible'}</p>
        </div>
        <div
          className="progress-container bg-slate-700/30 rounded-xl p-3 text-center"
          style={{
            ['--fill-percentage' as string]: `${Math.min(100, totals.overallPercentage)}%`,
            ['--fill-color' as string]: totals.overallPercentage > 80 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(148, 163, 184, 0.12)',
          }}
        >
          <div className="progress-fill rounded-l-xl" />
          <div className="relative z-10">
            <AnimatedCurrency
              value={totals.totalSpent}
              className={`text-xl font-bold ${totals.overallPercentage > 80 ? 'text-amber-400' : 'text-slate-300'}`}
            />
            <p className="text-xs text-slate-400">Gastado ({Math.round(totals.overallPercentage)}%)</p>
          </div>
        </div>
      </div>

      {/* Slider - Desktop: 4 tarjetas si <=4, o más compactas si >4 para mostrar parte de la siguiente */}
      <div
        ref={scrollRef}
        className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide pb-1 -mr-4 pr-4 md:-mr-5 md:pr-5"
        style={{
          scrollSnapType: 'x mandatory',
          ['--card-width' as string]: budgets.length > 4
            ? 'calc((100% - 4rem) / 4.5)'
            : 'calc((100% - 3rem) / 4)',
        }}
      >
        {budgets.map((budget) => (
          <div
            key={budget.id}
            className="flex-shrink-0 w-[72%] sm:w-[280px] md:w-[var(--card-width)]"
            style={{ scrollSnapAlign: 'start' }}
          >
            <BudgetCard budget={budget} onAddTransaction={onAddTransaction} />
          </div>
        ))}
      </div>
    </div>
  );
}
