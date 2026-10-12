import { cn } from '@/lib/utils';

/**
 * Esqueleto de carga con color: cada bloque usa el tono suave del contenido
 * que va a mostrar (ámbar para tarjeta, jade para ingresos, etc.).
 */
const TONES = {
  neutral: 'bg-surface-3',
  quiet: 'bg-surface-2',
  jade: 'bg-jade-soft',
  coral: 'bg-coral-soft',
  amber: 'bg-amber-soft',
  sky: 'bg-sky-soft',
  violet: 'bg-violet-soft',
  rose: 'bg-rose-soft',
} as const;

export type SkeletonTone = keyof typeof TONES;

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: SkeletonTone;
}

function Skeleton({ className, tone = 'neutral', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-skeleton rounded-md', TONES[tone], className)}
      {...props}
    />
  );
}

export { Skeleton };
