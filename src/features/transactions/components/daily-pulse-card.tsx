'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TransactionWithCategory, TransactionSummary } from '../types';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function formatCLP(amount: number, currency: string) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

function compact(amount: number) {
  const n = Math.abs(amount);
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2).replace('.', ',')}M` : `$${Math.round(n / 1000)}k`;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

interface DailyPulseCardProps {
  transactions: TransactionWithCategory[];
  summary: TransactionSummary;
  startDate: string;
  endDate: string;
  todayIso: string;
  currency: string;
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
  reconciledCount: number;
}

/**
 * Resumen del período con el pulso diario: barras de gasto por día y el acumulado encima.
 * Tocar un día filtra la lista; tocarlo de nuevo quita el filtro.
 */
export function DailyPulseCard({
  transactions,
  summary,
  startDate,
  endDate,
  todayIso,
  currency,
  selectedDay,
  onSelectDay,
  reconciledCount,
}: DailyPulseCardProps) {
  const [ref, W] = useWidth<HTMLDivElement>();

  const days = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    const count = Math.max(1, Math.min(62, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1));
    const byDay = new Map<string, { spent: number; income: number }>();
    for (const t of transactions) {
      const key = new Date(t.date).toISOString().slice(0, 10);
      const cur = byDay.get(key) ?? { spent: 0, income: 0 };
      if (t.type === 'expense') cur.spent += parseFloat(t.baseAmount);
      else cur.income += parseFloat(t.baseAmount);
      byDay.set(key, cur);
    }
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      return { iso, date: d, ...(byDay.get(iso) ?? { spent: 0, income: 0 }), future: iso > todayIso };
    });
  }, [transactions, startDate, endDate, todayIso]);

  const H = 130;
  const base = H - 20;
  const maxSpent = Math.max(1, ...days.map((d) => d.spent));
  const totalSpent = days.reduce((a, d) => a + d.spent, 0) || 1;
  const col = W / days.length;
  const barW = Math.max(3, Math.min(12, col - 3));
  let acc = 0;
  const cum: string[] = [];
  days.forEach((d, i) => {
    if (d.future) return;
    acc += d.spent;
    cum.push(`${(i * col + col / 2).toFixed(1)},${(base - (acc / totalSpent) * 92).toFixed(1)}`);
  });
  const todayIndex = days.findIndex((d) => d.iso === todayIso);
  const selected = selectedDay ? days.find((d) => d.iso === selectedDay) : null;
  const label = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;

  return (
    <section className="rounded-[28px] border border-line bg-surface px-3.5 pb-4 pt-4 md:px-5">
      <div className="grid grid-cols-3 gap-2 px-1">
        <div>
          <span className="block text-[11px] text-muted-foreground">Entró</span>
          <span className="num text-base font-extrabold text-jade">+{compact(summary.totalIncome)}</span>
        </div>
        <div>
          <span className="block text-[11px] text-muted-foreground">Salió</span>
          <span className="num text-base font-extrabold text-coral-text">−{compact(summary.totalExpense)}</span>
        </div>
        <div>
          <span className="block text-[11px] text-muted-foreground">Saldo de caja</span>
          <span className={cn('num text-base font-extrabold', summary.balance < 0 && 'text-coral-text')}>
            {formatCLP(summary.balance, currency)}
          </span>
        </div>
      </div>

      <div ref={ref} className="mt-3.5 w-full" style={{ height: H }}>
        {W > 0 && (
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gasto por día del período, con el acumulado" className="overflow-visible">
            {days.map((d, i) => {
              const h = d.future ? 3 : Math.max(3, (d.spent / maxSpent) * 92);
              const isSel = d.iso === selectedDay;
              const fill = d.future ? 'fill-line-strong' : isSel ? 'fill-cream' : d.income > 0 ? 'fill-jade' : 'fill-coral';
              return (
                <g key={d.iso}>
                  <rect
                    x={i * col + (col - barW) / 2}
                    y={base - h}
                    width={barW}
                    height={h}
                    rx={Math.min(3, barW / 2)}
                    className={fill}
                  />
                  {!d.future && (
                    <rect
                      x={i * col}
                      y={0}
                      width={col}
                      height={base}
                      fill="transparent"
                      className="cursor-pointer"
                      onClick={() => onSelectDay(isSel ? null : d.iso)}
                    >
                      <title>{`${WEEKDAYS[d.date.getUTCDay()]} ${label(d.date)}: −${formatCLP(d.spent, currency)}`}</title>
                    </rect>
                  )}
                </g>
              );
            })}
            {cum.length > 1 && (
              <polyline points={cum.join(' ')} fill="none" stroke="#F4EFE8" strokeOpacity={0.7} strokeWidth={2} strokeLinejoin="round" pointerEvents="none" />
            )}
            <line x1="0" x2={W} y1={base} y2={base} className="stroke-line-strong" />
            <text x="0" y={H - 4} className="fill-faint text-[10px]">{label(days[0].date)}</text>
            {todayIndex > 0 && todayIndex < days.length - 1 && (
              <text x={todayIndex * col + col / 2} y={H - 4} textAnchor="middle" className="fill-foreground text-[10px] font-extrabold">hoy</text>
            )}
            <text x={W} y={H - 4} textAnchor="end" className="fill-faint text-[10px]">{label(days[days.length - 1].date)}</text>
          </svg>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {selected && (
          <button
            type="button"
            onClick={() => onSelectDay(null)}
            className="flex min-h-8 items-center gap-1.5 rounded-full bg-cream px-3 text-xs font-extrabold text-cream-ink"
          >
            {WEEKDAYS[selected.date.getUTCDay()]} {label(selected.date)} · −{formatCLP(selected.spent, currency)}
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <span className="rounded-full bg-background px-2.5 py-1 text-xs text-[#CFC6D6]">
          {summary.pendingCount} {summary.pendingCount === 1 ? 'pendiente' : 'pendientes'}
        </span>
        <span className="rounded-full bg-background px-2.5 py-1 text-xs text-[#CFC6D6]">
          {reconciledCount} de {transactions.length} conciliados
        </span>
        <span className="ml-auto hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
          <span className="flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-lg bg-coral" />gasto del día</span>
          <span className="flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-lg bg-jade" />día con ingreso</span>
          <span className="flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-3.5 bg-[#CFC6D6]" />acumulado</span>
        </span>
      </div>
    </section>
  );
}
