'use client';

import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { usePageActions } from './bottom-nav-context';

interface ActionsPopoverProps {
  children: (props: { isOpen: boolean; hasActions: boolean }) => React.ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
  align?: 'start' | 'center' | 'end';
}

/** Menú de "Registrar": muestra las acciones que la página actual registró. */
export function ActionsPopover({
  children,
  side = 'top',
  sideOffset = 12,
  align = 'center',
}: ActionsPopoverProps) {
  const { actions } = usePageActions();
  const [isOpen, setIsOpen] = useState(false);
  const hasActions = actions.length > 0;
  // Con una sola acción no hay nada que elegir: el botón la ejecuta directo
  const single = actions.length === 1 ? actions[0] : null;

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (open && single) {
          if (!single.disabled) single.onClick();
          return;
        }
        setIsOpen(open);
      }}
    >
      <PopoverTrigger asChild disabled={!hasActions}>
        {children({ isOpen, hasActions })}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        sideOffset={sideOffset}
        align={align}
        className="w-auto min-w-[230px] rounded-[22px] border-line-strong bg-surface-2 p-1.5 shadow-[0_12px_32px_rgba(8,6,12,0.5)]"
      >
        <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-faint">Registrar</p>
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <button
              key={index}
              type="button"
              onClick={() => {
                if (action.disabled) return;
                setIsOpen(false);
                action.onClick();
              }}
              disabled={action.disabled}
              className={cn(
                'flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition-colors',
                action.disabled ? 'cursor-not-allowed text-faint' : 'text-foreground hover:bg-surface-3'
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-[10px]',
                  action.disabled ? 'bg-surface-3 text-faint' : 'bg-jade-soft text-jade'
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              {action.label}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
