'use client';

import { CreditCard, Calendar, Percent, TrendingUp, AlertTriangle, Shield } from 'lucide-react';
import { SummaryCard } from '@/components/ui/summary-card';
import { SummaryCardsSlider } from '@/components/ui/summary-cards-slider';
import { formatCurrency } from '@/lib/formatting';
import type { CardPurchasesSummary, DebtCapacityReport } from '../types';

interface SummaryCardsProps {
  summary: CardPurchasesSummary;
  debtCapacity: DebtCapacityReport;
}

export function SummaryCards({ summary, debtCapacity }: SummaryCardsProps) {
  const hasCapacityLimit = debtCapacity.maxInstallmentAmount !== null;
  const capacityVariant = debtCapacity.isOverLimit
    ? 'danger' as const
    : debtCapacity.usedPercentage >= 80
      ? 'danger' as const
      : 'success' as const;

  return (
    <SummaryCardsSlider>
      <SummaryCard
        title="Compras Activas"
        value={String(summary.activePurchases)}
        subtitle={`de ${summary.totalPurchases} totales`}
        icon={<CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />}
        variant="info"
      />
      <SummaryCard
        title="Deuda Total"
        value={formatCurrency(summary.totalDebt)}
        subtitle={summary.externalDebt > 0
          ? `Propia: ${formatCurrency(summary.personalDebt)} · Ext: ${formatCurrency(summary.externalDebt)}`
          : 'en cuotas pendientes'
        }
        icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />}
        variant="danger"
      />
      <SummaryCard
        title="Cargo Mensual"
        value={formatCurrency(summary.monthlyCharge)}
        subtitle={debtCapacity.externalDebt > 0
          ? `Propia: ${formatCurrency(debtCapacity.personalDebt)} · Ext: ${formatCurrency(debtCapacity.externalDebt)}`
          : 'aproximado por mes'
        }
        icon={<Calendar className="h-4 w-4 sm:h-5 sm:w-5" />}
        variant="neutral"
      />
      {hasCapacityLimit ? (
        <SummaryCard
          title="Capacidad"
          value={`${debtCapacity.usedPercentage}%`}
          subtitle={`Disponible: ${formatCurrency(debtCapacity.availableCapacity)}`}
          icon={
            debtCapacity.isOverLimit
              ? <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
              : <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
          }
          variant={capacityVariant}
        />
      ) : (
        <SummaryCard
          title="Intereses"
          value={formatCurrency(summary.totalInterestPaid)}
          subtitle="total acumulado"
          icon={<Percent className="h-4 w-4 sm:h-5 sm:w-5" />}
          variant={summary.totalInterestPaid > 0 ? 'danger' : 'neutral'}
        />
      )}
    </SummaryCardsSlider>
  );
}
