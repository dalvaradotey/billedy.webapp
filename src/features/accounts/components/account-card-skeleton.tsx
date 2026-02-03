import { Skeleton } from '@/components/ui/skeleton';

export function AccountCardSkeleton() {
  return (
    <div className="rounded-lg border p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="text-right">
        <Skeleton className="h-6 w-28" />
      </div>
    </div>
  );
}
