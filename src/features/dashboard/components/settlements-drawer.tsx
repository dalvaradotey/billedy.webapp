'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { formatCurrency, formatDate } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import { fetchPendingSettlements, settleExpense } from '@/features/billing-cycles/actions';
import type { AvailableAbono, PendingExpense } from '@/features/billing-cycles/lib/settlements';
import { NATURE_LABELS } from '@/features/transactions/nature';

interface SettlementsDrawerContentProps {
  projectId: string;
  userId: string;
  onChanged: () => void;
}

/**
 * "Por cobrar": gastos de otra persona o reembolsables pendientes. Se compensan
 * asignando un abono, o cerrando la diferencia ("lo asumió", redondeo).
 */
export function SettlementsDrawerContent({ projectId, userId, onChanged }: SettlementsDrawerContentProps) {
  const [isPending, startTransition] = useTransition();
  const [expenses, setExpenses] = useState<PendingExpense[] | null>(null);
  const [abonos, setAbonos] = useState<AvailableAbono[]>([]);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);

  const applyResult = useCallback(
    (result: Awaited<ReturnType<typeof fetchPendingSettlements>>) => {
      if (result.success) {
        setExpenses(result.data.expenses.filter((e) => e.nature !== 'fund'));
        setAbonos(result.data.abonos);
      } else {
        toast.error(result.error);
        setExpenses([]);
      }
    },
    []
  );

  const load = useCallback(
    async () => applyResult(await fetchPendingSettlements(projectId, userId)),
    [applyResult, projectId, userId]
  );

  useEffect(() => {
    let cancelled = false;
    fetchPendingSettlements(projectId, userId).then((result) => {
      if (!cancelled) applyResult(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applyResult, projectId, userId]);

  const settle = (expenseId: string, settlingTransactionId: string | null) => {
    startTransition(async () => {
      const result = await settleExpense(projectId, userId, { expenseId, settlingTransactionId });
      if (result.success) {
        toast.success(settlingTransactionId ? 'Abono asignado' : 'Diferencia cerrada');
        setSelectedExpenseId(null);
        await load();
        onChanged();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <DrawerContent>
      <div className="mx-auto w-full max-w-lg">
        <DrawerHeader>
          <DrawerTitle>Por cobrar</DrawerTitle>
          <DrawerDescription>Asigna el abono que corresponde a cada gasto que no es tuyo.</DrawerDescription>
        </DrawerHeader>

        <div className="space-y-2 px-4 pb-6 max-h-[70vh] overflow-y-auto">
          {expenses === null && <p className="text-sm text-muted-foreground">Cargando...</p>}
          {expenses?.length === 0 && <p className="text-sm text-muted-foreground">No hay gastos pendientes de cobro.</p>}

          {expenses?.map((expense) => {
            const isSelected = selectedExpenseId === expense.id;
            return (
              <div key={expense.id} className="rounded-xl border p-3">
                <button
                  type="button"
                  onClick={() => setSelectedExpenseId(isSelected ? null : expense.id)}
                  className="flex w-full min-h-11 items-start justify-between gap-3 text-left"
                  aria-expanded={isSelected}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{expense.description}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(expense.date)} · {NATURE_LABELS[expense.nature]}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums">{formatCurrency(expense.remaining)}</span>
                    {expense.remaining !== expense.amount && (
                      <span className="text-[11px] text-muted-foreground">de {formatCurrency(expense.amount)}</span>
                    )}
                  </span>
                </button>

                {isSelected && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    {abonos.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No hay abonos disponibles. Registra el abono como ingreso &quot;Abono&quot;.</p>
                    ) : (
                      <>
                        <p className="text-xs font-medium text-muted-foreground">Asignar abono</p>
                        {abonos.map((abono) => (
                          <button
                            key={abono.id}
                            type="button"
                            disabled={isPending}
                            onClick={() => settle(expense.id, abono.id)}
                            className={cn(
                              'flex w-full min-h-11 items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50'
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate">{abono.description}</span>
                              <span className="text-[11px] text-muted-foreground">{formatDate(abono.date)}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                              {formatCurrency(abono.remaining)}
                              <Check className="h-4 w-4 text-emerald-500" />
                            </span>
                          </button>
                        ))}
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => settle(expense.id, null)}
                      className="h-10 w-full gap-1.5 text-muted-foreground"
                    >
                      <X className="h-4 w-4" />
                      Cerrar sin abono (lo asumió la otra persona o es un redondeo)
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DrawerContent>
  );
}
