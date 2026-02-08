'use client';

import { cn } from '@/lib/utils';

interface ProgressIndicatorProps {
  current: number;
  total?: number;
  className?: string;
}

/**
 * Indicador de progreso con puntos.
 * Por defecto solo visible en desktop (hidden md:flex).
 *
 * @param current - Número de pasos completados
 * @param total - Número total de pasos (default: 3)
 */
export function ProgressIndicator({
  current,
  total = 3,
  className,
}: ProgressIndicatorProps) {
  return (
    <div className={cn('hidden md:flex items-center gap-1.5', className)}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-2 w-2 rounded-full transition-colors duration-200',
            current > i ? 'bg-emerald-500' : 'bg-muted-foreground/30'
          )}
        />
      ))}
    </div>
  );
}
