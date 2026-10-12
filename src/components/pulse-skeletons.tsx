import { Skeleton } from '@/components/ui/skeleton';
import { TransactionTableSkeleton } from '@/features/transactions/components/transaction-table';

/**
 * Esqueletos con color de Pulso: cada bloque carga en el tono suave del contenido
 * que va a mostrar y con su misma forma, para que nada salte al cargar.
 */

export function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando inicio" className="space-y-6 md:space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="space-y-3 md:rounded-[28px] md:border md:border-line md:bg-surface md:p-[22px]">
          <Skeleton className="h-8 w-40 rounded-full" />
          <Skeleton tone="quiet" className="h-3 w-28 rounded-full" />
          <Skeleton className="h-12 w-56 rounded-2xl" />
          <Skeleton tone="quiet" className="h-3 w-64 rounded-full" />
          <div className="grid grid-cols-3 gap-2 pt-2 md:grid-cols-1">
            <Skeleton tone="quiet" className="h-14 rounded-2xl" />
            <Skeleton tone="violet" className="h-14 rounded-2xl" />
            <Skeleton tone="jade" className="h-14 rounded-2xl" />
          </div>
        </div>
        <div className="rounded-[28px] border border-line bg-surface p-4 md:px-5">
          <Skeleton className="h-4 w-36 rounded-full" />
          <Skeleton tone="amber" className="mt-4 h-7 w-40 rounded-xl" />
          <div className="mt-4 flex h-[180px] items-end gap-1.5">
            {[18, 24, 30, 34, 40, 52, 58, 64, 70, 78].map((h, i) => (
              <Skeleton key={i} tone="amber" className="flex-1 rounded-md" style={{ height: `${h}%` }} />
            ))}
            <div className="flex-[1.4]" />
          </div>
        </div>
      </div>
      <div className="scrollbar-hide -mx-4 flex gap-2.5 overflow-hidden px-4 md:mx-0 md:grid md:grid-cols-4 md:px-0">
        {(['coral', 'sky', 'rose', 'violet'] as const).map((tone) => (
          <div key={tone} className="w-[220px] flex-none space-y-3 rounded-[22px] border border-line bg-surface p-3.5 md:w-auto">
            <Skeleton tone={tone} className="h-8 w-8 rounded-[11px]" />
            <Skeleton className="h-3 w-40 rounded-full" />
            <Skeleton className="h-3 w-28 rounded-full" />
          </div>
        ))}
      </div>
      <div className="rounded-[22px] border border-line bg-surface px-3.5 py-1">
        {(['amber', 'sky', 'rose'] as const).map((tone) => (
          <div key={tone} className="flex min-h-[68px] items-center gap-3 border-b border-surface-3 last:border-0">
            <Skeleton tone={tone} className="h-[38px] w-[38px] rounded-xl" />
            <div className="flex-1 space-y-2.5">
              <Skeleton className="h-3 w-32 rounded-full" />
              <Skeleton tone={tone} className="h-1.5 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MovementsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando movimientos" className="space-y-4">
      <Skeleton className="h-8 w-44 rounded-xl" />
      <div className="rounded-[28px] border border-line bg-surface px-3.5 pb-4 pt-4 md:px-5">
        <div className="grid grid-cols-3 gap-2">
          <Skeleton tone="jade" className="h-9 rounded-xl" />
          <Skeleton tone="coral" className="h-9 rounded-xl" />
          <Skeleton className="h-9 rounded-xl" />
        </div>
        <div className="mt-4 flex h-[100px] items-end gap-[3px]">
          {Array.from({ length: 31 }).map((_, i) => (
            <Skeleton
              key={i}
              tone={i < 18 ? 'coral' : 'quiet'}
              className="flex-1 rounded-[3px]"
              style={{ height: i < 18 ? `${12 + ((i * 37) % 70)}%` : '4%' }}
            />
          ))}
        </div>
      </div>
      <Skeleton tone="quiet" className="h-[120px] rounded-[22px]" />
      <TransactionTableSkeleton rowCount={6} />
    </div>
  );
}

export function AccountsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando cuentas" className="space-y-6">
      <Skeleton className="h-8 w-32 rounded-xl" />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_380px] md:gap-5">
        <div className="space-y-3">
          <Skeleton tone="quiet" className="h-3 w-24 rounded-full" />
          <Skeleton className="h-10 w-56 rounded-2xl" />
          <div className="flex h-2 gap-[3px]">
            <Skeleton tone="jade" className="flex-[2] rounded-full" />
            <Skeleton tone="sky" className="flex-[3] rounded-full" />
            <Skeleton tone="coral" className="flex-[1.5] rounded-full" />
          </div>
          <div className="grid gap-3.5 pt-4 md:grid-cols-2">
            <Skeleton tone="coral" className="aspect-[1.586] rounded-[22px]" />
            <Skeleton tone="sky" className="hidden aspect-[1.586] rounded-[22px] md:block" />
          </div>
        </div>
        <div className="space-y-3 rounded-[26px] border border-line bg-surface p-4">
          <div className="flex items-center gap-3">
            <Skeleton tone="coral" className="h-[30px] w-[44px] rounded-[7px]" />
            <Skeleton className="h-3.5 w-40 rounded-full" />
          </div>
          <Skeleton tone="jade" className="h-16 rounded-[18px]" />
          <Skeleton tone="violet" className="h-14 rounded-2xl" />
          <Skeleton tone="rose" className="h-14 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
