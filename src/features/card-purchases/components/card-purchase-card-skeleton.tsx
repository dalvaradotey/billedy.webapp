import { Skeleton } from '@/components/ui/skeleton';
import { cardStyles } from '@/components/card-styles';

export function CardPurchaseCardSkeleton() {
  return (
    <div className={cardStyles.base}>
      {/* Top row */}
      <div className="flex items-start gap-3">
        <Skeleton className="w-12 h-12 sm:w-10 sm:h-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-24" />
            </div>
            {/* Desktop: Amount + actions button */}
            <div className="hidden sm:flex items-center gap-3">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
          {/* Mobile: Amount */}
          <Skeleton className="h-7 w-32 mt-1 sm:hidden" />
        </div>
      </div>

      {/* Progress section */}
      <div className="mt-3">
        <div className={cardStyles.progressSection}>
          <div className="flex items-baseline justify-between mb-2.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-6 flex-1 rounded-full" />
            <Skeleton className="h-5 w-10" />
          </div>
        </div>
      </div>
    </div>
  );
}
