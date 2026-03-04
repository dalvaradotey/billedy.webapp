'use client';

import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { usePageActions } from './bottom-nav-context';

interface ActionsPopoverProps {
  children: (props: { isOpen: boolean; hasActions: boolean }) => React.ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
  align?: 'start' | 'center' | 'end';
}

export function ActionsPopover({
  children,
  side = 'top',
  sideOffset = 12,
  align = 'center',
}: ActionsPopoverProps) {
  const { actions } = usePageActions();
  const [isOpen, setIsOpen] = useState(false);
  const hasActions = actions.length > 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild disabled={!hasActions}>
        {children({ isOpen, hasActions })}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        sideOffset={sideOffset}
        align={align}
        className="w-auto min-w-[210px] p-0 rounded-2xl border-0 bg-transparent shadow-none overflow-visible"
      >
        <div className="relative rounded-2xl overflow-hidden">
          {/* Glass layers */}
          <div className="absolute inset-0 bg-background/75 dark:bg-background/60 backdrop-blur-2xl backdrop-saturate-150" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.1] via-transparent to-transparent dark:from-white/[0.05]" />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08]" />
          {/* Top light refraction */}
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/30 dark:via-white/15 to-transparent" />
          {/* Ambient glow */}
          <div className="absolute -inset-2 rounded-3xl bg-emerald-500/[0.04] dark:bg-emerald-500/[0.08] blur-xl -z-10" />

          {/* Actions */}
          <div className="relative p-1.5 space-y-0.5">
            <p className="px-3.5 pt-2 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
              Acciones
            </p>
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  onClick={() => {
                    if (action.disabled) return;
                    setIsOpen(false);
                    action.onClick();
                  }}
                  disabled={action.disabled}
                  className={`flex items-center gap-3 w-full px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    action.disabled
                      ? 'text-muted-foreground/40 cursor-not-allowed'
                      : 'text-foreground/90 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-[0.97]'
                  }`}
                >
                  <div className={`flex items-center justify-center h-8 w-8 rounded-lg ${
                    action.disabled
                      ? 'bg-muted/50'
                      : 'bg-emerald-500/10 dark:bg-emerald-500/15'
                  }`}>
                    <Icon className={`h-4 w-4 ${action.disabled ? 'text-muted-foreground/40' : 'text-emerald-500'}`} />
                  </div>
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
