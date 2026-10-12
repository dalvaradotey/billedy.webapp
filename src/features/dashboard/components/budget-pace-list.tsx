'use client';

import { Plus, ShoppingBasket } from 'lucide-react';
import { formatCurrency } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import type { BudgetProgress } from '@/features/budgets/types';
import { TONE_CLASSES, toneForName } from '@/lib/pulse-tone';


interface BudgetPaceListProps {
  budgets: BudgetProgress[];
  /** Fracción del ciclo transcurrida (0–1): dónde deberías ir hoy */
  pace: number;
  onAddTransaction: (budgetId: string) => void;
}

/** Presupuestos con la marca del ritmo ideal y su estado. */
export function BudgetPaceList({ budgets, pace, onAddTransaction }: BudgetPaceListProps) {
  if (budgets.length === 0) return null;
  const totalBudgeted = budgets.reduce((a, b) => a + b.budgetedAmount, 0);
  const totalSpent = budgets.reduce((a, b) => a + b.spentAmount, 0);

  return (
    <section aria-label="Presupuestos" className="md:rounded-[28px] md:border md:border-line md:bg-surface md:px-5 md:py-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="text-lg font-extrabold tracking-[-0.02em] md:text-[17px]">Presupuestos</h2>
        <span className="text-xs text-muted-foreground">
          <span className="num font-bold text-foreground">{formatCurrency(totalSpent)}</span> de {formatCurrency(totalBudgeted)}
        </span>
      </div>
      <p className="mt-1 text-xs text-faint">La rayita blanca es dónde deberías ir hoy.</p>
      <ul className="mt-2.5 rounded-[22px] border border-line bg-surface px-3.5 py-1 md:border-0 md:bg-transparent md:p-0">
        {budgets.map((b) => {
          const t = TONE_CLASSES[toneForName(b.categoryName ?? b.name)];
          const tone = { bar: t.bar, soft: t.soft, icon: t.text };
          const ratio = b.budgetedAmount > 0 ? b.spentAmount / b.budgetedAmount : 0;
          const state =
            ratio >= 0.95
              ? { label: 'agotado', className: 'text-coral' }
              : ratio > pace + 0.03
                ? { label: 'sobre el ritmo', className: 'text-amber-text' }
                : { label: 'en ritmo', className: 'text-jade-text' };
          return (
            <li key={b.id} className="flex min-h-[68px] items-center gap-3 border-b border-surface-3 last:border-0">
              <span className={cn('flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl', tone.soft, tone.icon)}>
                <ShoppingBasket className="h-[19px] w-[19px]" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-bold">{b.name}</span>
                  <span className={cn('flex-none text-xs font-extrabold', state.className)}>{state.label}</span>
                </div>
                <div className="relative mt-[7px] h-1.5 rounded-full bg-surface-3" aria-hidden>
                  <div className={cn('h-1.5 rounded-full', tone.bar)} style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
                  <span className="absolute -top-[3px] h-3 w-0.5 rounded-lg bg-cream" style={{ left: `${Math.round(pace * 100)}%` }} />
                </div>
                <span className="num mt-1 block text-[11px] text-muted-foreground">
                  {formatCurrency(b.spentAmount)} de {formatCurrency(b.budgetedAmount)} · quedan {formatCurrency(Math.max(0, b.remainingAmount))}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onAddTransaction(b.id)}
                aria-label={`Agregar gasto a ${b.name}`}
                className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-line-strong text-foreground transition-colors hover:bg-surface-2"
              >
                <Plus className="h-[15px] w-[15px]" strokeWidth={2.4} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
