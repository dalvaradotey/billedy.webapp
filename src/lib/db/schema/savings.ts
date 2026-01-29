import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  decimal,
  date,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { currencies, projects } from './core';

// ============================================================================
// ENUMS
// ============================================================================

export const savingsFundTypeEnum = pgEnum('savings_fund_type', [
  'emergency',
  'investment',
  'goal',
  'other',
]);

export const savingsMovementTypeEnum = pgEnum('savings_movement_type', [
  'deposit',
  'withdrawal',
]);

// ============================================================================
// SAVINGS FUNDS
// ============================================================================

export const savingsFunds = pgTable('n1n4_savings_funds', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, {
    onDelete: 'set null',
  }),
  name: varchar('name', { length: 255 }).notNull(),
  type: savingsFundTypeEnum('type').notNull(),
  accountType: varchar('account_type', { length: 100 }).notNull(), // Cuenta ahorro, Depósito plazo, etc.
  currencyId: uuid('currency_id')
    .notNull()
    .references(() => currencies.id),
  targetAmount: decimal('target_amount', { precision: 15, scale: 2 }),
  monthlyTarget: decimal('monthly_target', { precision: 15, scale: 2 }).notNull(),
  currentBalance: decimal('current_balance', { precision: 15, scale: 2 })
    .default('0')
    .notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ============================================================================
// SAVINGS MOVEMENTS
// ============================================================================

export const savingsMovements = pgTable('n1n4_savings_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  savingsFundId: uuid('savings_fund_id')
    .notNull()
    .references(() => savingsFunds.id, { onDelete: 'cascade' }),
  type: savingsMovementTypeEnum('type').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  date: date('date', { mode: 'date' }).notNull(),
  description: varchar('description', { length: 500 }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});
