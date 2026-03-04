'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ArrowRight, TrendingUp, TrendingDown, PiggyBank, Wallet, ChevronDown } from 'lucide-react';
import { formatCurrency } from '@/lib/formatting';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import type { BillingCycleWithTotals } from '../types';

interface CycleSummaryBannerProps {
  cycle: BillingCycleWithTotals;
}

export function CycleSummaryBanner({ cycle }: CycleSummaryBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const progressPercentage = Math.round((cycle.daysElapsed / cycle.daysTotal) * 100);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950 p-4 md:p-5">
      {/* Header con nombre del ciclo */}
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
        <Button asChild variant="secondary" size="icon">
          <Link href="/dashboard/cycles">
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>

      {/* Mobile: Resumen compacto con saldo y botón expandir */}
      <div className="md:hidden mt-4">
        <div className="bg-slate-700/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 mb-1">Saldo del ciclo</p>
              <p className={`text-2xl font-bold tabular-nums ${cycle.currentBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(cycle.currentBalance)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">
                {formatCurrency(cycle.currentIncome)} ingresos
              </p>
              <p className="text-xs text-slate-500">
                {formatCurrency(cycle.currentExpenses)} gastos
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <Progress
            value={progressPercentage}
            className="mt-3 h-3 bg-slate-600/50"
          />
          <p className="text-xs text-slate-500 mt-1 text-center">
            {cycle.daysRemaining} días restantes
          </p>
        </div>

        {/* Botón expandir detalles */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center gap-2 py-2 text-slate-400 text-sm hover:text-white transition-colors"
        >
          {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Detalles expandibles */}
        {isExpanded && (
          <div className="grid grid-cols-2 gap-3 pb-1">
            <div className="bg-slate-700/30 rounded-lg p-3">
              <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Ingresos
              </p>
              <p className="text-emerald-400 font-bold">
                {formatCurrency(cycle.currentIncome)}
              </p>
              {cycle.pendingIncome > 0 && (
                <p className="text-slate-500 text-[10px] mt-0.5">
                  Pagado: {formatCurrency(cycle.paidIncome)} · Pend: {formatCurrency(cycle.pendingIncome)}
                </p>
              )}
            </div>
            <div className="bg-slate-700/30 rounded-lg p-3">
              <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                Gastos
              </p>
              <p className="text-red-400 font-bold">
                {formatCurrency(cycle.currentExpenses)}
              </p>
              {cycle.pendingExpenses > 0 && (
                <p className="text-slate-500 text-[10px] mt-0.5">
                  Pagado: {formatCurrency(cycle.paidExpenses)} · Pend: {formatCurrency(cycle.pendingExpenses)}
                </p>
              )}
            </div>
            <div className="bg-slate-700/30 rounded-lg p-3">
              <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1">
                <PiggyBank className="w-3 h-3" />
                Ahorro
              </p>
              <p className="text-blue-400 font-bold">
                {formatCurrency(cycle.currentSavings)}
              </p>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-3">
              <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1">
                <Wallet className="w-3 h-3" />
                Saldo
              </p>
              <p className={`font-bold ${cycle.currentBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(cycle.currentBalance)}
              </p>
              <p className="text-slate-500 text-[10px] mt-0.5">en base a pagados</p>
            </div>
          </div>
        )}
      </div>

      {/* Desktop: Contenido completo */}
      <div className="hidden md:block mt-4 space-y-4">
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
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Ingresos
            </p>
            <p className="text-emerald-400 font-bold text-lg">
              {formatCurrency(cycle.currentIncome)}
            </p>
            {cycle.pendingIncome > 0 && (
              <p className="text-slate-500 text-[10px] mt-0.5">
                Pagado: {formatCurrency(cycle.paidIncome)} · Pend: {formatCurrency(cycle.pendingIncome)}
              </p>
            )}
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              Gastos
            </p>
            <p className="text-red-400 font-bold text-lg">
              {formatCurrency(cycle.currentExpenses)}
            </p>
            {cycle.pendingExpenses > 0 && (
              <p className="text-slate-500 text-[10px] mt-0.5">
                Pagado: {formatCurrency(cycle.paidExpenses)} · Pend: {formatCurrency(cycle.pendingExpenses)}
              </p>
            )}
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
              Saldo
            </p>
            <p className={`font-bold text-lg ${cycle.currentBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(cycle.currentBalance)}
            </p>
            <p className="text-slate-500 text-[10px] mt-0.5">en base a pagados</p>
          </div>
        </div>
      </div>
    </div>
  );
}
