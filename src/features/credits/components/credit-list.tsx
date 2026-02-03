'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, CreditCard as CreditCardIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/empty-state';

import { formatCurrency } from '@/lib/formatting';
import type { Entity } from '@/features/entities/types';
import type { CreditWithProgress, CreditSummary } from '../types';
import { SummaryCard } from './summary-card';
import { CreditCard } from './credit-card';
import { CreditDialogContent } from './credit-dialog';

interface CreditListProps {
  credits: CreditWithProgress[];
  categories: { id: string; name: string; color: string }[];
  entities: Entity[];
  accounts: { id: string; name: string; type: string }[];
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

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Créditos activos"
          value={String(summary.activeCredits)}
          subtitle={`de ${summary.totalCredits} total`}
          icon={<CreditCardIcon className="h-4 w-4 text-blue-600" />}
        />
        <SummaryCard
          title="Deuda total"
          value={formatCurrency(summary.totalDebt)}
          className="text-red-600"
        />
        <SummaryCard
          title="Total pagado"
          value={formatCurrency(summary.totalPaid)}
          className="text-green-600"
        />
        <SummaryCard
          title="Cuota mensual"
          value={formatCurrency(summary.monthlyPayment)}
          subtitle="aproximado"
          className="text-orange-600"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {showArchived ? 'Mostrando archivados' : `${credits.length} créditos`}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={handleOpenDialog}>
              <Plus className="h-4 w-4" />
              Nuevo crédito
            </Button>
          </DialogTrigger>
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
        </Dialog>
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
