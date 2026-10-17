import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  date,
  text,
  pgEnum,
  jsonb,
} from 'drizzle-orm/pg-core';
import { projects } from './core';

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

  // Cascada completa al momento del cierre (referencia para avisar cambios posteriores)
  closingSnapshot: jsonb('closing_snapshot'),

  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});
