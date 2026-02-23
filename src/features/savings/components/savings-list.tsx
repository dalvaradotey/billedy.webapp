'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { ArrowRight, PiggyBank, Target, Calendar, TrendingUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ResponsiveDrawer, DrawerTrigger } from '@/components/ui/drawer';
import { EmptyState } from '@/components/empty-state';
import { SummaryCard } from '@/components/ui/summary-card';
import { SummaryCardsSlider } from '@/components/ui/summary-cards-slider';

import { formatCurrency } from '@/lib/formatting';
import type { SavingsFundWithProgress, SavingsSummary } from '../types';
import { SavingsFundCard } from './savings-fund-card';
import { SavingsFundDialogContent } from './savings-fund-dialog';

interface SavingsListProps {
  funds: SavingsFundWithProgress[];
  currencies: { id: string; code: string }[];
  summary: SavingsSummary;
  projectId?: string;
  userId: string;
  showArchived: boolean;
}

export function SavingsList({
  funds,
  currencies,
  summary,
  projectId,
  userId,
  showArchived,
}: SavingsListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFund, setEditingFund] = useState<SavingsFundWithProgress | null>(null);

  const onMutationStart = useCallback(() => {
    // No-op: los datos se actualizan automáticamente via cache invalidation
  }, []);

  const onMutationSuccess = useCallback((toastId: string | number, message: string) => {
    toast.success(message, { id: toastId });
  }, []);

  const onMutationError = useCallback((toastId: string | number, error: string) => {
    toast.error(error, { id: toastId });
  }, []);

  const handleEdit = (fund: SavingsFundWithProgress) => {
    setEditingFund(fund);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingFund(null);
  };

  const handleOpenDialog = () => {
    setEditingFund(null);
    setIsDialogOpen(true);
  };

  const defaultCurrency =
    currencies.find((c) => c.code === 'CLP') ?? currencies[0] ?? { id: '', code: 'CLP' };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <SummaryCardsSlider>
        <SummaryCard
          title="Fondos activos"
          value={String(summary.activeFunds)}
          subtitle={`de ${summary.totalFunds} total`}
          icon={<PiggyBank className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="info"
        />
        <SummaryCard
          title="Balance total"
          value={formatCurrency(summary.totalBalance)}
          subtitle={
            summary.totalTargetAmount > 0
              ? `${summary.overallProgress}% de ${formatCurrency(summary.totalTargetAmount)}`
              : undefined
          }
          icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="success"
        />
        <SummaryCard
          title="Meta mensual"
          value={formatCurrency(summary.monthlyTargetTotal)}
          icon={<Target className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="info"
        />
        <SummaryCard
          title="Depositado este mes"
          value={formatCurrency(summary.monthlyDepositedTotal)}
          subtitle={
            summary.monthlyTargetTotal > 0
              ? `${Math.round((summary.monthlyDepositedTotal / summary.monthlyTargetTotal) * 100)}% de la meta`
              : undefined
          }
          icon={<Calendar className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="neutral"
        />
      </SummaryCardsSlider>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {showArchived ? 'Mostrando archivados' : `${funds.length} fondos de ahorro`}
        </div>

        <ResponsiveDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DrawerTrigger asChild>
            <Button variant="cta-sm" onClick={handleOpenDialog}>
              Nuevo fondo
              <ArrowRight className="h-4 w-4" />
            </Button>
          </DrawerTrigger>
          <SavingsFundDialogContent
            projectId={projectId}
            userId={userId}
            currencies={currencies}
            defaultCurrencyId={defaultCurrency.id}
            fund={editingFund}
            onSuccess={handleDialogClose}
            onMutationStart={onMutationStart}
            onMutationSuccess={onMutationSuccess}
            onMutationError={onMutationError}
          />
        </ResponsiveDrawer>
      </div>

      {/* Funds List */}
      <div>
        {funds.length === 0 ? (
          <EmptyState
            icon={PiggyBank}
            title={showArchived ? 'No hay fondos archivados' : 'No hay fondos de ahorro registrados'}
            description="Crea un fondo de ahorro para comenzar a guardar dinero para tus metas."
          />
        ) : (
          <div className="space-y-3">
            {funds.map((fund) => (
              <SavingsFundCard
                key={fund.id}
                fund={fund}
                userId={userId}
                onEdit={() => handleEdit(fund)}
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
