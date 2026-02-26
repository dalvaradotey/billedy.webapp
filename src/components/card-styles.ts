/**
 * Shared card styles for consistent visual design across card components.
 * Used by: CardPurchaseCard, CreditCard
 */
export const cardStyles = {
  // Card container
  base: 'rounded-2xl bg-card dark:bg-slate-900 p-4 transition-colors active:bg-muted/50',
  inactive: 'opacity-60',

  // Progress section (gradient blue box)
  progressSection: 'rounded-xl bg-gradient-to-r from-blue-500/5 to-blue-500/10 dark:from-blue-500/10 dark:to-blue-500/20 p-3 ring-1 ring-blue-500/10',
  progressBar: 'h-6 flex-1',
  progressIndicator: 'bg-gradient-to-r from-blue-600 to-blue-400',
  progressLabel: 'font-bold text-blue-700 dark:text-blue-300 tabular-nums',
  progressSecondary: 'text-blue-600/60 dark:text-blue-400/60',
  progressPercentage: 'font-bold tabular-nums text-blue-600 dark:text-blue-400 shrink-0',

  // Collapsible details grid
  detailsContainer: 'rounded-xl bg-muted/30 dark:bg-muted/20 p-3 space-y-3',
  detailsLabel: 'text-[11px] text-muted-foreground mb-0.5',
  detailsValue: 'text-sm font-semibold tabular-nums',
  detailsDivider: 'border-t border-border/50',

  // Actions button (three-dots)
  actionsButton: 'flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 disabled:opacity-50 shrink-0 bg-slate-700/20 hover:bg-slate-700/40',

  // Toggle button (ver detalle)
  toggleButton: 'flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors',

  // Entity/account chip
  chipBase: 'flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-500/5 dark:bg-blue-500/10 ring-1 ring-blue-500/10',

  // Desktop overlay grid (swap details ↔ actions)
  overlayGrid: 'hidden sm:grid [&>*]:col-start-1 [&>*]:row-start-1',

  // Inline action buttons (desktop)
  inlineActionsGrid: 'grid grid-cols-2 gap-3 w-full',
  inlineActionDefault: 'bg-slate-700/30 hover:bg-slate-700/50 text-foreground',
  inlineActionDestructive: 'bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400',

  // Mobile drawer action items
  drawerAction: 'w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors disabled:opacity-50',
  drawerActionIconBox: 'w-10 h-10 rounded-xl flex items-center justify-center',
  drawerCancelButton: 'w-full py-3 text-base font-medium text-muted-foreground active:text-foreground transition-colors',
} as const;
