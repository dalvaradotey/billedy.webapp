'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus, ArrowRight, Target } from 'lucide-react';
import { formatCurrency } from '@/lib/formatting';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import type { BudgetProgress } from '../types';

interface BudgetProgressSliderProps {
  budgets: BudgetProgress[];
  onAddTransaction?: (budgetId: string) => void;
}

function BudgetCard({ budget, onAddTransaction }: { budget: BudgetProgress; onAddTransaction?: (budgetId: string) => void }) {
  const isOverBudget = budget.spentAmount > budget.budgetedAmount;
  const progressColor = isOverBudget
    ? 'bg-red-500'
    : budget.progressPercentage >= 80
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  return (
    <div className="flex-shrink-0 w-[280px] rounded-xl bg-slate-700/50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {budget.categoryColor && (
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: budget.categoryColor }}
            />
          )}
          <span className="text-white font-medium text-sm truncate">{budget.name}</span>
        </div>
        {/* Botón + solo en desktop */}
        {onAddTransaction && (
          <Button
            variant="secondary"
            size="icon-sm"
            className="hidden md:flex"
            onClick={() => onAddTransaction(budget.id)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <Progress
          value={Math.min(100, budget.progressPercentage)}
          className="h-2 bg-slate-600"
          indicatorClassName={progressColor}
        />
        <div className="flex justify-between text-xs">
          <span className={isOverBudget ? 'text-red-400' : 'text-slate-400'}>
            {formatCurrency(budget.spentAmount)}
          </span>
          <span className="text-slate-500">
            {formatCurrency(budget.budgetedAmount)}
          </span>
        </div>
      </div>

      {/* Remaining */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {isOverBudget ? 'Excedido' : 'Disponible'}
        </span>
        <span className={`text-sm font-semibold ${isOverBudget ? 'text-red-400' : 'text-emerald-400'}`}>
          {isOverBudget ? '-' : ''}{formatCurrency(Math.abs(budget.remainingAmount))}
        </span>
      </div>

      {/* Botón agregar transacción - solo en mobile */}
      {onAddTransaction && (
        <Button
          variant="secondary"
          className="md:hidden w-full"
          onClick={() => onAddTransaction(budget.id)}
        >
          Nueva transacción
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function BudgetProgressSlider({ budgets, onAddTransaction }: BudgetProgressSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

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

      {/* Slider */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-1 -mr-4 pr-4 md:mr-0 md:pr-0"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {budgets.map((budget) => (
          <div key={budget.id} style={{ scrollSnapAlign: 'start' }}>
            <BudgetCard budget={budget} onAddTransaction={onAddTransaction} />
          </div>
        ))}
      </div>
    </div>
  );
}
