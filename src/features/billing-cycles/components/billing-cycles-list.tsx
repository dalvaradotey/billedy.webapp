'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Calendar } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/empty-state';

import { formatCurrency } from '@/lib/formatting';
import type { BillingCycleWithTotals, BillingCycleSummary } from '../types';
import { SummaryCard } from './summary-card';
import { BillingCycleCard } from './billing-cycle-card';
import { BillingCycleDialogContent } from './billing-cycle-dialog';

interface BillingCyclesListProps {
  cycles: BillingCycleWithTotals[];
  summary: BillingCycleSummary;
  projectId: string;
  userId: string;
  suggestedDates: { startDate: Date; endDate: Date; name: string } | null;
}

export function BillingCyclesList({
  cycles,
  summary,
  projectId,
  userId,
  suggestedDates,
}: BillingCyclesListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<BillingCycleWithTotals | null>(null);

  const onMutationStart = useCallback(() => {
    // No-op: los datos se actualizan automáticamente via cache invalidation
  }, []);

  const onMutationSuccess = useCallback((toastId: string | number, message: string) => {
    toast.success(message, { id: toastId });
  }, []);

  const onMutationError = useCallback((toastId: string | number, error: string) => {
    toast.error(error, { id: toastId });
  }, []);

  const handleEdit = (cycle: BillingCycleWithTotals) => {
    setEditingCycle(cycle);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingCycle(null);
  };

  const handleOpenDialog = () => {
    setEditingCycle(null);
    setIsDialogOpen(true);
  };

  const hasOpenCycle = cycles.some((c) => c.status === 'open');

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Ciclos"
          value={String(summary.totalCycles)}
          subtitle={`${summary.openCycles} abierto, ${summary.closedCycles} cerrados`}
          icon={<Calendar className="h-4 w-4 text-blue-600" />}
        />
        {summary.currentCycle && (
          <>
            <SummaryCard
              title="Ingresos del ciclo"
              value={formatCurrency(summary.currentCycle.currentIncome)}
              className="text-green-600"
            />
            <SummaryCard
              title="Gastos del ciclo"
              value={formatCurrency(summary.currentCycle.currentExpenses)}
              className="text-red-600"
            />
            <SummaryCard
              title="Balance"
              value={formatCurrency(summary.currentCycle.currentBalance)}
              subtitle={`${summary.currentCycle.daysRemaining} días restantes`}
              className={
                summary.currentCycle.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'
              }
            />
          </>
        )}
        {!summary.currentCycle && (
          <div className="col-span-3 flex items-center justify-center p-4 border rounded-lg bg-muted/50">
            <p className="text-muted-foreground text-sm">No hay ciclo abierto</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">{cycles.length} ciclos</div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="gap-2"
              onClick={handleOpenDialog}
              disabled={hasOpenCycle}
            >
              <Plus className="h-4 w-4" />
              Nuevo ciclo
            </Button>
          </DialogTrigger>
          <BillingCycleDialogContent
            projectId={projectId}
            userId={userId}
            cycle={editingCycle}
            suggestedDates={suggestedDates}
            onSuccess={handleDialogClose}
            onMutationStart={onMutationStart}
            onMutationSuccess={onMutationSuccess}
            onMutationError={onMutationError}
          />
        </Dialog>
      </div>

      {/* Cycles List */}
      <div>
        {cycles.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No hay ciclos de facturación"
            description="Crea uno para comenzar a organizar tus finanzas por período."
          />
        ) : (
          <div className="space-y-3">
            {cycles.map((cycle) => (
              <BillingCycleCard
                key={cycle.id}
                cycle={cycle}
                userId={userId}
                onEdit={() => handleEdit(cycle)}
                onMutationStart={onMutationStart}
                onMutationSuccess={onMutationSuccess}
                onMutationError={onMutationError}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
