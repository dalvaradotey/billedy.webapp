import { Skeleton } from '@/components/ui/skeleton';
import { cardStyles } from '@/components/card-styles';

export function AccountCardSkeleton() {
  return (
    <div className={cardStyles.base}>
      <div className="flex items-start gap-3">
        <Skeleton className="w-12 h-12 sm:w-10 sm:h-10 rounded-xl flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
            {/* Desktop: Balance + actions button */}
            <div className="hidden sm:flex items-center gap-3">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
          {/* Mobile: Balance */}
          <Skeleton className="h-7 w-32 mt-1 sm:hidden" />
        </div>
      </div>
    </div>
  );
}
