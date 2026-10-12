'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/formatting';

export type PulsePoint = { day: number; total: number };

/**
 * - `cap`: gasto acumulado contra un techo (ámbar, techo coral, ritmo ideal).
 * - `target`: ahorro acumulado contra una meta (violeta, ritmo ideal hacia la meta).
 * - `balance`: saldo del ciclo que sube y baja (jade, línea de cero, proyección al cierre).
 */
export type PulseVariant = 'cap' | 'target' | 'balance';

interface PulseChartProps {
  /** Acumulado real por día (1 = primer día del ciclo) */
  points: PulsePoint[];
  daysTotal: number;
  /** Techo o meta (no aplica en `balance`) */
  cap?: number;
  variant?: PulseVariant;
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

const STYLES: Record<PulseVariant, { line: string; area: string; dot: string; capLine: string; capText: string; capLabel: string }> = {
  cap: { line: 'stroke-amber', area: 'fill-amber', dot: 'fill-amber', capLine: 'stroke-coral', capText: 'fill-coral-text', capLabel: 'techo' },
  target: { line: 'stroke-violet', area: 'fill-violet', dot: 'fill-violet', capLine: 'stroke-violet', capText: 'fill-violet-text', capLabel: 'meta' },
  balance: { line: 'stroke-jade', area: 'fill-jade', dot: 'fill-jade', capLine: 'stroke-line-strong', capText: 'fill-faint', capLabel: '' },
};

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

const compact = (n: number) => {
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(n);
  return a >= 1_000_000 ? `${sign}$${(a / 1_000_000).toFixed(2).replace('.', ',')}M` : `${sign}$${Math.round(a / 1000)}k`;
};

/**
 * Gráfico de ritmo de Pulso. Se dibuja al ancho real del contenedor para que
 * textos y puntos no se deformen.
 */
export function PulseChart({
  points,
  daysTotal,
  cap,
  variant = 'cap',
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
  const st = STYLES[variant];
  const top = 6;
  const base = height - 22;
  const hasCap = variant !== 'balance' && cap != null;

  const last = points[points.length - 1] ?? { day: 1, total: baseline };
  const afterPending = pendingAmount ? last.total + pendingAmount : 0;
  const values = [last.total, afterPending, projection ?? 0, hasCap ? cap! : 0, ...points.map((p) => p.total)];
  const vmaxRaw = Math.max(...values, 1);
  const vminRaw = Math.min(0, ...values);
  const span = vmaxRaw - vminRaw || 1;
  const vmax = vmaxRaw + span * 0.1;
  const vmin = vminRaw < 0 ? vminRaw - span * 0.08 : 0;
  const dspan = Math.max(1, daysTotal - 1);
  const X = (day: number) => ((day - 1) / dspan) * W;
  const Y = (v: number) => base - ((v - vmin) / (vmax - vmin)) * (base - top);

  const zeroY = Y(0);
  const line = points.map((p) => `${X(p.day).toFixed(1)},${Y(p.total).toFixed(1)}`).join(' ');
  const area = points.length
    ? `M${X(points[0].day).toFixed(1)},${zeroY} L${line.split(' ').join(' L')} L${X(last.day).toFixed(1)},${zeroY} Z`
    : '';
  const tX = X(last.day);
  const tY = Y(last.total);
  const capY = hasCap ? Y(cap!) : 0;
  const idealAtToday = hasCap ? baseline + ((cap! - baseline) * (last.day - 1)) / dspan : 0;
  const over = variant === 'cap' && (projection ?? 0) > (cap ?? Infinity);
  const endTone =
    variant === 'cap'
      ? over ? 'coral' : 'amber'
      : variant === 'target'
        ? (projection ?? 0) >= (cap ?? 0) ? 'violet' : 'amber'
        : (projection ?? 0) >= 0 ? 'jade' : 'coral';
  const END_CLASSES = {
    coral: { stroke: 'stroke-coral', text: 'fill-coral-text' },
    amber: { stroke: 'stroke-amber', text: 'fill-amber-text' },
    violet: { stroke: 'stroke-violet', text: 'fill-violet-text' },
    jade: { stroke: 'stroke-jade', text: 'fill-jade-text' },
  } as const;
  const pY = pendingAmount ? Y(afterPending) : 0;

  const gridValues = [vmin + (vmax - vmin) * 0.36, vmin + (vmax - vmin) * 0.72];
  const tipW = 118;
  const tipX = tX - tipW - 10 < 0 ? tX + 10 : tX - tipW - 10;
  const tipY = Math.max(0, tY - 52);

  return (
    <div ref={ref} className="w-full" style={{ height }}>
      {W > 0 && (
        <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} role="img" aria-label={ariaLabel} className="overflow-visible">
          {gridValues.map((v) => (
            <g key={v}>
              <line x1="0" x2={W} y1={Y(v)} y2={Y(v)} className="stroke-surface-3" />
              <text x={W} y={Y(v) - 4} textAnchor="end" className="fill-faint text-[10px]">{compact(v)}</text>
            </g>
          ))}

          {variant === 'balance' && vmin < 0 && (
            <line x1="0" x2={W} y1={zeroY} y2={zeroY} className="stroke-line-strong" strokeDasharray="3 4" />
          )}

          {hasCap && (
            <>
              {variant === 'cap' && <rect x="0" y="0" width={W} height={Math.max(0, capY)} className="fill-coral" fillOpacity={0.06} />}
              <line x1="0" x2={W} y1={capY} y2={capY} className={st.capLine} strokeWidth={1.5} strokeDasharray="5 5" />
              <text x="4" y={capY - 6} className={`${st.capText} text-[11px] font-extrabold`}>
                {st.capLabel} {formatCurrency(cap!)}
              </text>
              <line x1="0" y1={Y(baseline)} x2={W} y2={capY} stroke="#5E5568" strokeWidth={1.5} strokeDasharray="1 4" strokeLinecap="round" />
            </>
          )}

          <path d={area} className={st.area} fillOpacity={0.14} />
          <polyline points={line} fill="none" className={st.line} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />

          {projection != null && last.day < daysTotal && !pendingAmount && (
            <>
              <line x1={tX} y1={tY} x2={W} y2={Y(projection)} className={st.line} strokeWidth={2.5} strokeDasharray="2 6" strokeLinecap="round" />
              <circle cx={W} cy={Y(projection)} r={5} className={`fill-surface ${END_CLASSES[endTone].stroke}`} strokeWidth={2.5} />
              <text x={W - 2} y={Y(projection) - 11} textAnchor="end" className={`${END_CLASSES[endTone].text} text-[11px] font-extrabold`}>
                cierre {compact(projection)}
              </text>
            </>
          )}

          <line x1={tX} x2={tX} y1={tY} y2={base} stroke="#F4EFE8" strokeOpacity={0.3} />
          {hasCap && !pendingAmount && (
            <circle cx={tX} cy={Y(idealAtToday)} r={4} className="fill-background" stroke="#A79DB0" strokeWidth={2} />
          )}
          <circle cx={tX} cy={tY} r={6} className={`${st.dot} stroke-surface`} strokeWidth={3} />

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
