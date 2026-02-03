interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  className?: string;
}

export function SummaryCard({ title, value, subtitle, className }: SummaryCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm text-muted-foreground mb-1">{title}</div>
      <div className={`text-2xl font-bold ${className ?? ''}`}>{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
    </div>
  );
}
