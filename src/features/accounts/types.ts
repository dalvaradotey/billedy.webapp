import type { accounts } from '@/lib/db/schema';
import type { Entity } from '@/features/entities/types';

export type Account = typeof accounts.$inferSelect;

export type AccountType = 'checking' | 'savings' | 'cash' | 'credit_card';

export interface AccountWithEntity extends Account {
  entity: Entity | null;
}

export interface AccountWithBalance extends Account {
  // Computed fields
  availableBalance: number; // currentBalance for debit accounts, available credit for credit cards
  availableCredit?: number; // creditLimit - currentBalance (only for credit cards)
  usedCredit?: number; // currentBalance (only for credit cards, represents debt)
  entity?: Entity | null;
}

export interface AccountsSummary {
  totalAccounts: number;
  totalDebitBalance: number; // Sum of checking + savings + cash
  totalCreditBalance: number; // Sum of credit card balances (what you owe)
  netWorth: number; // totalDebitBalance - totalCreditBalance
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Cuenta Corriente',
  savings: 'Cuenta de Ahorro',
  cash: 'Efectivo',
  credit_card: 'Tarjeta de Crédito',
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  checking: 'building-2', // Bank building
  savings: 'piggy-bank',
  cash: 'wallet',
  credit_card: 'credit-card',
};
