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
  /** Fecha de un día del ciclo, para el valor al recorrer el gráfico (por defecto "día N") */
  dayLabel?: (day: number) => string;
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
  dayLabel = (d) => `día ${d}`,
  height = 186,
  showTooltip = true,
  ariaLabel,
}: PulseChartProps) {
  const [ref, W] = useWidth<HTMLDivElement>();
  // Día bajo el dedo o el mouse: al recorrer el gráfico se ve el valor de cada día
  const [scrubDay, setScrubDay] = useState<number | null>(null);
  const pressing = useRef(false);
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
  // Si la burbuja de hoy tapa la etiqueta del techo, la etiqueta baja bajo la línea
  const capLabelBelow = showTooltip && !pendingAmount && tipX < 150 && tipY < capY + 4 && tipY + 40 > capY - 18;

  const dayAt = (clientX: number, el: Element) => {
    const x = clientX - el.getBoundingClientRect().left;
    return Math.min(daysTotal, Math.max(1, Math.round((x / Math.max(1, W)) * dspan) + 1));
  };
  const scrub = (() => {
    if (scrubDay == null || !points.length) return null;
    const real = scrubDay <= last.day;
    let value: number;
    if (real) {
      // El acumulado de un día es el del último punto hasta ese día
      const p = [...points].reverse().find((pt) => pt.day <= scrubDay);
      value = p ? p.total : baseline;
    } else if (projection != null && !pendingAmount) {
      value = last.total + ((projection - last.total) * (scrubDay - last.day)) / Math.max(1, daysTotal - last.day);
    } else {
      return null;
    }
    const ideal = hasCap ? baseline + ((cap! - baseline) * (scrubDay - 1)) / dspan : null;
    return { day: scrubDay, real, value, ideal, x: X(scrubDay), y: Y(value) };
  })();
  const scrubTipW = 132;
  const scrubTipH = scrub?.ideal != null ? 54 : 40;
  const scrubTipX = scrub ? Math.min(Math.max(0, scrub.x - scrubTipW / 2), Math.max(0, W - scrubTipW)) : 0;
  const scrubTipY = scrub ? (scrub.y - scrubTipH - 14 >= 0 ? scrub.y - scrubTipH - 14 : Math.min(base - scrubTipH, scrub.y + 14)) : 0;

  return (
    <div
      ref={ref}
      className="w-full touch-pan-y select-none"
      style={{ height }}
      onPointerDown={(e) => {
        pressing.current = true;
        setScrubDay(dayAt(e.clientX, e.currentTarget));
      }}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse' || pressing.current) setScrubDay(dayAt(e.clientX, e.currentTarget));
      }}
      onPointerUp={(e) => {
        pressing.current = false;
        if (e.pointerType !== 'mouse') setScrubDay(null);
      }}
      onPointerCancel={() => {
        pressing.current = false;
        setScrubDay(null);
      }}
      onPointerLeave={() => {
        pressing.current = false;
        setScrubDay(null);
      }}
    >
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
              <text x="4" y={capLabelBelow ? capY + 15 : capY - 6} className={`${st.capText} text-[11px] font-extrabold`}>
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
            showTooltip && !scrub && (
              <g transform={`translate(${tipX},${tipY})`}>
                <rect width={tipW} height={40} rx={12} className="fill-cream" />
                <text x={10} y={16} className="fill-[#6B6172] text-[10px] font-bold uppercase">hoy · {todayLabel}</text>
                <text x={10} y={32} className="fill-cream-ink text-[14px] font-extrabold">{formatCurrency(last.total)}</text>
              </g>
            )
          )}

          {scrub && (
            <g pointerEvents="none">
              <line x1={scrub.x} x2={scrub.x} y1={top} y2={base} stroke="#F4EFE8" strokeOpacity={0.45} strokeDasharray="2 3" />
              {scrub.ideal != null && <circle cx={scrub.x} cy={Y(scrub.ideal)} r={3.5} className="fill-background" stroke="#A79DB0" strokeWidth={2} />}
              <circle
                cx={scrub.x}
                cy={scrub.y}
                r={5.5}
                className={scrub.real ? `${st.dot} stroke-surface` : `fill-surface ${st.line}`}
                strokeWidth={scrub.real ? 3 : 2.5}
              />
              <g transform={`translate(${scrubTipX},${scrubTipY})`}>
                <rect width={scrubTipW} height={scrubTipH} rx={12} className="fill-cream" />
                <text x={10} y={16} className="fill-[#6B6172] text-[10px] font-bold uppercase">
                  {scrub.day === last.day ? `hoy · ${todayLabel}` : dayLabel(scrub.day)}
                  {!scrub.real && ' · proyección'}
                </text>
                <text x={10} y={32} className="fill-cream-ink text-[14px] font-extrabold">{formatCurrency(Math.round(scrub.value))}</text>
                {scrub.ideal != null && (
                  <text x={10} y={47} className="fill-[#6B6172] text-[10px] font-bold">
                    {variant === 'cap' ? 'ritmo sano' : 'ritmo a la meta'} {compact(scrub.ideal)}
                  </text>
                )}
              </g>
            </g>
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
