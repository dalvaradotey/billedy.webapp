import { Skeleton } from '@/components/ui/skeleton';
import { cardStyles } from '@/components/card-styles';

export function TemplateCardSkeleton() {
  return (
    <div className={`${cardStyles.base} p-0`}>
      <div className="p-4 flex items-start gap-3">
        {/* Chevron */}
        <Skeleton className="h-5 w-5 rounded shrink-0 mt-0.5" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
              <Skeleton className="h-4 w-48" />
            </div>
            {/* Desktop: Totals + actions button */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right space-y-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-24 ml-auto" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>

          {/* Mobile: Totals */}
          <div className="flex items-center gap-3 mt-1 sm:hidden">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
