'use client';

import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
} from 'lucide-react';

import { ResponsiveDrawer } from '@/components/ui/drawer';
import { EmptyState } from '@/components/empty-state';
import { SummaryCard } from '@/components/ui/summary-card';
import { SummaryCardsSlider } from '@/components/ui/summary-cards-slider';
import { PageToolbar } from '@/components/page-toolbar';
import { useRegisterPageActions, type PageAction } from '@/components/layout/bottom-nav-context';

import { formatCurrency } from '@/lib/formatting';
import type { BillingCycleWithTotals, BillingCycleSummary } from '../types';
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

  const handleOpenDialog = useCallback(() => {
    setEditingCycle(null);
    setIsDialogOpen(true);
  }, []);

  const hasOpenCycle = cycles.some((c) => c.status === 'open');

  const pageActions = useMemo<PageAction[]>(() => [
    { label: 'Nuevo ciclo', icon: Plus, onClick: handleOpenDialog, disabled: hasOpenCycle },
  ], [handleOpenDialog, hasOpenCycle]);

  useRegisterPageActions(pageActions);
  const cc = summary.currentCycle;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <SummaryCardsSlider>
        <SummaryCard
          title="Ciclos"
          value={String(summary.totalCycles)}
          subtitle={`${summary.openCycles} abierto, ${summary.closedCycles} cerrados`}
          icon={<Calendar className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="info"
        />
        <SummaryCard
          title="Ingresos del Ciclo"
          value={cc ? formatCurrency(cc.currentIncome) : '—'}
          subtitle={cc ? 'ciclo actual' : 'sin ciclo abierto'}
          icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="success"
        />
        <SummaryCard
          title="Gastos del Ciclo"
          value={cc ? formatCurrency(cc.currentExpenses) : '—'}
          subtitle={cc ? 'ciclo actual' : 'sin ciclo abierto'}
          icon={<TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="danger"
        />
        <SummaryCard
          title="Balance"
          value={cc ? formatCurrency(cc.currentBalance) : '—'}
          subtitle={cc ? `${cc.daysRemaining} días restantes` : 'sin ciclo abierto'}
          icon={<Wallet className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant={!cc ? 'neutral' : cc.currentBalance >= 0 ? 'success' : 'danger'}
        />
      </SummaryCardsSlider>

      {/* Dialog (se abre desde page actions o editar) */}
      <ResponsiveDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
      </ResponsiveDrawer>

      {/* Toolbar */}
      <PageToolbar label={`${cycles.length} ${cycles.length === 1 ? 'ciclo' : 'ciclos'}`} />

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
