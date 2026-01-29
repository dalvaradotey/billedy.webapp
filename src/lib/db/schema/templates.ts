import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  decimal,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { currencies, categories, categoryTypeEnum } from './core';

// ============================================================================
// TEMPLATES (Reusable transaction templates)
// ============================================================================

export const templates = pgTable('n1n4_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 500 }),
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
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id),
  type: categoryTypeEnum('type').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  currencyId: uuid('currency_id')
    .notNull()
    .references(() => currencies.id),
  description: varchar('description', { length: 500 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});
