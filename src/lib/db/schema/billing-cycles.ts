import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  decimal,
  date,
  text,
  pgEnum,
  unique,
} from 'drizzle-orm/pg-core';
import { projects } from './core';
import { budgets } from './transactions';

// ============================================================================
// ENUMS
// ============================================================================

export const billingCycleStatusEnum = pgEnum('billing_cycle_status', [
  'open',
  'closed',
]);

// ============================================================================
// BILLING CYCLES
// ============================================================================

export const billingCycles = pgTable('n1n4_billing_cycles', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  startDate: date('start_date', { mode: 'date' }).notNull(),
  endDate: date('end_date', { mode: 'date' }).notNull(),
  status: billingCycleStatusEnum('status').notNull().default('open'),

  // Snapshot (se guarda al cerrar el ciclo)
  snapshotIncome: decimal('snapshot_income', { precision: 15, scale: 2 }),
  snapshotExpenses: decimal('snapshot_expenses', { precision: 15, scale: 2 }),
  snapshotSavings: decimal('snapshot_savings', { precision: 15, scale: 2 }),
  snapshotBalance: decimal('snapshot_balance', { precision: 15, scale: 2 }),

  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ============================================================================
// BILLING CYCLE BUDGETS (Budget allocations per cycle)
// ============================================================================

export const billingCycleBudgets = pgTable(
  'n1n4_billing_cycle_budgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    billingCycleId: uuid('billing_cycle_id')
      .notNull()
      .references(() => billingCycles.id, { onDelete: 'cascade' }),
    budgetId: uuid('budget_id')
      .notNull()
      .references(() => budgets.id, { onDelete: 'cascade' }),
    amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    unique('billing_cycle_budgets_cycle_budget').on(
      table.billingCycleId,
      table.budgetId
    ),
  ]
);
