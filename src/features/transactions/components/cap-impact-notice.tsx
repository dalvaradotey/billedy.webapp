'use client';

import { useState } from 'react';
import { ChevronRight, TrendingUp, X } from 'lucide-react';
import { PulseChart } from '@/components/pulse-chart';
import { formatCurrency } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import type { CardImpactData } from '@/features/billing-cycles/actions';
import { MONTHS_SHORT as MONTHS } from '@/lib/dates';

/** Umbral de "cerca del techo": el gasto te deja sobre este porcentaje del techo. */
const NEAR_CAP_RATIO = 0.9;

const label = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

interface CapImpactNoticeProps {
  data: CardImpactData;
  amount: number;
  /** Cambiar la naturaleza a "de otra persona" (no cuenta para el techo) */
  onNotMine?: () => void;
}

/**
 * Aviso compacto del techo de tarjeta: solo aparece si el gasto te deja cerca del techo
 * (ámbar) o te pasa (coral). Al tocarlo, el gráfico de ritmo se abre encima del formulario.
 */
export function CapImpactNotice({ data, amount, onNotMine }: CapImpactNoticeProps) {
  const [open, setOpen] = useState(false);
  const after = data.spent + amount;
  const over = after > data.cap;
  const near = !over && data.cap > 0 && after >= data.cap * NEAR_CAP_RATIO;

  if (!amount || (!over && !near)) return null;

  const remainingDays = Math.max(0, data.daysTotal - data.daysElapsed);
  const variable = Math.max(0, after - data.committedFixed);
  const projectionAfter = Math.round(
    Math.max(after, data.committedFixed + variable * (data.daysTotal / Math.max(1, data.daysElapsed)))
  );
  const todayIso = (() => {
    const d = new Date(`${data.startDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + Math.max(0, data.daysElapsed - 1));
    return d.toISOString().slice(0, 10);
  })();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className={cn(
          'flex min-h-[50px] w-full items-center gap-2.5 rounded-2xl pl-3.5 pr-3 text-left',
          over ? 'bg-coral-soft text-coral-text' : 'bg-amber-soft text-amber-text'
        )}
      >
        <TrendingUp className="h-[18px] w-[18px] shrink-0" strokeWidth={2.2} />
        <span className="flex-1 text-[13px] leading-snug">
          {over ? (
            <>Te pasas del techo por <strong className="num">{formatCurrency(after - data.cap)}</strong></>
          ) : (
            <>Te quedarían solo <strong className="num">{formatCurrency(data.cap - after)}</strong> de techo</>
          )}
        </span>
        <span className="text-xs font-extrabold text-foreground">Ver impacto</span>
        <ChevronRight className="h-3.5 w-3.5 text-foreground" strokeWidth={2.6} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 md:items-center" data-vaul-no-drag>
          <button
            type="button"
            aria-label="Cerrar impacto"
            className="absolute inset-0 bg-[#0E0C12]/80"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Impacto en tu ritmo"
            className="relative w-full max-w-[420px] rounded-[26px] border border-line-strong bg-surface-2 px-4 pb-4 pt-[18px] animate-fade-in"
          >
            <div className="flex items-center justify-between">
              <span className="text-base font-extrabold">Impacto en tu ritmo</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-muted-foreground"
              >
                <X className="h-4 w-4" strokeWidth={2.4} />
              </button>
            </div>
            <div className="mt-2.5 flex items-center gap-2.5">
              <div>
                <span className="block text-[11px] text-muted-foreground">Antes</span>
                <span className="num text-lg font-extrabold text-amber">{formatCurrency(data.spent)}</span>
              </div>
              <span aria-hidden className="text-muted-foreground">→</span>
              <div>
                <span className="block text-[11px] text-muted-foreground">Con este gasto</span>
                <span className={cn('num text-lg font-extrabold', over ? 'text-coral' : 'text-amber-text')}>
                  {formatCurrency(after)}
                </span>
              </div>
            </div>
            <div className="mt-3.5">
              <PulseChart
                points={data.points}
                daysTotal={data.daysTotal}
                cap={data.cap}
                baseline={data.committedFixed}
                pendingAmount={amount}
                startLabel={label(data.startDate)}
                endLabel={label(data.endDate)}
                todayLabel={label(todayIso)}
                height={170}
                ariaLabel={`Con este gasto, el acumulado pasa de ${formatCurrency(data.spent)} a ${formatCurrency(after)}; techo ${formatCurrency(data.cap)}`}
              />
            </div>
            <p className="mt-3.5 text-[13px] leading-relaxed text-subtle">
              {over
                ? `Quedarías sin techo para ${remainingDays === 1 ? 'el día que falta' : `los ${remainingDays} días que faltan`}`
                : `Te quedarían ${formatCurrency(data.cap - after)} para ${remainingDays === 1 ? '1 día' : `${remainingDays} días`}`}
              {' '}y al ritmo actual cerrarías en <strong className="num text-foreground">{formatCurrency(projectionAfter)}</strong>.
            </p>
            <div className="mt-3.5 grid grid-cols-2 gap-2">
              {onNotMine ? (
                <button
                  type="button"
                  onClick={() => {
                    onNotMine();
                    setOpen(false);
                  }}
                  className="min-h-12 rounded-full border border-line-strong text-[13px] font-extrabold"
                >
                  No es mío
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-12 rounded-full bg-cream text-[13px] font-extrabold text-cream-ink"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
