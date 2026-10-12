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
    <div className={cn('rounded-[22px] border border-line bg-surface p-3.5 sm:p-4', className)}>
      <div className="flex items-center gap-2">
        {icon && (
          <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] [&_svg]:h-3.5 [&_svg]:w-3.5', styles.icon)}>
            {icon}
          </span>
        )}
        <span className="truncate text-xs text-muted-foreground">{title}</span>
      </div>
      <div className={cn('num mt-2 truncate text-xl font-extrabold sm:text-[22px]', valueStyles)}>{value}</div>
      {subtitle && <div className="mt-0.5 truncate text-[11px] text-faint">{subtitle}</div>}
    </div>
  );
}
