'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ArrowRight, ChevronDown, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AnimatedCurrency } from '@/components/animated-currency';
import { CycleCascade, balanceColor } from '@/features/billing-cycles/components/cycle-cascade';
import { useDashboard } from '../hooks';

export function DashboardCycleBanner() {
  const { cycle } = useDashboard();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!cycle) return null;

  const { balance } = cycle;
  const progressPercentage = Math.round((cycle.daysElapsed / cycle.daysTotal) * 100);
  const hasProjection = balance.finalBalance.projected !== balance.finalBalance.real;

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

      <div className="mt-4 md:grid md:grid-cols-2 md:gap-6">
        {/* Saldo final + progreso */}
        <div className="bg-slate-700/30 rounded-xl p-4 md:self-start">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400 mb-1">Saldo final del ciclo</p>
              <AnimatedCurrency
                value={balance.finalBalance.real}
                className={`text-2xl font-bold ${balanceColor(balance.finalBalance.real, 'dark')}`}
              />
              <p className="text-[11px] text-slate-500">después de ahorro, con lo ya pagado</p>
            </div>
            {hasProjection && (
              <div className="text-right">
                <p className="text-xs text-slate-400 mb-1">Proyectado</p>
                <AnimatedCurrency
                  value={balance.finalBalance.projected}
                  className={`text-sm font-semibold ${balanceColor(balance.finalBalance.projected, 'dark')}`}
                />
                <p className="text-[11px] text-slate-500">con pendientes</p>
              </div>
            )}
          </div>

          <Progress value={progressPercentage} className="mt-3 h-3 bg-slate-600/50" />
          <p className="text-xs text-slate-500 mt-1 text-center">
            {cycle.daysRemaining} días restantes
          </p>
        </div>

        {/* Mobile: botón expandir detalles */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="md:hidden w-full min-h-11 flex items-center justify-center gap-2 py-2 text-slate-400 text-sm hover:text-white transition-colors"
          aria-expanded={isExpanded}
        >
          {balance.warnings.length > 0 && <AlertTriangle className="w-4 h-4 text-amber-400" />}
          {isExpanded ? 'Ocultar detalle' : 'Ver detalle'}
          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Cascada: siempre visible en desktop, expandible en mobile */}
        <div className={`${isExpanded ? 'block' : 'hidden'} md:block pb-1`}>
          <CycleCascade balance={balance} isOpen={cycle.status === 'open'} tone="dark" animated />
        </div>
      </div>
    </div>
  );
}
