'use client';

import { AlertTriangle, CreditCard } from 'lucide-react';
import { AnimatedCurrency } from '@/components/animated-currency';
import { formatCurrency } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import type { CycleBalance, CycleWarning } from '../types';

type Tone = 'light' | 'dark';

const TONES = {
  light: {
    label: 'text-muted-foreground',
    value: 'text-foreground',
    divider: 'border-border',
    positive: 'text-emerald-600 dark:text-emerald-400',
    negative: 'text-red-600 dark:text-red-400',
    muted: 'text-muted-foreground',
    info: 'bg-muted/40 dark:bg-muted/20',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  dark: {
    label: 'text-slate-400',
    value: 'text-slate-100',
    divider: 'border-slate-700',
    positive: 'text-emerald-400',
    negative: 'text-red-400',
    muted: 'text-slate-500',
    info: 'bg-slate-700/30',
    warning: 'bg-amber-500/15 text-amber-300',
  },
} as const;

export function balanceColor(value: number, tone: Tone = 'light'): string {
  return value >= 0 ? TONES[tone].positive : TONES[tone].negative;
}

function Amount({ value, animated, className }: { value: number; animated?: boolean; className?: string }) {
  if (animated) return <AnimatedCurrency value={value} className={cn('tabular-nums', className)} />;
  return <span className={cn('tabular-nums', className)}>{formatCurrency(value)}</span>;
}

interface CycleCascadeProps {
  balance: CycleBalance;
  isOpen: boolean;
  tone?: Tone;
  animated?: boolean;
}

/**
 * Cascada de caja del ciclo:
 * Ingresos + Abonos − Débito − Pago TC = Saldo antes de ahorro − Ahorro = Saldo final
 */
export function CycleCascade({ balance, isOpen, tone = 'light', animated }: CycleCascadeProps) {
  const t = TONES[tone];
  const savingsNet = balance.savingsIn.real - balance.savingsOut.real;
  const pendingCardPayment = balance.card.pendingPayment;
  const hasPendingItems = isOpen && balance.finalBalance.projected !== balance.finalBalance.real;

  const rows: Array<{ label: string; value: number; sign: '+' | '−'; hint?: string; hidden?: boolean }> = [
    { label: 'Ingresos', value: balance.income.real, sign: '+' },
    { label: 'Abonos y reembolsos', value: balance.reimbursements.real, sign: '+', hidden: balance.reimbursements.real === 0 },
    { label: 'Gastos débito', value: balance.debitExpenses.real, sign: '−' },
    {
      label: 'Pago TC',
      value: balance.cardPayment.real,
      sign: '−',
      hint:
        pendingCardPayment > 0
          ? `Falta pagar ${formatCurrency(pendingCardPayment)}`
          : paymentBreakdownText(balance),
    },
  ];

  return (
    <div className="space-y-3">
      <dl className="space-y-1.5 text-sm">
        {rows
          .filter((row) => !row.hidden)
          .map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <dt className={t.label}>
                {row.label}
                {row.hint && <span className={cn('block text-[11px]', t.muted)}>{row.hint}</span>}
              </dt>
              <dd className={cn('font-medium', t.value)}>
                {row.sign === '−' && row.value > 0 ? '−' : ''}
                <Amount value={row.value} animated={animated} />
              </dd>
            </div>
          ))}

        <div className={cn('flex items-baseline justify-between gap-3 border-t pt-1.5', t.divider)}>
          <dt className={cn('font-medium', t.value)}>Saldo antes de ahorro</dt>
          <dd className={cn('font-semibold', balanceColor(balance.balanceBeforeSavings.real, tone))}>
            <Amount value={balance.balanceBeforeSavings.real} animated={animated} />
          </dd>
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <dt className={t.label}>
            Aportes a ahorro
            {balance.savingsOut.real > 0 && (
              <span className={cn('block text-[11px]', t.muted)}>
                Neto de retiros por {formatCurrency(balance.savingsOut.real)}
              </span>
            )}
          </dt>
          <dd className={cn('font-medium', t.value)}>
            {savingsNet > 0 ? '−' : ''}
            <Amount value={Math.abs(savingsNet)} animated={animated} />
          </dd>
        </div>

        <div className={cn('flex items-baseline justify-between gap-3 border-t pt-1.5', t.divider)}>
          <dt className={cn('font-semibold', t.value)}>Saldo final</dt>
          <dd className={cn('text-base font-bold', balanceColor(balance.finalBalance.real, tone))}>
            <Amount value={balance.finalBalance.real} animated={animated} />
          </dd>
        </div>

        {hasPendingItems && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className={cn('text-xs', t.muted)}>Proyectado con pendientes</dt>
            <dd className={cn('text-xs font-medium', balanceColor(balance.finalBalance.projected, tone))}>
              <Amount value={balance.finalBalance.projected} animated={animated} />
            </dd>
          </div>
        )}
      </dl>

      <div className={cn('flex items-start gap-2 rounded-lg p-2.5 text-xs', t.info)}>
        <CreditCard className={cn('h-4 w-4 shrink-0', t.label)} />
        <p className={t.label}>
          Gastado con TC este ciclo:{' '}
          <span className={cn('font-semibold', t.value)}>
            <Amount value={balance.card.spent} animated={animated} />
          </span>
          . Se paga el próximo ciclo
          {balance.card.upcomingStatement > 0 && (
            <> (factura estimada {formatCurrency(balance.card.upcomingStatement)})</>
          )}
          .
        </p>
      </div>

      <CycleWarnings warnings={balance.warnings} tone={tone} />
    </div>
  );
}

export function warningText(warning: CycleWarning): string {
  switch (warning.kind) {
    case 'overdue_pending':
      return warning.count === 1
        ? `1 movimiento pendiente quedó sin pagar (${formatCurrency(warning.amount)}). Márcalo como pagado o elimínalo.`
        : `${warning.count} movimientos pendientes quedaron sin pagar (${formatCurrency(warning.amount)}). Márcalos como pagados o elimínalos.`;
    case 'card_payment_missing':
      return `No hay pago de ${warning.cardName} en este ciclo (se esperaban ${formatCurrency(warning.expected)}).`;
    case 'card_payment_mismatch':
      return `El pago de ${warning.cardName} (${formatCurrency(warning.paid)}) no calza con su estado de cuenta (${formatCurrency(warning.expected)}).`;
    case 'gap_before':
      return `Hay ${warning.days} ${warning.days === 1 ? 'día' : 'días'} sin ciclo antes de este.`;
    case 'changed_since_close':
      return `Cambió ${formatCurrency(warning.current - warning.closedAt)} desde el cierre (al cerrar: ${formatCurrency(warning.closedAt)}). Se editaron movimientos de este ciclo.`;
  }
}

/**
 * "Propio $X · de otros $Y · …" para el pago TC (solo si no es todo propio).
 */
function paymentBreakdownText(balance: CycleBalance): string | undefined {
  const b = balance.card.paymentBreakdown;
  if (!b || balance.cardPayment.real === 0) return undefined;
  const parts = [
    b.external > 0 && `de otros ${formatCurrency(b.external)}`,
    b.fund > 0 && `fondo ${formatCurrency(b.fund)}`,
    b.reimbursable > 0 && `reembolsable ${formatCurrency(b.reimbursable)}`,
    b.credits > 0 && `devoluciones −${formatCurrency(b.credits)}`,
  ].filter(Boolean);
  if (parts.length === 0) return undefined;
  return [`propio ${formatCurrency(b.own)}`, ...parts].join(' · ');
}

export function CycleWarnings({ warnings, tone = 'light' }: { warnings: CycleWarning[]; tone?: Tone }) {
  if (warnings.length === 0) return null;
  const t = TONES[tone];

  return (
    <ul className="space-y-1.5">
      {warnings.map((warning, index) => (
        <li key={index} className={cn('flex items-start gap-2 rounded-lg p-2.5 text-xs', t.warning)}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{warningText(warning)}</span>
        </li>
      ))}
    </ul>
  );
}
