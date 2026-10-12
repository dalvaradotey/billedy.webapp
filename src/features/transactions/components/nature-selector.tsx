'use client';

import { cn } from '@/lib/utils';
import {
  NATURE_DESCRIPTIONS,
  NATURE_LABELS,
  naturesForType,
  type TransactionNature,
} from '../nature';

interface NatureSelectorProps {
  type: 'income' | 'expense';
  value: TransactionNature;
  onChange: (value: TransactionNature) => void;
  /** Naturalezas a ofrecer (por defecto, todas las válidas para el tipo) */
  options?: readonly TransactionNature[];
  label?: string;
  disabled?: boolean;
}

/**
 * Selector de naturaleza en chips (mobile-first, targets de 44px).
 */
export function NatureSelector({
  type,
  value,
  onChange,
  options,
  label = type === 'income' ? '¿Qué es este ingreso?' : '¿De quién es este gasto?',
  disabled,
}: NatureSelectorProps) {
  const natures = options ?? naturesForType(type);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className={cn('grid gap-2', natures.length > 2 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2')}
      >
        {natures.map((nature) => {
          const selected = value === nature;
          return (
            <button
              key={nature}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(nature)}
              title={NATURE_DESCRIPTIONS[nature]}
              className={cn(
                'min-h-11 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50',
                selected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted active:bg-muted'
              )}
            >
              {NATURE_LABELS[nature]}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{NATURE_DESCRIPTIONS[value]}</p>
    </div>
  );
}
