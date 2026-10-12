/**
 * Shared card styles for consistent visual design across card components.
 * Used by: CardPurchaseCard, CreditCard
 */
export const cardStyles = {
  // Card container
  base: 'rounded-[22px] border border-line bg-surface p-4 transition-colors active:bg-surface-2',
  inactive: 'opacity-60',

  // Progress section — default (blue)
  progressSection: 'pt-1',
  progressBar: 'h-2 flex-1',
  progressIndicator: 'bg-sky',
  progressLabel: 'num font-extrabold text-foreground',
  progressSecondary: 'text-muted-foreground',
  progressPercentage: 'num font-extrabold text-sky shrink-0',

  // Progress section — completed (green, se usa cuando llega al 100%)
  progressSectionCompleted: 'pt-1',
  progressIndicatorCompleted: 'bg-jade',
  progressLabelCompleted: 'num font-extrabold text-jade-text',
  progressSecondaryCompleted: 'text-muted-foreground',
  progressPercentageCompleted: 'num font-extrabold text-jade shrink-0',

  // Progress section — danger (red, se usa cuando se excede el presupuesto)
  progressSectionDanger: 'pt-1',
  progressIndicatorDanger: 'bg-coral',
  progressLabelDanger: 'num font-extrabold text-coral-text',
  progressSecondaryDanger: 'text-muted-foreground',
  progressPercentageDanger: 'num font-extrabold text-coral shrink-0',

  // Collapsible details grid
  detailsContainer: 'rounded-2xl bg-background p-3 space-y-3',
  detailsLabel: 'text-[11px] text-muted-foreground mb-0.5',
  detailsValue: 'num text-sm font-extrabold',
  detailsDivider: 'border-t border-surface-3',

  // Actions button (three-dots)
  actionsButton: 'flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 disabled:opacity-50 shrink-0 bg-background hover:bg-surface-3',

  // Toggle button (ver detalle)
  toggleButton: 'flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors',

  // Entity/account chip
  chipBase: 'flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-background',

  // Desktop overlay grid (swap details ↔ actions)
  overlayGrid: 'hidden sm:grid [&>*]:col-start-1 [&>*]:row-start-1',

  // Inline action buttons (desktop)
  inlineActionsGrid: 'grid grid-cols-2 gap-3 w-full',
  inlineActionDefault: 'bg-surface-3 hover:bg-line-strong text-foreground',
  inlineActionDestructive: 'bg-coral-soft hover:bg-coral-soft/80 text-coral-text',

  // Mobile drawer action items
  drawerAction: 'w-full flex items-center gap-4 px-4 py-3 min-h-14 rounded-2xl transition-colors disabled:opacity-50',
  drawerActionIconBox: 'w-10 h-10 rounded-[13px] flex items-center justify-center',
  drawerCancelButton: 'w-full py-3 text-base font-medium text-muted-foreground active:text-foreground transition-colors',
} as const;
