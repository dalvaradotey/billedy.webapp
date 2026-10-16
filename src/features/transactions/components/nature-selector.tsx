'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  natureDescription,
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

const NATURE_DOTS: Record<TransactionNature, string> = {
  own: 'bg-jade',
  external: 'bg-sky',
  reimbursable: 'bg-amber',
  fund: 'bg-violet',
  reimbursement: 'bg-jade',
};

/**
 * "¿De quién es?" en una sola línea: muestra la opción elegida y abre
 * un menú con todas, cada una con lo que implica.
 */
export function NatureSelector({
  type,
  value,
  onChange,
  options,
  label = type === 'income' ? '¿Qué es este ingreso?' : '¿De quién es?',
  disabled,
}: NatureSelectorProps) {
  const [open, setOpen] = useState(false);
  const natures = options ?? naturesForType(type);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl border bg-background pl-4 pr-3 text-left transition-colors disabled:opacity-50',
            open ? 'border-jade' : 'border-line'
          )}
        >
          <span className="flex-1 text-[13px] font-bold text-[#CFC6D6]">{label}</span>
          <span className="flex items-center gap-2 rounded-full bg-surface-2 px-2.5 py-1.5 text-[13px] font-extrabold">
            <span aria-hidden className={cn('h-2 w-2 rounded-full', NATURE_DOTS[value])} />
            {NATURE_LABELS[value]}
          </span>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] rounded-[18px] border-line-strong bg-surface-2 p-1.5"
      >
        <ul role="listbox" aria-label={label}>
          {natures.map((nature) => {
            const selected = value === nature;
            return (
              <li key={nature}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(nature);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left transition-colors hover:bg-surface-3',
                    selected && 'bg-surface-3'
                  )}
                >
                  <span aria-hidden className={cn('h-2.5 w-2.5 shrink-0 rounded-full', NATURE_DOTS[nature])} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{NATURE_LABELS[nature]}</span>
                    <span className="block text-[11px] leading-snug text-muted-foreground">{natureDescription(nature, type)}</span>
                  </span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-jade" strokeWidth={3} />}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
