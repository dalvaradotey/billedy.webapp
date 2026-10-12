'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TrendingUp, ArrowDownLeft, AlertTriangle, Archive, ChevronRight, Umbrella } from 'lucide-react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ResponsiveDrawer } from '@/components/ui/drawer';
import { PulseChart } from '@/components/pulse-chart';
import { formatCurrency } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import { liquidateFund } from '@/features/billing-cycles/actions';
import { warningText } from '@/features/billing-cycles/components/cycle-cascade';
import type { CyclePlanStatus, CardPaceSeries } from '@/features/billing-cycles/lib/cycle-plan';
import { PlanSettingsDrawerContent } from './plan-settings-drawer';
import { SettlementsDrawerContent } from './settlements-drawer';
import { useDashboard } from '../hooks';
import { shortDate, addDays } from '../lib/dates';

type SavingsAccount = { id: string; name: string };

interface PulseHomeProps {
  plan: CyclePlanStatus;
  cardPace: CardPaceSeries | null;
  projectId: string;
  userId: string;
  isOwner: boolean;
  savingsAccounts: SavingsAccount[];
  savingsTargetValue: number | null;
  cardSpendingCapValue: number | null;
}

type Signal = {
  key: string;
  kicker: string;
  text: string;
  cta: string;
  tone: 'coral' | 'sky' | 'rose' | 'violet' | 'amber';
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  href?: string;
};

const SIGNAL_TONES = {
  coral: 'bg-coral-soft text-coral',
  sky: 'bg-sky-soft text-sky',
  rose: 'bg-rose-soft text-rose',
  violet: 'bg-violet-soft text-violet',
  amber: 'bg-amber-soft text-amber',
} as const;

const SIGNAL_KICKER = {
  coral: 'text-coral',
  sky: 'text-sky',
  rose: 'text-rose',
  violet: 'text-violet',
  amber: 'text-amber',
} as const;

/**
 * Inicio de Pulso: libre del ciclo, ritmo de la tarjeta contra el techo y señales.
 */
export function PulseHome({
  plan,
  cardPace,
  projectId,
  userId,
  isOwner,
  savingsAccounts,
  savingsTargetValue,
  cardSpendingCapValue,
}: PulseHomeProps) {
  const router = useRouter();
  const { cycle, budgetsProgress } = useDashboard();
  const [isPending, startTransition] = useTransition();
  const [showSettings, setShowSettings] = useState(false);
  const [showSettlements, setShowSettlements] = useState(false);
  const [showLiquidate, setShowLiquidate] = useState(false);

  if (!cycle) return null;

  const { card, savings, pending } = plan;
  const free = plan.free ?? cycle.balance.finalBalance.projected;
  const perDay = cycle.daysRemaining > 0 ? Math.round(free / cycle.daysRemaining) : free;
  const start = new Date(cycle.startDate);
  const end = new Date(cycle.endDate);
  const today = addDays(start, Math.max(0, cycle.daysElapsed - 1));
  const span = Math.max(1, cycle.daysTotal - 1);
  const idealToday = card.committedFixed + ((card.cap - card.committedFixed) * Math.max(0, cycle.daysElapsed - 1)) / span;
  const overPace = Math.round(card.spent - idealToday);
  const projectionOver = card.projection > card.cap;

  const signals: Signal[] = [];
  if (projectionOver || overPace > 0) {
    signals.push({
      key: 'pace',
      kicker: 'Tarjeta',
      text: overPace > 0
        ? `Vas ${formatCurrency(overPace)} sobre el ritmo ideal del techo.`
        : `Al ritmo actual cierras ${formatCurrency(card.projection - card.cap)} sobre el techo.`,
      cta: 'Ver gastos con tarjeta',
      tone: 'coral',
      icon: TrendingUp,
      href: '/dashboard/transactions',
    });
  }
  if (pending.toCollect > 0) {
    signals.push({
      key: 'collect',
      kicker: 'Por cobrar',
      text: `${pending.toCollectCount} ${pending.toCollectCount === 1 ? 'gasto' : 'gastos'} por ${formatCurrency(pending.toCollect)} ${pending.toCollectCount === 1 ? 'espera' : 'esperan'} un abono.`,
      cta: 'Asignar abono',
      tone: 'sky',
      icon: ArrowDownLeft,
      onClick: () => setShowSettlements(true),
    });
  }
  for (const b of budgetsProgress) {
    if (b.budgetedAmount > 0 && b.spentAmount >= b.budgetedAmount * 0.95) {
      signals.push({
        key: `budget-${b.id}`,
        kicker: 'Presupuesto',
        text: `${b.name} está agotado y ${cycle.daysRemaining === 1 ? 'falta 1 día' : `faltan ${cycle.daysRemaining} días`}.`,
        cta: 'Ver presupuestos',
        tone: 'rose',
        icon: AlertTriangle,
        href: '/dashboard/budgets',
      });
    }
  }
  if (pending.fundToLiquidate > 0 || pending.fundAwaitingPayment > 0) {
    signals.push({
      key: 'fund',
      kicker: plan.contingencyAccount?.name ?? 'Fondo',
      text:
        pending.fundToLiquidate > 0
          ? `Quedan ${formatCurrency(pending.fundToLiquidate)} por liquidar${pending.fundAwaitingPayment > 0 ? `; +${formatCurrency(pending.fundAwaitingPayment)} al pagar la TC` : ''}.`
          : `${formatCurrency(pending.fundAwaitingPayment)} se liquidan cuando pagues la TC.`,
      cta: 'Liquidar',
      tone: 'violet',
      icon: Archive,
      onClick: pending.fundToLiquidate > 0 && plan.contingencyAccount ? () => setShowLiquidate(true) : undefined,
    });
  }
  for (const [i, w] of cycle.balance.warnings.entries()) {
    signals.push({
      key: `warning-${i}`,
      kicker: 'Revisar',
      text: warningText(w),
      cta: 'Ver ciclo',
      tone: 'amber',
      icon: AlertTriangle,
      href: '/dashboard/cycles',
    });
  }

  const handleLiquidate = () => {
    const toastId = toast.loading('Liquidando fondo...');
    startTransition(async () => {
      const result = await liquidateFund(projectId, userId);
      setShowLiquidate(false);
      if (result.success) {
        toast.success(`Retiraste ${formatCurrency(result.data.amount)} desde ${plan.contingencyAccount?.name ?? 'el fondo'}`, { id: toastId });
        router.refresh();
      } else {
        toast.error(result.error, { id: toastId });
      }
    });
  };

  const savingsPct = savings.target ? Math.min(100, Math.round((savings.done / savings.target) * 100)) : null;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* Libre del ciclo */}
        <section className="flex flex-col md:rounded-[28px] md:border md:border-line md:bg-surface md:p-[22px]">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Link
              href="/dashboard/cycles"
              className="flex min-h-8 items-center gap-1 rounded-full bg-surface-2 px-3 text-xs font-bold text-foreground"
            >
              {cycle.name}
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            </Link>
            día {cycle.daysElapsed} de {cycle.daysTotal}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Te quedan libres</p>
          <p className={cn('num text-[52px] font-extrabold leading-[1.05]', free < 0 && 'text-coral-text')}>
            {formatCurrency(free)}
          </p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            ≈ <span className="num font-bold text-foreground">{formatCurrency(perDay)}</span> por día hasta el {shortDate(end)}
            {plan.free != null ? ' · después de ahorrar' : ''}
          </p>

          <div className="flex-1" />
          <dl className="mt-5 grid grid-cols-3 gap-2 md:grid-cols-1">
            <div className="rounded-2xl bg-surface-2 p-3 md:flex md:items-center md:justify-between md:bg-background">
              <dt className="text-[11px] font-semibold text-muted-foreground md:text-[13px]">Saldo final</dt>
              <dd className="num text-[15px] font-extrabold md:text-base">{formatCurrency(cycle.balance.finalBalance.projected)}</dd>
            </div>
            <div className="rounded-2xl bg-violet-soft p-3 md:flex md:items-center md:justify-between">
              <dt className="text-[11px] font-semibold text-violet-text md:text-[13px]">
                Ahorrado{savings.target != null && <span className="hidden md:inline"> · meta {formatCurrency(savings.target)}</span>}
              </dt>
              <dd className="num text-[15px] font-extrabold md:text-base">
                {formatCurrency(savings.done)}
                {savingsPct != null && <span className="ml-1 text-[11px] font-semibold text-violet-text md:hidden">{savingsPct}%</span>}
              </dd>
            </div>
            <div className="rounded-2xl bg-jade-soft p-3 md:flex md:items-center md:justify-between">
              <dt className="text-[11px] font-semibold text-jade-text md:text-[13px]">Por día</dt>
              <dd className="num text-[15px] font-extrabold md:text-base">{formatCurrency(perDay)}</dd>
            </div>
          </dl>
        </section>

        {/* Ritmo de la tarjeta */}
        <section className="rounded-[28px] border border-line bg-surface px-4 pb-4 pt-[18px] md:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-extrabold">Ritmo de la tarjeta</h2>
              <p className="text-xs text-muted-foreground">tus gastos propios contra el techo</p>
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="min-h-9 text-xs font-bold text-amber"
              >
                Ajustar techo
              </button>
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <span className="block text-xs text-muted-foreground">Disponible en el techo</span>
              <span className={cn('num text-[28px] font-extrabold', card.available >= 0 ? 'text-amber' : 'text-coral')}>
                {formatCurrency(card.available)}
              </span>
            </div>
            <span className="text-[13px] text-muted-foreground">
              {card.available > 0 ? (
                <>
                  ritmo sano <span className="num font-extrabold text-foreground">{formatCurrency(card.dailyAllowance)}</span>/día
                </>
              ) : (
                'te pasaste del techo'
              )}
            </span>
          </div>

          <div className="mt-3">
            <PulseChart
              points={cardPace?.points ?? [{ day: Math.max(1, cycle.daysElapsed), total: card.spent }]}
              daysTotal={cycle.daysTotal}
              cap={card.cap}
              baseline={card.committedFixed}
              projection={card.projection}
              startLabel={shortDate(start)}
              midLabel={shortDate(addDays(start, Math.floor(cycle.daysTotal / 2)))}
              endLabel={shortDate(end)}
              todayLabel={shortDate(today)}
              height={200}
              ariaLabel={`Gasto propio con tarjeta: ${formatCurrency(card.spent)} a hoy; proyección ${formatCurrency(card.projection)}; techo ${formatCurrency(card.cap)}`}
            />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span aria-hidden className="h-[3px] w-3.5 rounded-sm bg-amber" />real</span>
            <span className="flex items-center gap-1.5"><span aria-hidden className="w-3.5 border-t-[2.5px] border-dotted border-amber" />proyección</span>
            <span className="flex items-center gap-1.5"><span aria-hidden className="w-3.5 border-t-2 border-dotted border-faint" />ritmo ideal</span>
            <span className="flex items-center gap-1.5"><span aria-hidden className="w-3.5 border-t-2 border-dashed border-coral" />techo</span>
          </div>
          <p className="mt-2 text-[11px] text-faint">
            Lo fijo del ciclo (cuotas y plantilla, {formatCurrency(card.committedFixed)}) cuenta desde el día 1.
            {!card.isCustomCap && ' El techo es el máximo calculado.'}
          </p>
        </section>
      </div>

      {/* Señales del ciclo */}
      {signals.length > 0 && (
        <section aria-label="Señales del ciclo">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-extrabold tracking-[-0.02em]">Señales del ciclo</h2>
            <span className="text-xs text-muted-foreground">{signals.length}</span>
          </div>
          <div className="scrollbar-hide -mx-4 mt-2.5 flex snap-x gap-2.5 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
            {signals.map((s) => {
              const Icon = s.icon;
              const content = (
                <>
                  <span className="flex items-center gap-2">
                    <span className={cn('flex h-8 w-8 items-center justify-center rounded-[11px]', SIGNAL_TONES[s.tone])}>
                      <Icon className="h-[17px] w-[17px]" />
                    </span>
                    <span className={cn('truncate text-xs font-extrabold', SIGNAL_KICKER[s.tone])}>{s.kicker}</span>
                  </span>
                  <span className="text-sm font-bold leading-snug">{s.text}</span>
                  <span className="mt-auto text-xs font-extrabold">{s.cta} →</span>
                </>
              );
              const className =
                'flex w-[220px] flex-none snap-start flex-col gap-2.5 rounded-[22px] border border-line bg-surface p-3.5 text-left transition-colors hover:bg-surface-2 md:w-auto';
              return s.href ? (
                <Link key={s.key} href={s.href} className={className}>{content}</Link>
              ) : (
                <button key={s.key} type="button" onClick={s.onClick} disabled={!s.onClick} className={className}>
                  {content}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <ResponsiveDrawer open={showSettings} onOpenChange={setShowSettings}>
        <PlanSettingsDrawerContent
          projectId={projectId}
          userId={userId}
          plan={plan}
          savingsAccounts={savingsAccounts}
          savingsTargetValue={savingsTargetValue}
          cardSpendingCapValue={cardSpendingCapValue}
          onSuccess={() => {
            setShowSettings(false);
            router.refresh();
          }}
        />
      </ResponsiveDrawer>

      <ResponsiveDrawer open={showSettlements} onOpenChange={setShowSettlements}>
        {showSettlements && (
          <SettlementsDrawerContent projectId={projectId} userId={userId} onChanged={() => router.refresh()} />
        )}
      </ResponsiveDrawer>

      <ConfirmDialog
        open={showLiquidate}
        onOpenChange={setShowLiquidate}
        icon={<Umbrella className="h-7 w-7" />}
        title="Liquidar fondo"
        description={`Se registra un traspaso de ${formatCurrency(pending.fundToLiquidate)} desde ${plan.contingencyAccount?.name ?? 'la cuenta del fondo'} a tu cuenta principal, por ${pending.fundToLiquidateCount} ${pending.fundToLiquidateCount === 1 ? 'gasto' : 'gastos'} del fondo ya pagados.`}
        confirmText={isPending ? 'Liquidando...' : 'Liquidar'}
        size="sm"
        isPending={isPending}
        onConfirm={handleLiquidate}
      />
    </>
  );
}
