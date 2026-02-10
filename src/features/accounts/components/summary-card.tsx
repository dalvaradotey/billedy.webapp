import { ReactNode } from 'react';

type SummaryCardVariant = 'success' | 'danger' | 'neutral' | 'info';

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  variant?: SummaryCardVariant;
}

const variantStyles: Record<SummaryCardVariant, { bg: string; border: string; icon: string; value: string }> = {
  success: {
    bg: 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 dark:from-emerald-500/20 dark:to-emerald-600/10',
    border: 'border-emerald-500/20 dark:border-emerald-500/30',
    icon: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    value: 'text-emerald-600 dark:text-emerald-400',
  },
  danger: {
    bg: 'bg-gradient-to-br from-red-500/10 to-red-600/5 dark:from-red-500/20 dark:to-red-600/10',
    border: 'border-red-500/20 dark:border-red-500/30',
    icon: 'bg-red-500/20 text-red-600 dark:text-red-400',
    value: 'text-red-600 dark:text-red-400',
  },
  neutral: {
    bg: 'bg-gradient-to-br from-slate-500/10 to-slate-600/5 dark:from-slate-500/20 dark:to-slate-600/10',
    border: 'border-slate-500/20 dark:border-slate-500/30',
    icon: 'bg-slate-500/20 text-slate-600 dark:text-slate-400',
    value: 'text-foreground',
  },
  info: {
    bg: 'bg-gradient-to-br from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10',
    border: 'border-blue-500/20 dark:border-blue-500/30',
    icon: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
    value: 'text-blue-600 dark:text-blue-400',
  },
};

export function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  variant = 'neutral',
}: SummaryCardProps) {
  const styles = variantStyles[variant];

  return (
    <div className={`rounded-2xl border p-3 sm:p-4 ${styles.bg} ${styles.border}`}>
      <div className="flex items-start gap-2 sm:gap-3">
        {icon && (
          <div className={`p-1.5 sm:p-2 rounded-lg ${styles.icon} flex-shrink-0`}>
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">
            {title}
          </div>
          <div className={`text-lg sm:text-xl font-bold tabular-nums truncate mt-0.5 ${styles.value}`}>
            {value}
          </div>
          {subtitle && (
            <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
