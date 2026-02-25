import { Skeleton } from '@/components/ui/skeleton';

export function CreditCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-4">
      {/* Header: Icon + Info */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <Skeleton className="w-12 h-12 sm:w-10 sm:h-10 rounded-xl flex-shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            {/* Desktop amount */}
            <div className="hidden sm:block text-right space-y-1">
              <Skeleton className="h-6 w-28 ml-auto" />
              <Skeleton className="h-3 w-20 ml-auto" />
            </div>
          </div>

          {/* Mobile amount row */}
          <div className="flex items-center justify-between mt-2 sm:hidden">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 space-y-1.5">
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}
