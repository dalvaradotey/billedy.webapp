'use client';

import { useSyncExternalStore } from 'react';
import { Check } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { THEMES, themeById } from '@/lib/themes';

const MODE_LABEL = { dark: 'Oscuro', light: 'Claro' } as const;
/** Niebla y Arena son los intermedios */
const SOFT = new Set(['niebla', 'arena']);

/** El tema guardado solo se conoce en el navegador: hasta entonces no se marca ninguno */
const useIsClient = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

/**
 * Grilla para elegir el tema de color, con una vista previa de cada uno
 * (fondo, superficie y acento).
 */
export function ThemePicker({ columns = 3 }: { columns?: 2 | 3 }) {
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();
  const current = isClient ? themeById(theme).id : null;

  return (
    <div role="radiogroup" aria-label="Tema de color" className={cn('grid gap-2', columns === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
      {THEMES.map((t) => {
        const active = current === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(t.id)}
            className={cn(
              'flex flex-col gap-2 rounded-2xl border p-2 text-left transition-colors',
              active ? 'border-jade bg-jade-soft' : 'border-line bg-surface hover:bg-surface-2'
            )}
          >
            {/* Vista previa: fondo, una tarjeta con texto y el acento */}
            <span
              aria-hidden
              className="relative flex h-14 flex-col justify-end gap-1 overflow-hidden rounded-xl p-1.5"
              style={{ background: t.background, boxShadow: 'inset 0 0 0 1px rgba(127,127,127,0.18)' }}
            >
              <span className="h-1.5 w-8 rounded-full" style={{ background: t.text, opacity: 0.85 }} />
              <span className="flex items-center gap-1 rounded-md p-1" style={{ background: t.surface }}>
                <span className="h-2 w-2 rounded-full" style={{ background: t.accent }} />
                <span className="h-1 flex-1 rounded-full" style={{ background: t.text, opacity: 0.35 }} />
              </span>
              {active && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-jade text-jade-ink">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="px-0.5 leading-tight">
              <span className={cn('block text-xs font-extrabold', active && 'text-jade-text')}>{t.name}</span>
              <span className="block text-[10px] text-muted-foreground">
                {SOFT.has(t.id) ? `Soft ${MODE_LABEL[t.mode].toLowerCase()}` : MODE_LABEL[t.mode]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
