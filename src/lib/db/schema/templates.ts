import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  decimal,
  text,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { projects, categories, accounts, entities, categoryTypeEnum } from './core';

// ============================================================================
// TEMPLATES (Reusable transaction templates)
// ============================================================================

export const templates = pgTable('n1n4_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 500 }),
  isActive: boolean('is_active').default(true).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ============================================================================
// TEMPLATE ITEMS
// ============================================================================

export const templateItems = pgTable('n1n4_template_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id')
    .notNull()
    .references(() => templates.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id),
  accountId: uuid('account_id').references(() => accounts.id, {
    onDelete: 'set null',
  }),
  entityId: uuid('entity_id').references(() => entities.id, {
    onDelete: 'set null',
  }),
  type: categoryTypeEnum('type').notNull(),
  description: varchar('description', { length: 500 }).notNull(),
  originalAmount: decimal('original_amount', { precision: 15, scale: 2 }).notNull(),
  originalCurrency: varchar('original_currency', { length: 3 }).notNull(),
  baseAmount: decimal('base_amount', { precision: 15, scale: 2 }).notNull(),
  baseCurrency: varchar('base_currency', { length: 3 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});
