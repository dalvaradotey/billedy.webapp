'use client';

import Link from 'next/link';
import { CalendarDays, ArrowRight, TrendingUp, TrendingDown, PiggyBank, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/formatting';
import { Progress } from '@/components/ui/progress';
import type { BillingCycleWithTotals } from '../types';

interface CycleSummaryBannerProps {
  cycle: BillingCycleWithTotals;
}

export function CycleSummaryBanner({ cycle }: CycleSummaryBannerProps) {
  const progressPercentage = Math.round((cycle.daysElapsed / cycle.daysTotal) * 100);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950 p-4 md:p-5 space-y-4">
      {/* Header con nombre del ciclo y progreso */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-medium text-sm">{cycle.name}</p>
            <p className="text-slate-400 text-xs">
              {cycle.daysElapsed} de {cycle.daysTotal} días
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/cycles"
          className="hidden md:flex p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
        >
          <ArrowRight className="w-4 h-4 text-white" />
        </Link>
      </div>

      {/* Barra de progreso */}
      <div className="space-y-1.5">
        <Progress value={progressPercentage} className="h-3 bg-slate-700" />
        <div className="flex justify-between text-xs text-slate-500">
          <span>{cycle.daysElapsed} días transcurridos</span>
          <span>{cycle.daysRemaining} días restantes</span>
        </div>
      </div>

      {/* Separador */}
      <div className="h-px bg-slate-700" />

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Ingresos
          </p>
          <p className="text-emerald-400 font-bold text-lg">
            {formatCurrency(cycle.currentIncome)}
          </p>
        </div>
        <div>
          <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1">
            <TrendingDown className="w-3 h-3" />
            Gastos
          </p>
          <p className="text-red-400 font-bold text-lg">
            {formatCurrency(cycle.currentExpenses)}
          </p>
        </div>
        <div>
          <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1">
            <PiggyBank className="w-3 h-3" />
            Ahorro
          </p>
          <p className="text-blue-400 font-bold text-lg">
            {formatCurrency(cycle.currentSavings)}
          </p>
        </div>
        <div>
          <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1">
            <Wallet className="w-3 h-3" />
            Balance
          </p>
          <p className={`font-bold text-lg ${cycle.currentBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(cycle.currentBalance)}
          </p>
        </div>
      </div>

      {/* Link móvil */}
      <Link
        href="/dashboard/cycles"
        className="md:hidden flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-white text-sm"
      >
        Ver ciclos
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
