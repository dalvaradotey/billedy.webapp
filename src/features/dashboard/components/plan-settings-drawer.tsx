'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/currency-input';
import {
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { formatCurrency } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import { updateProjectPlan } from '@/features/billing-cycles/actions';
import type { CyclePlanStatus } from '@/features/billing-cycles/lib/cycle-plan';

interface PlanSettingsDrawerContentProps {
  projectId: string;
  userId: string;
  plan: CyclePlanStatus;
  savingsAccounts: Array<{ id: string; name: string }>;
  savingsTargetValue: number | null;
  cardSpendingCapValue: number | null;
  onSuccess: () => void;
}

export function PlanSettingsDrawerContent({
  projectId,
  userId,
  plan,
  savingsAccounts,
  savingsTargetValue,
  cardSpendingCapValue,
  onSuccess,
}: PlanSettingsDrawerContentProps) {
  const [isPending, startTransition] = useTransition();
  const [savingsTarget, setSavingsTarget] = useState<number | undefined>(savingsTargetValue ?? undefined);
  const [cardCap, setCardCap] = useState<number | undefined>(cardSpendingCapValue ?? undefined);
  const [contingencyAccountId, setContingencyAccountId] = useState<string | null>(plan.contingencyAccount?.id ?? null);

  // Techo máximo con el ahorro que se está editando
  const maxCap = Math.max(0, plan.expectedIncome - plan.debitCommitments - (savingsTarget ?? 0));

  const handleSave = () => {
    const toastId = toast.loading('Guardando plan...');
    startTransition(async () => {
      const result = await updateProjectPlan(projectId, userId, {
        savingsTarget: savingsTarget ?? null,
        cardSpendingCap: cardCap ?? null,
        contingencyAccountId,
      });
      if (result.success) {
        toast.success('Plan actualizado', { id: toastId });
        onSuccess();
      } else {
        toast.error(result.error, { id: toastId });
      }
    });
  };

  return (
    <DrawerContent>
      <div className="mx-auto w-full max-w-lg">
        <DrawerHeader>
          <DrawerTitle>Plan del ciclo</DrawerTitle>
          <DrawerDescription>Tu ahorro objetivo define cuánto puedes gastar con la tarjeta.</DrawerDescription>
        </DrawerHeader>

        <div className="space-y-5 px-4 pb-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-2">
            <CurrencyInput value={savingsTarget} onChange={setSavingsTarget} label="Ahorro objetivo por ciclo" placeholder="0" />
            <p className="text-xs text-muted-foreground">Incluye APV, ahorro mínimo y el aporte al fondo de imprevistos.</p>
          </div>

          <div className="space-y-2">
            <CurrencyInput value={cardCap} onChange={setCardCap} label="Techo de gasto propio en TC" placeholder={String(maxCap)} />
            <div className="rounded-2xl bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p>
                Máximo calculado: <span className="font-semibold text-foreground">{formatCurrency(maxCap)}</span>
              </p>
              <p>
                = ingreso esperado {formatCurrency(plan.expectedIncome)} − compromisos débito{' '}
                {formatCurrency(plan.debitCommitments)} − ahorro {formatCurrency(savingsTarget ?? 0)}.
              </p>
              <p>Sobre el máximo empiezas a tocar tu ahorro. Déjalo vacío para usar el máximo.</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Cuenta del fondo de imprevistos</p>
            {savingsAccounts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tienes cuentas de ahorro.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cuenta del fondo">
                {savingsAccounts.map((account) => {
                  const selected = contingencyAccountId === account.id;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setContingencyAccountId(selected ? null : account.id)}
                      className={cn(
                        'min-h-11 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                        selected ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {account.name}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Desde aquí se retiran los gastos marcados como &quot;Del fondo&quot;.</p>
          </div>

          <DrawerFooter className="px-0 pt-2">
            <Button onClick={handleSave} disabled={isPending} className="w-full h-12">
              {isPending ? 'Guardando...' : 'Guardar plan'}
            </Button>
          </DrawerFooter>
        </div>
      </div>
    </DrawerContent>
  );
}
