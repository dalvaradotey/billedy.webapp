'use client';

import { useMemo } from 'react';
import { Store, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_CLASSES, toneForName } from '@/lib/pulse-tone';
import type { DescriptionSuggestion } from '../actions';

interface DescriptionFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onPick: (suggestion: DescriptionSuggestion) => void;
  suggestions: DescriptionSuggestion[];
  type: 'income' | 'expense';
  invalid?: boolean;
  autoFocus?: boolean;
}

/**
 * Tienda o descripción: campo grande justo bajo el monto. Mientras escribes sugiere
 * descripciones que ya usaste; vacío, muestra las recientes. Elegir una completa
 * categoría y cuenta de la última vez.
 */
export function DescriptionField({
  value,
  onChange,
  onBlur,
  onPick,
  suggestions,
  type,
  invalid,
  autoFocus,
}: DescriptionFieldProps) {
  const query = value.trim().toLowerCase();

  const shown = useMemo(() => {
    const sameType = suggestions.filter((s) => s.type === type);
    if (!query) return { label: 'Recientes', items: sameType.slice(0, 4) };
    const starts = sameType.filter((s) => s.description.toLowerCase().startsWith(query));
    const contains = sameType.filter(
      (s) => !s.description.toLowerCase().startsWith(query) && s.description.toLowerCase().includes(query)
    );
    const items = [...starts, ...contains]
      .filter((s) => s.description.toLowerCase() !== query)
      .slice(0, 4);
    return { label: 'Coincide', items };
  }, [suggestions, type, query]);

  return (
    <div className="space-y-2">
      <label
        className={cn(
          'flex min-h-14 items-center gap-2.5 rounded-[18px] border-[1.5px] bg-background pl-3.5 pr-1.5 transition-colors focus-within:border-jade',
          invalid ? 'border-coral' : 'border-line-strong'
        )}
      >
        <Store className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={2} />
        <span className="sr-only">Tienda o descripción</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoFocus={autoFocus}
          autoComplete="off"
          placeholder={type === 'income' ? '¿De dónde viene?' : '¿Dónde o en qué?'}
          className="min-w-0 flex-1 bg-transparent text-base font-bold text-foreground outline-none placeholder:font-semibold placeholder:text-faint"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Borrar descripción"
            className="flex h-10 w-10 items-center justify-center rounded-full text-faint hover:text-foreground"
          >
            <X className="h-4 w-4" strokeWidth={2.4} />
          </button>
        )}
      </label>

      {shown.items.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" data-vaul-no-drag>
          <span className="shrink-0 text-[11px] font-bold text-faint">{shown.label}</span>
          {shown.items.map((s) => {
            const tone = TONE_CLASSES[s.type === 'income' ? 'jade' : toneForName(s.categoryName)];
            return (
              <button
                key={s.description}
                type="button"
                onClick={() => onPick(s)}
                className="flex min-h-[34px] max-w-[180px] items-center gap-1.5 rounded-full border border-line-strong pl-1.5 pr-3 text-xs font-bold text-subtle transition-colors hover:bg-surface-2"
              >
                <span aria-hidden className={cn('flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-xl text-[10px] font-extrabold', tone.soft, tone.text)}>
                  {(s.categoryName ?? s.description).charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{s.description}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
