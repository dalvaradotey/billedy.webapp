'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, ResponsiveDrawer } from '@/components/ui/drawer';
import { formatCurrency } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import type { CycleBalance } from '@/features/billing-cycles/types';

interface FreeExplainerProps {
  balance: CycleBalance;
  /** Lo que te queda libre (saldo final menos lo que falta para la meta de ahorro) */
  free: number;
  /** Lo que falta para la meta de ahorro del ciclo */
  savingsRemaining: number;
  daysRemaining: number;
  perDay: number;
}

/**
 * Botón ⓘ junto a "Te quedan libres": explica qué es ese monto con el desglose
 * del ciclo (los mismos valores de la cascada, así que siempre cuadra).
 */
export function FreeExplainer({ balance, free, savingsRemaining, daysRemaining, perDay }: FreeExplainerProps) {
  const [open, setOpen] = useState(false);
  const b = balance;
  const savingsNet = b.savingsIn.projected - b.savingsOut.projected;
  const provisionsNet = b.provisionsIn.projected - b.provisionsOut.projected;
  const reservedNet = b.reservedIn.projected - b.reservedOut.projected;

  const rows: { label: string; hint?: string; value: number }[] = [
    { label: 'Ingresos', hint: 'Sueldo y otros ingresos del ciclo', value: b.income.projected },
    { label: 'Abonos y reembolsos', value: b.reimbursements.projected },
    { label: 'Gastos con débito', hint: 'Créditos, cuentas y gastos pagados desde tu cuenta', value: -b.debitExpenses.projected },
    { label: 'Pago de la tarjeta', hint: 'El estado de cuenta del ciclo anterior', value: -b.cardPayment.projected },
    { label: 'Ahorro del ciclo', hint: 'Lo que mandaste a ahorro o apartaste en fondos', value: -savingsNet },
    { label: 'Provisiones', hint: 'Apartado para gastos que vienen', value: -provisionsNet },
    { label: 'Inversiones', value: -b.investmentsIn.projected },
    {
      label: reservedNet >= 0 ? 'Reservado para la tarjeta' : 'Reserva liberada',
      hint: 'Abonos que ya llegaron por gastos de la tarjeta que aún no pagas',
      value: -reservedNet,
    },
    { label: 'Falta para tu meta de ahorro', hint: 'Se aparta antes de considerarlo libre', value: -savingsRemaining },
  ].filter((r) => Math.round(r.value) !== 0);

  return (
    <>
      <button
        type="button"
        aria-label="¿Qué es Te quedan libres?"
        onClick={() => setOpen(true)}
        className="-m-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
      >
        <Info className="h-4 w-4" />
      </button>

      <ResponsiveDrawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-lg overflow-y-auto px-4 pb-6">
            <DrawerHeader className="px-0 text-left">
              <DrawerTitle>¿Qué es «Te quedan libres»?</DrawerTitle>
              <DrawerDescription>
                Lo que te sobra en este ciclo después de pagar todo lo que ya salió de tu cuenta y apartar tu ahorro. Puedes gastarlo o
                guardarlo sin afectar lo que viene.
              </DrawerDescription>
            </DrawerHeader>

            <dl className="space-y-2.5 rounded-[22px] border border-line bg-surface p-4 text-sm">
              {rows.map((r) => (
                <div key={r.label} className="flex items-start justify-between gap-3">
                  <dt>
                    {r.label}
                    {r.hint && <span className="block text-xs text-muted-foreground">{r.hint}</span>}
                  </dt>
                  <dd className={cn('num shrink-0 font-bold', r.value < 0 ? 'text-foreground' : 'text-jade-text')}>
                    {r.value > 0 ? '+' : '−'}
                    {formatCurrency(Math.abs(r.value))}
                  </dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
                <dt className="font-extrabold">Te quedan libres</dt>
                <dd className={cn('num text-base font-extrabold', free < 0 && 'text-coral-text')}>{formatCurrency(free)}</dd>
              </div>
            </dl>

            <h3 className="mt-5 text-sm font-extrabold">Lo que no descuenta</h3>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li>
                <b className="text-foreground">Lo que gastaste con la tarjeta este ciclo</b>
                {b.card.own.real > 0 && <> ({formatCurrency(b.card.own.real)} propios)</>}: ese estado de cuenta lo pagas el próximo ciclo, con
                el próximo sueldo.
              </li>
              <li>
                <b className="text-foreground">Lo que pagues con débito en los días que quedan.</b> Por eso «Por día» reparte lo libre en
                {daysRemaining > 0 ? (
                  <>
                    {' '}
                    los {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'} que faltan: {formatCurrency(perDay)} por día.
                  </>
                ) : (
                  ' lo que queda del ciclo.'
                )}
              </li>
            </ul>
          </div>
        </DrawerContent>
      </ResponsiveDrawer>
    </>
  );
}
