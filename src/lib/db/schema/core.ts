import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  integer,
  decimal,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { users } from './auth';

// ============================================================================
// ENUMS
// ============================================================================

export const categoryTypeEnum = pgEnum('category_type', ['income', 'expense']);
export const accountTypeEnum = pgEnum('account_type', [
  'checking',
  'savings',
  'cash',
  'credit_card',
]);

// ============================================================================
// CURRENCIES
// ============================================================================

export const currencies = pgTable('n1n4_currencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 3 }).unique().notNull(), // ISO 4217
  symbol: varchar('symbol', { length: 10 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  decimalSeparator: varchar('decimal_separator', { length: 1 })
    .default('.')
    .notNull(),
  thousandsSeparator: varchar('thousands_separator', { length: 1 })
    .default(',')
    .notNull(),
  decimalPlaces: integer('decimal_places').default(2).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ============================================================================
// CATEGORY TEMPLATES (System defaults)
// ============================================================================

export const categoryTemplates = pgTable('n1n4_category_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  type: categoryTypeEnum('type').notNull(),
  group: varchar('group', { length: 100 }),
  color: varchar('color', { length: 7 }).notNull(), // Hex color
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ============================================================================
// CATEGORIES (User-specific)
// ============================================================================

export const categories = pgTable('n1n4_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  type: categoryTypeEnum('type').notNull(),
  group: varchar('group', { length: 100 }),
  color: varchar('color', { length: 7 }).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ============================================================================
// PROJECTS (Financial periods/balances)
// ============================================================================

export const projects = pgTable('n1n4_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 500 }),
  baseCurrencyId: uuid('base_currency_id')
    .notNull()
    .references(() => currencies.id),
  currency: varchar('currency', { length: 3 }).notNull(), // Código: CLP, USD
  defaultIncomeAmount: decimal('default_income_amount', {
    precision: 15,
    scale: 2,
  }),
  maxInstallmentAmount: decimal('max_installment_amount', {
    precision: 15,
    scale: 2,
  }),
  debitAvailable: decimal('debit_available', { precision: 15, scale: 2 }),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ============================================================================
// ACCOUNTS (Bank accounts, cash, credit cards)
// ============================================================================

export const accounts = pgTable('n1n4_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: accountTypeEnum('type').notNull(),
  bankName: varchar('bank_name', { length: 255 }),
  currencyId: uuid('currency_id')
    .notNull()
    .references(() => currencies.id),
  initialBalance: decimal('initial_balance', { precision: 15, scale: 2 })
    .default('0')
    .notNull(),
  currentBalance: decimal('current_balance', { precision: 15, scale: 2 })
    .default('0')
    .notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});
