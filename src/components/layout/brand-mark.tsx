import { cn } from '@/lib/utils';

/** Marca de Billedy: la línea de pulso en jade y el nombre en minúsculas. */
export function BrandMark({ className, withName = true }: { className?: string; withName?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" className="flex-none">
        <rect x="0.5" y="0.5" width="29" height="29" rx="10" className="fill-surface stroke-line-strong" />
        <polyline
          points="5,18 10,18 13,10 17,22 20,14 25,14"
          fill="none"
          className="stroke-jade"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withName && <span className="text-[19px] font-extrabold tracking-[-0.04em]">billedy</span>}
      {!withName && <span className="sr-only">Billedy</span>}
    </span>
  );
}
