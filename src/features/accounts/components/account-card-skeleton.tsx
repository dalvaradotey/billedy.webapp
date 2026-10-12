import { Skeleton } from '@/components/ui/skeleton';

/** Esqueleto de una cuenta: la tarjeta en el tono suave que tendrá. */
export function AccountCardSkeleton() {
  return (
    <div aria-hidden className="flex items-center gap-3 rounded-[22px] border border-line bg-surface p-3.5">
      <Skeleton tone="coral" className="h-[30px] w-[46px] rounded-[7px]" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-32 rounded-full" />
        <Skeleton tone="quiet" className="h-2.5 w-24 rounded-full" />
      </div>
      <Skeleton className="h-3.5 w-20 rounded-full" />
    </div>
  );
}
