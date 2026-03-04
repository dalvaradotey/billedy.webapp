'use client';

import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePageActions } from './bottom-nav-context';
import { ActionsPopover } from './actions-popover';

export function DesktopActionsFab() {
  const { actions } = usePageActions();

  if (actions.length === 0) return null;

  return (
    <div className="hidden md:block fixed bottom-8 right-8 z-40">
      <ActionsPopover side="top" align="end" sideOffset={16}>
        {({ isOpen }) => (
          <button className="group relative w-14 h-14 rounded-2xl flex items-center justify-center active:scale-90 transition-all duration-300">
            {/* Ambient glow */}
            <div className={cn(
              'absolute -inset-1 rounded-3xl bg-emerald-500/[0.08] dark:bg-emerald-500/[0.15] blur-xl transition-all duration-300 group-hover:bg-emerald-500/[0.14] dark:group-hover:bg-emerald-500/[0.22]',
              isOpen && 'bg-emerald-500/[0.14] dark:bg-emerald-500/[0.22]'
            )} />

            {/* Layer 1: Frosted glass background */}
            <div className="absolute inset-0 rounded-2xl bg-background/75 dark:bg-background/60 backdrop-blur-2xl backdrop-saturate-150" />
            {/* Layer 2: Gradient depth */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.08] via-transparent to-transparent dark:from-white/[0.04]" />
            {/* Layer 3: Inner border ring */}
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08]" />
            {/* Layer 4: Top light refraction */}
            <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/30 dark:via-white/15 to-transparent" />

            {/* Icon */}
            <Plus
              className={cn(
                'relative w-6 h-6 text-emerald-500 transition-all duration-300',
                isOpen && 'rotate-45'
              )}
              strokeWidth={2.5}
            />
          </button>
        )}
      </ActionsPopover>
    </div>
  );
}
