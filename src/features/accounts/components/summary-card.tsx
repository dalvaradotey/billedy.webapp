interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  className?: string;
}

export function SummaryCard({ title, value, subtitle, className }: SummaryCardProps) {
  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4">
      <div className="text-xs sm:text-sm text-muted-foreground mb-0.5 sm:mb-1 truncate">
        {title}
      </div>
      <div className={`text-lg sm:text-2xl font-bold tabular-nums truncate ${className ?? ''}`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
          {subtitle}
        </div>
      )}
    </div>
  );
}
