import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  integer,
  decimal,
  pgEnum,
  unique,
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
export const projectRoleEnum = pgEnum('project_role', ['owner', 'editor', 'viewer']);
export const entityTypeEnum = pgEnum('entity_type', [
  'bank',
  'credit_card',
  'supermarket',
  'pharmacy',
  'store',
  'restaurant',
  'service',
  'utility',
  'government',
  'hardware_store',
  'mechanic',
  'streaming',
  'grocery_store',
  'other',
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
// ENTITIES (Global - Banks, Supermarkets, etc.)
// ============================================================================

export const entities = pgTable('n1n4_entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  type: entityTypeEnum('type').notNull(),
  imageUrl: varchar('image_url', { length: 500 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by').references(() => users.id, {
    onDelete: 'set null',
  }),
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
  maxInstallmentAmount: decimal('max_installment_amount', {
    precision: 15,
    scale: 2,
  }),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ============================================================================
// PROJECT MEMBERS (Shared access to projects)
// ============================================================================

export const projectMembers = pgTable(
  'n1n4_project_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: projectRoleEnum('role').notNull().default('viewer'),
    invitedBy: uuid('invited_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    invitedAt: timestamp('invited_at', { mode: 'date' }).defaultNow().notNull(),
    acceptedAt: timestamp('accepted_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    unique('project_members_project_user').on(table.projectId, table.userId),
  ]
);

// ============================================================================
// CATEGORIES (Project-specific)
// ============================================================================

export const categories = pgTable('n1n4_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 7 }).notNull(),
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
  entityId: uuid('entity_id').references(() => entities.id, {
    onDelete: 'set null',
  }),
  currency: varchar('currency', { length: 3 }).default('CLP').notNull(),
  initialBalance: decimal('initial_balance', { precision: 15, scale: 2 })
    .default('0')
    .notNull(),
  currentBalance: decimal('current_balance', { precision: 15, scale: 2 })
    .default('0')
    .notNull(),
  // Credit limit for credit cards (null for other account types)
  creditLimit: decimal('credit_limit', { precision: 15, scale: 2 }),
  isDefault: boolean('is_default').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ============================================================================
// TRANSFERS (Between accounts)
// ============================================================================

export const transfers = pgTable('n1n4_transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  fromAccountId: uuid('from_account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  toAccountId: uuid('to_account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  date: timestamp('date', { mode: 'date' }).notNull(),
  description: varchar('description', { length: 500 }),
  notes: varchar('notes', { length: 1000 }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});
