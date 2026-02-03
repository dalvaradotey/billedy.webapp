'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, PiggyBank } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/empty-state';

import { formatCurrency } from '@/lib/formatting';
import type { SavingsFundWithProgress, SavingsSummary } from '../types';
import { SavingsFundCard } from './savings-fund-card';
import { SavingsFundDialogContent } from './savings-fund-dialog';

// ============================================================================
// SUMMARY CARD
// ============================================================================

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}

function SummaryCard({ title, value, subtitle, icon, className }: SummaryCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
        {icon}
        {title}
      </div>
      <div className={`text-2xl font-bold ${className ?? ''}`}>{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

// ============================================================================
// SAVINGS LIST
// ============================================================================

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
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Fondos activos"
          value={String(summary.activeFunds)}
          subtitle={`de ${summary.totalFunds} total`}
          icon={<PiggyBank className="h-4 w-4 text-blue-600" />}
        />
        <SummaryCard
          title="Balance total"
          value={formatCurrency(summary.totalBalance)}
          subtitle={
            summary.totalTargetAmount > 0
              ? `${summary.overallProgress}% de ${formatCurrency(summary.totalTargetAmount)}`
              : undefined
          }
          className="text-green-600"
        />
        <SummaryCard
          title="Meta mensual"
          value={formatCurrency(summary.monthlyTargetTotal)}
          className="text-blue-600"
        />
        <SummaryCard
          title="Depositado este mes"
          value={formatCurrency(summary.monthlyDepositedTotal)}
          subtitle={
            summary.monthlyTargetTotal > 0
              ? `${Math.round((summary.monthlyDepositedTotal / summary.monthlyTargetTotal) * 100)}% de la meta`
              : undefined
          }
          className="text-orange-600"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {showArchived ? 'Mostrando archivados' : `${funds.length} fondos de ahorro`}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={handleOpenDialog}>
              <Plus className="h-4 w-4" />
              Nuevo fondo
            </Button>
          </DialogTrigger>
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
        </Dialog>
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
