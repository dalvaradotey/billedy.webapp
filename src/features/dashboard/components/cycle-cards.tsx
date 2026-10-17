'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/formatting';
import type { CycleHistoryPoint } from '@/features/billing-cycles/queries';
import { useDashboard } from '../hooks';

const MONTH_SHORT: Record<string, string> = {
  enero: 'Ene', febrero: 'Feb', marzo: 'Mar', abril: 'Abr', mayo: 'May', junio: 'Jun',
  julio: 'Jul', agosto: 'Ago', septiembre: 'Sep', octubre: 'Oct', noviembre: 'Nov', diciembre: 'Dic',
};

/** "Ciclo Octubre 2026" → "Oct" */
function cycleShort(name: string) {
  const word = name.toLowerCase().split(/\s+/).find((w) => MONTH_SHORT[w]);
  return word ? MONTH_SHORT[word] : name.slice(0, 3);
}

/** De lo que entró en el ciclo, a dónde se fue (cascada en una sola barra). */
export function CycleFlowCard() {
  const { cycle } = useDashboard();
  if (!cycle) return null;
  const b = cycle.balance;
  const entered = b.income.projected + b.reimbursements.projected;
  const savingsNet = b.savingsIn.projected - b.savingsOut.projected;
  const parts = [
    { label: 'Débito', value: b.debitExpenses.projected, color: 'bg-coral', dot: 'bg-coral' },
    { label: 'Pago TC', value: b.cardPayment.projected, color: 'bg-amber', dot: 'bg-amber' },
    { label: 'Ahorro', value: Math.max(0, savingsNet), color: 'bg-violet', dot: 'bg-violet' },
    { label: 'Saldo final', value: Math.max(0, b.finalBalance.projected), color: 'bg-jade', dot: 'bg-jade' },
  ];
  const pay = b.card.paymentBreakdown;

  return (
    <section className="rounded-[26px] border border-line bg-surface p-4 md:px-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-extrabold">
          De <span className="num">{formatCurrency(entered)}</span> que entraron
        </h2>
        <Link href="/dashboard/cycles" className="-my-2 inline-flex min-h-10 items-center px-1 text-xs font-bold text-jade">Ver ciclo</Link>
      </div>
      <div aria-hidden className="mt-3 flex h-3.5 gap-[3px]">
        {parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.label} className={`${p.color} rounded-[5px]`} style={{ flex: p.value }} />
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        {parts.map((p) => (
          <div key={p.label}>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden className={`h-2 w-2 rounded-full ${p.dot}`} />
              {p.label}
              {entered > 0 && <span className="text-faint">· {Math.round((p.value / entered) * 100)}%</span>}
            </dt>
            <dd className="num mt-0.5 text-base font-extrabold">{formatCurrency(p.value)}</dd>
          </div>
        ))}
      </dl>
      {(pay || b.card.spent > 0) && (
        <p className="mt-3 border-t border-surface-3 pt-2.5 text-xs leading-relaxed text-muted-foreground">
          {pay && (
            <>
              Pago TC: propio {formatCurrency(pay.own)}
              {pay.external > 0 && ` · de otros ${formatCurrency(pay.external)}`}
              {pay.reimbursable > 0 && ` · reembolsable ${formatCurrency(pay.reimbursable)}`}
              {pay.fund > 0 && ` · fondo ${formatCurrency(pay.fund)}`}.{' '}
            </>
          )}
          Lo gastado con tarjeta este ciclo ({formatCurrency(b.card.spent)}) se paga el próximo.
        </p>
      )}
    </section>
  );
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

/** Saldo final de los últimos ciclos como línea de pulso. */
export function CycleHistoryCard({ history }: { history: CycleHistoryPoint[] }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  if (history.length < 2) return null;

  const H = 112;
  const max = Math.max(...history.map((h) => h.finalBalance), 1);
  const min = Math.min(0, ...history.map((h) => h.finalBalance));
  const avg = Math.round(history.reduce((a, h) => a + h.finalBalance, 0) / history.length);
  const step = W / history.length;
  const Y = (v: number) => 96 - ((v - min) / (max - min || 1)) * 86;
  const pts = history.map((h, i) => ({ ...h, x: step * i + step / 2, y: Y(h.finalBalance) }));
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `M${pts[0].x.toFixed(1)},96 L${line.split(' ').join(' L')} L${pts[pts.length - 1].x.toFixed(1)},96 Z`;

  return (
    <section className="rounded-[26px] border border-line bg-surface p-4 md:px-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-extrabold">Saldo final por ciclo</h2>
        <span className="text-xs text-muted-foreground">
          promedio <span className="num font-bold text-foreground">{formatCurrency(avg)}</span>
        </span>
      </div>
      <div ref={ref} className="mt-3 w-full" style={{ height: H }}>
        {W > 0 && (
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Saldo final de los últimos ciclos" className="overflow-visible">
            <line x1="0" x2={W} y1={Y(avg)} y2={Y(avg)} className="stroke-line-strong" strokeDasharray="4 5" />
            <path d={area} className="fill-jade" fillOpacity={0.12} />
            <polyline points={line} fill="none" className="stroke-jade" strokeWidth={2.5} strokeLinejoin="round" />
            {pts.map((p) => (
              <g key={p.id}>
                <circle cx={p.x} cy={p.y} r={p.isOpen ? 6 : 3.5} className={p.isOpen ? 'fill-jade stroke-jade' : 'fill-surface stroke-jade'} strokeWidth={2.5}>
                  <title>{`${p.name}: ${formatCurrency(p.finalBalance)}`}</title>
                </circle>
                <text x={p.x} y={H - 2} textAnchor="middle" className={p.isOpen ? 'fill-foreground text-[11px] font-extrabold' : 'fill-muted-foreground text-[11px]'}>
                  {cycleShort(p.name)}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>
    </section>
  );
}
