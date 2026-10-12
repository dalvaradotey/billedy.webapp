'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CreditCard, PiggyBank, Wallet, Settings2, HandCoins, Umbrella } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ResponsiveDrawer } from '@/components/ui/drawer';
import { formatCurrency } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import { liquidateFund } from '@/features/billing-cycles/actions';
import type { CyclePlanStatus } from '@/features/billing-cycles/lib/cycle-plan';
import { PlanSettingsDrawerContent } from './plan-settings-drawer';
import { SettlementsDrawerContent } from './settlements-drawer';

type SavingsAccount = { id: string; name: string };

interface DashboardPlanCardProps {
  plan: CyclePlanStatus;
  projectId: string;
  userId: string;
  isOwner: boolean;
  savingsAccounts: SavingsAccount[];
  savingsTargetValue: number | null;
  cardSpendingCapValue: number | null;
}

/** verde < 75%, ámbar 75–100%, rojo > 100% */
function capTone(percent: number) {
  if (percent > 100) return { text: 'text-red-600 dark:text-red-400', bar: 'bg-gradient-to-r from-red-600 to-red-400' };
  if (percent >= 75) return { text: 'text-amber-600 dark:text-amber-400', bar: 'bg-gradient-to-r from-amber-500 to-amber-300' };
  return { text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-gradient-to-r from-emerald-600 to-emerald-400' };
}

export function DashboardPlanCard({
  plan,
  projectId,
  userId,
  isOwner,
  savingsAccounts,
  savingsTargetValue,
  cardSpendingCapValue,
}: DashboardPlanCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showSettings, setShowSettings] = useState(false);
  const [showSettlements, setShowSettlements] = useState(false);
  const [showLiquidate, setShowLiquidate] = useState(false);

  const { card, savings, pending } = plan;
  const tone = capTone(card.percent);
  const projectionOver = card.projection > card.cap;

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

  return (
    <div className="rounded-2xl bg-card dark:bg-slate-900 p-4 md:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">Plan del ciclo</p>
        {isOwner && (
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground" onClick={() => setShowSettings(true)}>
            <Settings2 className="h-4 w-4" />
            Configurar
          </Button>
        )}
      </div>

      {/* Las dos cifras principales */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/40 dark:bg-muted/20 p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" />
            Libre del ciclo
          </p>
          {plan.free != null ? (
            <>
              <p className={cn('text-xl font-bold tabular-nums', plan.free >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                {formatCurrency(plan.free)}
              </p>
              <p className="text-[11px] text-muted-foreground">después de completar el ahorro</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Define tu ahorro objetivo</p>
          )}
        </div>
        <div className="rounded-xl bg-muted/40 dark:bg-muted/20 p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" />
            Disponible TC
          </p>
          <p className={cn('text-xl font-bold tabular-nums', card.available >= 0 ? tone.text : 'text-red-600 dark:text-red-400')}>
            {formatCurrency(card.available)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {card.available > 0 ? `${formatCurrency(card.dailyAllowance)} por día` : 'te pasaste del techo'}
          </p>
        </div>
      </div>

      {/* Techo de gasto propio en TC */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Gasto propio en TC</span>
          <span className="tabular-nums">
            <span className={cn('font-semibold', tone.text)}>{formatCurrency(card.spent)}</span>
            <span className="text-muted-foreground"> de {formatCurrency(card.cap)}</span>
          </span>
        </div>
        <Progress value={Math.min(100, card.percent)} className="h-3" indicatorClassName={tone.bar} />
        <p className={cn('text-xs', projectionOver ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
          Al ritmo actual cierras en {formatCurrency(card.projection)}
          {projectionOver ? ` (${formatCurrency(card.projection - card.cap)} sobre el techo)` : ''}.
          {' '}Fijo del ciclo: {formatCurrency(card.committedFixed)}.
          {!card.isCustomCap && ' Techo = máximo calculado.'}
        </p>
      </div>

      {/* Meta de ahorro */}
      {savings.target != null && (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <PiggyBank className="h-3.5 w-3.5" />
              Ahorro del ciclo
            </span>
            <span className="tabular-nums">
              <span className="font-semibold">{formatCurrency(savings.done)}</span>
              <span className="text-muted-foreground"> de {formatCurrency(savings.target)}</span>
            </span>
          </div>
          <Progress
            value={savings.target > 0 ? Math.min(100, Math.round((savings.done / savings.target) * 100)) : 100}
            className="h-2"
            indicatorClassName="bg-gradient-to-r from-blue-600 to-blue-400"
          />
        </div>
      )}

      {/* Pendientes de compensar */}
      {(pending.toCollect > 0 || pending.fundToLiquidate > 0 || pending.fundAwaitingPayment > 0) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {pending.toCollect > 0 && (
            <button
              type="button"
              onClick={() => setShowSettlements(true)}
              className="flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <HandCoins className="h-4 w-4 shrink-0 text-blue-500" />
              <span>
                Por cobrar <span className="font-semibold tabular-nums">{formatCurrency(pending.toCollect)}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {pending.toCollectCount} {pending.toCollectCount === 1 ? 'gasto' : 'gastos'} · toca para asignar abonos
                </span>
              </span>
            </button>
          )}
          {(pending.fundToLiquidate > 0 || pending.fundAwaitingPayment > 0) && (
            <button
              type="button"
              disabled={pending.fundToLiquidate <= 0 || !plan.contingencyAccount}
              onClick={() => setShowLiquidate(true)}
              className="flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm hover:bg-muted disabled:hover:bg-transparent"
            >
              <Umbrella className="h-4 w-4 shrink-0 text-violet-500" />
              <span>
                Fondo por liquidar <span className="font-semibold tabular-nums">{formatCurrency(pending.fundToLiquidate)}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {pending.fundAwaitingPayment > 0
                    ? `+ ${formatCurrency(pending.fundAwaitingPayment)} cuando pagues la TC`
                    : plan.contingencyAccount
                      ? `toca para retirar desde ${plan.contingencyAccount.name}`
                      : 'configura la cuenta del fondo'}
                </span>
              </span>
            </button>
          )}
        </div>
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
    </div>
  );
}
