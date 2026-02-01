import type { cardPurchases } from '@/lib/db/schema';

export type CardPurchase = typeof cardPurchases.$inferSelect;

export interface CardPurchaseWithDetails extends CardPurchase {
  accountName: string;
  accountType: string;
  accountEntityName: string | null;
  accountEntityImageUrl: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  entityName: string | null;
  entityImageUrl: string | null;
  remainingInstallments: number;
  remainingAmount: number;
  progressPercentage: number;
  nextChargeDate: Date | null;
}

export interface CardPurchasesSummary {
  totalPurchases: number;
  activePurchases: number;
  totalDebt: number;
  totalInterestPaid: number;
  monthlyCharge: number; // Total de cuotas que se cargan este mes
  // Debt capacity report
  personalDebt: number; // Deuda personal (excluye externa)
  externalDebt: number; // Deuda externa (de familiares/otros)
}

export interface DebtCapacityReport {
  maxInstallmentAmount: number | null; // Límite mensual configurado en el proyecto
  personalDebt: number; // Cargo mensual personal (suma de cuotas propias)
  externalDebt: number; // Cargo mensual externo (suma de cuotas de terceros)
  usedPercentage: number; // % usado del límite (solo cargos personales)
  availableCapacity: number; // Capacidad mensual disponible
  isOverLimit: boolean; // Si se excedió el límite mensual
}
