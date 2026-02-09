'use client';

import { useState } from 'react';
import { CreditCard, Receipt } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';

import { chargeAllPendingInstallments } from '../actions';
import type { CardPurchaseWithDetails, CardPurchasesSummary, DebtCapacityReport } from '../types';
import type { AccountWithEntity } from '@/features/accounts/types';
import type { Category } from '@/features/categories/types';
import type { Entity } from '@/features/entities/types';

import { SummaryCards } from './summary-cards';
import { DebtCapacityCard } from './debt-capacity-card';
import { CardPurchaseCard } from './card-purchase-card';
import { CreatePurchaseDialog } from './create-purchase-dialog';

interface CardPurchasesListProps {
  purchases: CardPurchaseWithDetails[];
  summary: CardPurchasesSummary;
  debtCapacity: DebtCapacityReport;
  accounts: AccountWithEntity[];
  categories: Category[];
  entities: Entity[];
  projectId: string;
  userId: string;
}

export function CardPurchasesList({
  purchases,
  summary,
  debtCapacity,
  accounts,
  categories,
  entities,
  projectId,
  userId,
}: CardPurchasesListProps) {
  const [showActive, setShowActive] = useState(true);

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleChargeAll = async () => {
    const result = await chargeAllPendingInstallments(projectId, userId);
    if (result.success) {
      window.location.reload();
    }
  };

  const filteredPurchases = showActive
    ? purchases.filter((p) => p.isActive)
    : purchases;

  const activePurchases = purchases.filter((p) => p.isActive);
  const hasPendingCharges = activePurchases.some(
    (p) => p.nextChargeDate && new Date(p.nextChargeDate) <= new Date()
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <SummaryCards summary={summary} />
        <DebtCapacityCard report={debtCapacity} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={showActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowActive(true)}
          >
            Activas ({activePurchases.length})
          </Button>
          <Button
            variant={!showActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowActive(false)}
          >
            Todas ({purchases.length})
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {hasPendingCharges && (
            <Button variant="outline" onClick={handleChargeAll} className="w-full sm:w-auto">
              <Receipt className="mr-2 h-4 w-4" />
              Cobrar cuotas pendientes
            </Button>
          )}
          <CreatePurchaseDialog
            projectId={projectId}
            userId={userId}
            accounts={accounts}
            categories={categories}
            entities={entities}
            onSuccess={handleRefresh}
          />
        </div>
      </div>

      {filteredPurchases.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={showActive ? 'No hay compras activas' : 'No hay compras registradas'}
          description="Registra tus compras en cuotas para hacer seguimiento de los pagos y saber cuánto estás pagando en intereses."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredPurchases.map((purchase) => (
            <CardPurchaseCard
              key={purchase.id}
              purchase={purchase}
              userId={userId}
              onUpdate={handleRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
