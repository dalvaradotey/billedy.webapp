import { Skeleton } from '@/components/ui/skeleton';

export function TemplateCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Chevron */}
          <Skeleton className="h-5 w-5 rounded shrink-0" />

          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-48" />
            {/* Mobile totals */}
            <div className="flex items-center gap-3 sm:hidden">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Desktop totals */}
          <div className="text-right hidden sm:block space-y-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-24 ml-auto" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}
