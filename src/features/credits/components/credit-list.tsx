'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowRight,
  CreditCard as CreditCardIcon,
  TrendingUp,
  CheckCircle,
  Calendar,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ResponsiveDrawer, DrawerTrigger } from '@/components/ui/drawer';
import { EmptyState } from '@/components/empty-state';
import { SummaryCard } from '@/components/ui/summary-card';
import { SummaryCardsSlider } from '@/components/ui/summary-cards-slider';

import { formatCurrency } from '@/lib/formatting';
import type { Entity } from '@/features/entities/types';
import type { AccountWithEntity } from '@/features/accounts/types';
import type { CreditWithProgress, CreditSummary } from '../types';
import { CreditCard } from './credit-card';
import { CreditDialogContent } from './credit-dialog';

interface CreditListProps {
  credits: CreditWithProgress[];
  categories: { id: string; name: string; color: string }[];
  entities: Entity[];
  accounts: AccountWithEntity[];
  summary: CreditSummary;
  projectId: string;
  userId: string;
  showArchived: boolean;
}

export function CreditList({
  credits,
  categories,
  entities,
  accounts,
  summary,
  projectId,
  userId,
  showArchived,
}: CreditListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCredit, setEditingCredit] = useState<CreditWithProgress | null>(null);

  const onMutationStart = useCallback((_toastId: string | number) => {
    // No-op: los datos se actualizan automáticamente via cache invalidation
  }, []);

  const onMutationSuccess = useCallback((toastId: string | number, message: string) => {
    toast.success(message, { id: toastId });
  }, []);

  const onMutationError = useCallback((toastId: string | number, error: string) => {
    toast.error(error, { id: toastId });
  }, []);

  const handleEdit = (credit: CreditWithProgress) => {
    setEditingCredit(credit);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingCredit(null);
  };

  const handleOpenDialog = () => {
    setEditingCredit(null);
    setIsDialogOpen(true);
  };

  const handleFilterChange = (archived: boolean) => {
    if (archived) {
      router.push(`${pathname}?archived=true`);
    } else {
      router.push(pathname);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <SummaryCardsSlider>
        <SummaryCard
          title="Créditos Activos"
          value={String(summary.activeCredits)}
          subtitle={`de ${summary.totalCredits} total`}
          icon={<CreditCardIcon className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="info"
        />
        <SummaryCard
          title="Deuda Total"
          value={formatCurrency(summary.totalDebt)}
          subtitle="en cuotas pendientes"
          icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="danger"
        />
        <SummaryCard
          title="Total Pagado"
          value={formatCurrency(summary.totalPaid)}
          subtitle="acumulado"
          icon={<CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="success"
        />
        <SummaryCard
          title="Cuota Mensual"
          value={formatCurrency(summary.monthlyPayment)}
          subtitle="aproximado por mes"
          icon={<Calendar className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant="neutral"
        />
      </SummaryCardsSlider>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border bg-muted/50 p-0.5">
          <button
            onClick={() => handleFilterChange(false)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              !showArchived
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Activos
            <span className="ml-1 tabular-nums opacity-60">{summary.activeCredits}</span>
          </button>
          <button
            onClick={() => handleFilterChange(true)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              showArchived
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Archivados
          </button>
        </div>

        <ResponsiveDrawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DrawerTrigger asChild>
            <Button variant="cta-sm" onClick={handleOpenDialog}>
              Nuevo crédito
              <ArrowRight className="h-4 w-4" />
            </Button>
          </DrawerTrigger>
          <CreditDialogContent
            projectId={projectId}
            userId={userId}
            categories={categories}
            entities={entities}
            accounts={accounts}
            credit={editingCredit}
            onSuccess={handleDialogClose}
            onMutationStart={onMutationStart}
            onMutationSuccess={onMutationSuccess}
            onMutationError={onMutationError}
          />
        </ResponsiveDrawer>
      </div>

      {/* Credit List */}
      <div>
        {credits.length === 0 ? (
          <EmptyState
            icon={CreditCardIcon}
            title={showArchived ? 'No hay créditos archivados' : 'No hay créditos registrados'}
            description="Agrega un crédito para comenzar a trackear tus cuotas y pagos."
          />
        ) : (
          <div className="space-y-3">
            {credits.map((credit) => (
              <CreditCard
                key={credit.id}
                credit={credit}
                userId={userId}
                onEdit={() => handleEdit(credit)}
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
