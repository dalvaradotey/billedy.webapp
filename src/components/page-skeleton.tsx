'use client';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton para cards de resumen (típicamente 4 cards en fila)
 */
export function SummaryCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="rounded-[22px] border border-line bg-surface p-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton para lista de items (cards verticales)
 */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="rounded-[22px] border border-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton para tabla
 */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-lg border">
      {/* Header */}
      <div className="border-b bg-muted/50 p-4">
        <div className="flex gap-4">
          {[...Array(cols)].map((_, i) => (
            <Skeleton key={i} className="h-4 w-24" />
          ))}
        </div>
      </div>
      {/* Rows */}
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="border-b last:border-0 p-4">
          <div className="flex gap-4">
            {[...Array(cols)].map((_, j) => (
              <Skeleton key={j} className="h-4 w-24" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton de página completa con header, resumen y lista
 */
export function PageSkeleton({
  title,
  showSummary = true,
  listType = 'list',
}: {
  title?: string;
  showSummary?: boolean;
  listType?: 'list' | 'table';
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {title ? (
            <h1 className="text-2xl font-bold">{title}</h1>
          ) : (
            <Skeleton className="h-8 w-48" />
          )}
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Summary cards */}
      {showSummary && <SummaryCardsSkeleton />}

      {/* Content */}
      {listType === 'table' ? <TableSkeleton /> : <ListSkeleton />}
    </div>
  );
}
