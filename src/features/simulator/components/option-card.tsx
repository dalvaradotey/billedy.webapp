'use client';

import { formatCurrency } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import type { PlanOption } from '../lib/plan';
import { monthLabel } from './labels';

interface OptionCardProps {
  option: PlanOption;
  index: number;
  onChoose: () => void;
}

/** Una opción en lenguaje simple: qué haces, cuánto cuesta, cómo quedan tus ahorros y cuándo lo tienes */
export function OptionCard({ option, index, onChoose }: OptionCardProps) {
  const lines = [
    {
      icon: '💸',
      text:
        option.extraCost > 0 ? (
          <>
            Pagas <b className="text-coral-text">{formatCurrency(option.extraCost)} extra</b>
            {option.installment > 0 && <> ({option.monthsToRecover} cuotas de {formatCurrency(option.installment)})</>}
          </>
        ) : (
          'No pagas nada extra'
        ),
    },
    {
      icon: '🏦',
      text: option.touchesSavings ? (
        <>
          Tus ahorros bajan a <b>{formatCurrency(option.savingsAfter)}</b>
        </>
      ) : (
        'Tus ahorros quedan intactos'
      ),
    },
    {
      icon: '⏳',
      text:
        option.monthsToHave === 0 ? (
          <>
            Lo tienes <b>ya</b>
            {option.monthsToRecover > 0 && option.id !== 'bank' && Number.isFinite(option.monthsToRecover) && (
              <> · {option.id === 'third_party' ? 'le devuelves todo' : 'vuelves a como estabas'} en {option.monthsToRecover} {option.monthsToRecover === 1 ? 'mes' : 'meses'}</>
            )}
            {option.id === 'bank' && <> · con una cuota por {option.monthsToRecover} meses</>}
          </>
        ) : Number.isFinite(option.monthsToHave) ? (
          <>
            Lo tienes en <b>{monthLabel(option.monthsToHave)}</b>. Hasta entonces no ahorras nada más
          </>
        ) : (
          'Sin ahorro mensual no se puede juntar'
        ),
    },
  ];

  return (
    <article
      className={cn(
        'rounded-[22px] border p-4',
        option.recommended ? 'border-jade bg-jade-soft/40' : 'border-line bg-surface',
        !option.viable && 'opacity-55'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Opción {index + 1}</p>
          <h3 className="text-base font-extrabold">{option.title}</h3>
        </div>
        {option.recommended && (
          <span className="shrink-0 rounded-full bg-jade px-2.5 py-1 text-[11px] font-extrabold text-jade-ink">Recomendada</span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{option.summary}</p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {lines.map((l) => (
          <li key={l.icon} className="flex gap-2">
            <span aria-hidden>{l.icon}</span>
            <span>{l.text}</span>
          </li>
        ))}
      </ul>
      {option.viable ? (
        <button
          type="button"
          onClick={onChoose}
          className="mt-3.5 flex min-h-11 w-full items-center justify-center rounded-full border border-line-strong text-sm font-extrabold transition-colors hover:bg-surface-2"
        >
          Armar mi plan con esta
        </button>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">No te alcanza con esta opción.</p>
      )}
    </article>
  );
}
