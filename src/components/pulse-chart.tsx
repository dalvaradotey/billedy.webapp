'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/formatting';

export type PulsePoint = { day: number; total: number };

interface PulseChartProps {
  /** Acumulado real por día (1 = primer día del ciclo) */
  points: PulsePoint[];
  daysTotal: number;
  /** Techo (línea coral punteada) */
  cap: number;
  /** Donde arranca el ritmo ideal (lo fijo del ciclo) */
  baseline?: number;
  /** Monto proyectado al cierre */
  projection?: number;
  /** Un gasto que se está por registrar: dibuja el salto desde hoy */
  pendingAmount?: number;
  startLabel: string;
  midLabel?: string;
  endLabel: string;
  todayLabel: string;
  height?: number;
  showTooltip?: boolean;
  ariaLabel: string;
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

const compact = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2).replace('.', ',')}M` : `$${Math.round(n / 1000)}k`;

/**
 * Gráfico de ritmo de Pulso: acumulado real, proyección al cierre, ritmo ideal y techo.
 * Se dibuja al ancho real del contenedor para que textos y puntos no se deformen.
 */
export function PulseChart({
  points,
  daysTotal,
  cap,
  baseline = 0,
  projection,
  pendingAmount,
  startLabel,
  midLabel,
  endLabel,
  todayLabel,
  height = 186,
  showTooltip = true,
  ariaLabel,
}: PulseChartProps) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const top = 6;
  const base = height - 22;

  const last = points[points.length - 1] ?? { day: 1, total: baseline };
  const afterPending = pendingAmount ? last.total + pendingAmount : 0;
  const vmax = Math.max(cap, projection ?? 0, last.total, afterPending, 1) * 1.1;
  const span = Math.max(1, daysTotal - 1);
  const X = (day: number) => ((day - 1) / span) * W;
  const Y = (v: number) => base - (v / vmax) * (base - top);

  const line = points.map((p) => `${X(p.day).toFixed(1)},${Y(p.total).toFixed(1)}`).join(' ');
  const area = points.length
    ? `M${X(points[0].day).toFixed(1)},${base} L${line.split(' ').join(' L')} L${X(last.day).toFixed(1)},${base} Z`
    : '';
  const tX = X(last.day);
  const tY = Y(last.total);
  const capY = Y(cap);
  const idealAtToday = baseline + ((cap - baseline) * (last.day - 1)) / span;
  const over = (projection ?? 0) > cap;
  const pY = pendingAmount ? Y(afterPending) : 0;

  const grid = [vmax * 0.36, vmax * 0.72].map((v) => ({ y: Y(v), label: compact(v) }));
  const tipW = 118;
  const tipX = tX - tipW - 10 < 0 ? tX + 10 : tX - tipW - 10;
  const tipY = Math.max(0, tY - 52);

  return (
    <div ref={ref} className="w-full" style={{ height }}>
      {W > 0 && (
        <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} role="img" aria-label={ariaLabel} className="overflow-visible">
          {grid.map((g) => (
            <g key={g.y}>
              <line x1="0" x2={W} y1={g.y} y2={g.y} className="stroke-surface-3" />
              <text x={W} y={g.y - 4} textAnchor="end" className="fill-faint text-[10px]">{g.label}</text>
            </g>
          ))}
          <rect x="0" y="0" width={W} height={Math.max(0, capY)} className="fill-coral" fillOpacity={0.06} />
          <line x1="0" x2={W} y1={capY} y2={capY} className="stroke-coral" strokeWidth={1.5} strokeDasharray="5 5" />
          <text x="4" y={capY - 6} className="fill-coral-text text-[11px] font-extrabold">techo {formatCurrency(cap)}</text>
          <line x1="0" y1={Y(baseline)} x2={W} y2={capY} stroke="#5E5568" strokeWidth={1.5} strokeDasharray="1 4" strokeLinecap="round" />

          <path d={area} className="fill-amber" fillOpacity={0.14} />
          <polyline points={line} fill="none" className="stroke-amber" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />

          {projection != null && last.day < daysTotal && !pendingAmount && (
            <>
              <line x1={tX} y1={tY} x2={W} y2={Y(projection)} className="stroke-amber" strokeWidth={2.5} strokeDasharray="2 6" strokeLinecap="round" />
              <circle cx={W} cy={Y(projection)} r={5} className={over ? 'fill-surface stroke-coral' : 'fill-surface stroke-amber'} strokeWidth={2.5} />
              <text x={W - 2} y={Y(projection) - 11} textAnchor="end" className={over ? 'fill-coral-text text-[11px] font-extrabold' : 'fill-amber-text text-[11px] font-extrabold'}>
                cierre {compact(projection)}
              </text>
            </>
          )}

          <line x1={tX} x2={tX} y1={tY} y2={base} stroke="#F4EFE8" strokeOpacity={0.3} />
          {!pendingAmount && (
            <circle cx={tX} cy={Y(idealAtToday)} r={4} className="fill-background" stroke="#A79DB0" strokeWidth={2} />
          )}
          <circle cx={tX} cy={tY} r={6} className="fill-amber stroke-surface" strokeWidth={3} />

          {pendingAmount ? (
            <>
              <line x1={tX} y1={tY} x2={tX} y2={pY} className="stroke-coral" strokeWidth={4} strokeLinecap="round" />
              <circle cx={tX} cy={pY} r={7} className="fill-coral stroke-surface" strokeWidth={3} />
              <text x={tX + 12} y={pY + 4} className="fill-foreground text-[12px] font-extrabold">{formatCurrency(afterPending)}</text>
            </>
          ) : (
            showTooltip && (
              <g transform={`translate(${tipX},${tipY})`}>
                <rect width={tipW} height={40} rx={12} className="fill-cream" />
                <text x={10} y={16} className="fill-[#6B6172] text-[10px] font-bold uppercase">hoy · {todayLabel}</text>
                <text x={10} y={32} className="fill-cream-ink text-[14px] font-extrabold">{formatCurrency(last.total)}</text>
              </g>
            )
          )}

          <line x1="0" x2={W} y1={base} y2={base} className="stroke-line-strong" />
          <text x="0" y={height - 4} className="fill-faint text-[10px]">{startLabel}</text>
          {midLabel && <text x={W / 2} y={height - 4} textAnchor="middle" className="fill-faint text-[10px]">{midLabel}</text>}
          <text x={W} y={height - 4} textAnchor="end" className="fill-faint text-[10px]">{endLabel}</text>
        </svg>
      )}
    </div>
  );
}
