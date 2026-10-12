import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SummaryCardVariant = 'success' | 'danger' | 'neutral' | 'info';

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  /** Color variant - applies predefined styles */
  variant?: SummaryCardVariant;
  /** Custom className for the value (legacy support, prefer variant) */
  valueClassName?: string;
  /** Container className */
  className?: string;
}

const variantStyles: Record<SummaryCardVariant, { bg: string; border: string; icon: string; value: string }> = {
  success: { bg: 'bg-surface', border: 'border-line', icon: 'bg-jade-soft text-jade', value: 'text-jade' },
  danger: { bg: 'bg-surface', border: 'border-line', icon: 'bg-coral-soft text-coral', value: 'text-coral-text' },
  neutral: { bg: 'bg-surface', border: 'border-line', icon: 'bg-surface-3 text-muted-foreground', value: 'text-foreground' },
  info: { bg: 'bg-surface', border: 'border-line', icon: 'bg-sky-soft text-sky', value: 'text-sky' },
};

export function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  variant = 'neutral',
  valueClassName,
  className,
}: SummaryCardProps) {
  const styles = variantStyles[variant];

  // If valueClassName is provided, use it; otherwise use variant styles
  const valueStyles = valueClassName || styles.value;

  return (
    <div className={cn(`rounded-2xl border p-3 sm:p-4 ${styles.bg} ${styles.border}`, className)}>
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
          <div className={cn('text-lg sm:text-xl font-bold tabular-nums truncate mt-0.5', valueStyles)}>
            {value}
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate min-h-[14px] sm:min-h-[16px]">
            {subtitle || '\u00A0'}
          </div>
        </div>
      </div>
    </div>
  );
}
