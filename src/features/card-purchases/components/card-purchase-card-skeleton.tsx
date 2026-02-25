import { Skeleton } from '@/components/ui/skeleton';

export function CardPurchaseCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-4">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <Skeleton className="w-12 h-12 sm:w-10 sm:h-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-24" />
            </div>
            {/* Desktop amount */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right space-y-1.5">
                <Skeleton className="h-5 w-28 ml-auto" />
                <Skeleton className="h-3 w-20 ml-auto" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
          {/* Mobile amount */}
          <div className="flex items-center justify-between mt-2 sm:hidden">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-3">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex justify-between mt-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}
