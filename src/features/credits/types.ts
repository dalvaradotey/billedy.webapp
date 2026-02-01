import type { InferSelectModel } from 'drizzle-orm';
import type { credits } from '@/lib/db/schema';

export type Credit = InferSelectModel<typeof credits>;

export type CreditFrequency = 'monthly' | 'biweekly' | 'weekly';

export type CreditWithProgress = Credit & {
  categoryName: string;
  categoryColor: string;
  entityName: string | null;
  entityImageUrl: string | null;
  paidInstallments: number;
  remainingInstallments: number;
  paidAmount: number;
  remainingAmount: number;
  progressPercentage: number;
  nextPaymentDate: Date | null;
};

export type CreditSummary = {
  totalCredits: number;
  activeCredits: number;
  totalDebt: number;
  totalPaid: number;
  totalRemaining: number;
  monthlyPayment: number;
};
