'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CARD_DESIGNS, getCardDesign, type CardDesign } from '../card-designs';
import { CardDesignPreview } from './wallet-card';

interface CardDesignPickerProps {
  /** Diseño elegido; null = automático */
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  /** Lo que se usaría en modo automático (según banco y nombre) */
  autoDesign: CardDesign;
}

const GROUPS: CardDesign['group'][] = ['Tus tarjetas', 'Por banco', 'Lisos'];

/** Galería para elegir el diseño de la tarjeta de una cuenta. */
export function CardDesignPicker({ value, onChange, autoDesign }: CardDesignPickerProps) {
  const [open, setOpen] = useState(false);
  const current = getCardDesign(value) ?? autoDesign;

  return (
    <div className="rounded-2xl border border-line bg-background p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 text-left"
      >
        <CardDesignPreview design={current} className="w-[76px] shrink-0 rounded-lg" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Diseño de la tarjeta</span>
          <span className="block truncate text-xs text-muted-foreground">
            {value ? current.label : `Automático · ${autoDesign.label}`}
          </span>
        </span>
        <span className="flex items-center gap-1 text-xs font-bold text-jade">
          {open ? 'Listo' : 'Cambiar'}
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-4 border-t border-surface-3 pt-3" data-vaul-no-drag>
          <Option
            label="Automático"
            hint={autoDesign.label}
            design={autoDesign}
            selected={!value}
            onClick={() => onChange(null)}
          />
          {GROUPS.map((group) => (
            <div key={group}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-faint">{group}</p>
              <div className="grid grid-cols-3 gap-2">
                {CARD_DESIGNS.filter((d) => d.group === group).map((d) => (
                  <Option key={d.id} label={d.label} design={d} selected={value === d.id} onClick={() => onChange(d.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Option({
  label,
  hint,
  design,
  selected,
  onClick,
}: {
  label: string;
  hint?: string;
  design: CardDesign;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn('group flex w-full flex-col gap-1.5 text-left', hint && 'flex-row items-center gap-3')}
    >
      <span className={cn('relative block rounded-xl', hint ? 'w-[76px] shrink-0' : 'w-full', selected && 'ring-2 ring-cream ring-offset-2 ring-offset-background')}>
        <CardDesignPreview design={design} />
        {selected && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-cream text-cream-ink">
            <Check className="h-3 w-3" strokeWidth={3.5} />
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className={cn('block truncate text-[11px] font-bold', selected ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
        {hint && <span className="block truncate text-[11px] text-faint">{hint}</span>}
      </span>
    </button>
  );
}
