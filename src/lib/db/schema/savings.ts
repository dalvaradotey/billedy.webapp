import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  decimal,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { currencies, projects } from './core';

// ============================================================================
// ENUMS
// ============================================================================

export const savingsGoalTypeEnum = pgEnum('savings_goal_type', [
  'emergency',
  'investment',
  'goal',
  'other',
]);

// ============================================================================
// SAVINGS GOALS
// ============================================================================

export const savingsGoals = pgTable('n1n4_savings_goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, {
    onDelete: 'set null',
  }),
  name: varchar('name', { length: 255 }).notNull(),
  type: savingsGoalTypeEnum('type').notNull(),
  currencyId: uuid('currency_id')
    .notNull()
    .references(() => currencies.id),
  targetAmount: decimal('target_amount', { precision: 15, scale: 2 }).notNull(),
  initialBalance: decimal('initial_balance', { precision: 15, scale: 2 })
    .default('0')
    .notNull(),
  isCompleted: boolean('is_completed').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});
