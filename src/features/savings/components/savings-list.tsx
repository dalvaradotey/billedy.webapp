'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { PiggyBank, Target, TrendingUp, Plus } from 'lucide-react';

import { ResponsiveDrawer } from '@/components/ui/drawer';
import { EmptyState } from '@/components/empty-state';
import { SummaryCard } from '@/components/ui/summary-card';
import { SummaryCardsSlider } from '@/components/ui/summary-cards-slider';
import { PageToolbar } from '@/components/page-toolbar';
import { useRegisterPageActions, type PageAction } from '@/components/layout/bottom-nav-context';

import { formatCurrency } from '@/lib/formatting';
import type { SavingsGoalWithProgress, SavingsSummary, SavingsFilter } from '../types';
import { SavingsGoalCard } from './savings-goal-card';
import { SavingsGoalDialogContent } from './savings-goal-dialog';

interface SavingsListProps {
  goals: SavingsGoalWithProgress[];
  currencies: { id: string; code: string }[];
  summary: SavingsSummary;
  projectId?: string;
  userId: string;
  filter: SavingsFilter;
}

export function SavingsList({
  goals,
  currencies,
  summary,
  projectId,
  userId,
  filter,
}: SavingsListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoalWithProgress | null>(null);

  const onMutationStart = useCallback(() => {
    // No-op: los datos se actualizan automáticamente via cache invalidation
  }, []);

  const onMutationSuccess = useCallback((toastId: string | number, message: string) => {
    toast.success(message, { id: toastId });
  }, []);

  const onMutationError = useCallback((toastId: string | number, error: string) => {
    toast.error(error, { id: toastId });
  }, []);

  const handleEdit = (goal: SavingsGoalWithProgress) => {
    setEditingGoal(goal);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingGoal(null);
  };

  const handleOpenDialog = useCallback(() => {
    setEditingGoal(null);
    setIsDialogOpen(true);
  }, []);

  const pageActions = useMemo<PageAction[]>(() => [
    { label: 'Nueva meta', icon: Plus, onClick: handleOpenDialog },
  ], [handleOpenDialog]);

  useRegisterPageActions(pageActions);

  const handleFilterChange = (newFilter: SavingsFilter) => {
    if (newFilter === 'active') {
      router.push(pathname);
    } else {
      router.push(`${pathname}?filter=${newFilter}`);
    }
  };

  const defaultCurrency =
    currencies.find((c) => c.code === 'CLP') ?? currencies[0] ?? { id: '', code: 'CLP' };

  const emptyMessages: Record<SavingsFilter, string> = {
    active: 'No hay metas de ahorro activas',
    completed: 'No hay metas completadas',
    archived: 'No hay metas archivadas',
  };

  const filterTabs: { key: SavingsFilter; label: string; count?: number }[] = [
    { key: 'active', label: 'Activas', count: summary.activeGoals },
    { key: 'completed', label: 'Completadas', count: summary.completedGoals },
    { key: 'archived', label: 'Archivadas' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <SummaryCardsSlider>
        <SummaryCard
          title="Metas activas"
          value={String(summary.activeGoals)}
          subtitle={`de ${summary.totalGoals} total`}
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
          title="Meta total"
          value={formatCurrency(summary.totalTargetAmount)}
          icon={<Target className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="info"
        />
      </SummaryCardsSlider>

      {/* Dialog (se abre desde page actions o editar) */}
      <ResponsiveDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <SavingsGoalDialogContent
          key={editingGoal?.id ?? 'new'}
          projectId={projectId}
          userId={userId}
          currencies={currencies}
          defaultCurrencyId={defaultCurrency.id}
          goal={editingGoal}
          onSuccess={handleDialogClose}
          onMutationStart={onMutationStart}
          onMutationSuccess={onMutationSuccess}
          onMutationError={onMutationError}
        />
      </ResponsiveDrawer>

      {/* Toolbar con filtros */}
      <PageToolbar label={`${goals.length} ${goals.length === 1 ? 'meta' : 'metas'}`}>
        <div className="inline-flex rounded-lg border bg-muted/50 p-0.5">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleFilterChange(tab.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 tabular-nums opacity-60">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </PageToolbar>

      {/* Goals List */}
      <div>
        {goals.length === 0 ? (
          <EmptyState
            icon={PiggyBank}
            title={emptyMessages[filter]}
            description="Crea una meta de ahorro para comenzar a guardar dinero hacia tus objetivos."
          />
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => (
              <SavingsGoalCard
                key={goal.id}
                goal={goal}
                userId={userId}
                onEdit={() => handleEdit(goal)}
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
