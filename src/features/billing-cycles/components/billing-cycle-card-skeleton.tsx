import { Skeleton } from '@/components/ui/skeleton';

export function BillingCycleCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-4">
      {/* Header: Icon + Info */}
      <div className="flex items-start gap-3">
        <Skeleton className="w-12 h-12 sm:w-10 sm:h-10 rounded-xl flex-shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
              <Skeleton className="h-4 w-48" />
            </div>
            {/* Desktop balance */}
            <div className="hidden sm:block text-right space-y-1">
              <Skeleton className="h-6 w-24 ml-auto" />
              <Skeleton className="h-3 w-12 ml-auto" />
            </div>
          </div>

          {/* Mobile balance row */}
          <div className="flex items-center justify-between mt-2 sm:hidden">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-4 w-14" />
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-3 space-y-1.5">
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>

      {/* Totals grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
