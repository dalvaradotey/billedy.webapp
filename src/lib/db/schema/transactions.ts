import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  integer,
  decimal,
  date,
  text,
  pgEnum,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import {
  currencies,
  categories,
  projects,
  accounts,
  categoryTypeEnum,
} from './core';

// ============================================================================
// ENUMS
// ============================================================================

export const creditFrequencyEnum = pgEnum('credit_frequency', [
  'monthly',
  'biweekly',
  'weekly',
]);

// ============================================================================
// CREDITS (Loans with automatic installments)
// ============================================================================

export const credits = pgTable('n1n4_credits', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id),
  name: varchar('name', { length: 255 }).notNull(),
  originalPrincipalAmount: decimal('original_principal_amount', {
    precision: 15,
    scale: 2,
  }).notNull(),
  originalTotalAmount: decimal('original_total_amount', {
    precision: 15,
    scale: 2,
  }).notNull(),
  originalCurrency: varchar('original_currency', { length: 3 }).notNull(),
  originalCurrencyId: uuid('original_currency_id')
    .notNull()
    .references(() => currencies.id),
  basePrincipalAmount: decimal('base_principal_amount', {
    precision: 15,
    scale: 2,
  }).notNull(),
  baseTotalAmount: decimal('base_total_amount', {
    precision: 15,
    scale: 2,
  }).notNull(),
  baseCurrency: varchar('base_currency', { length: 3 }).notNull(),
  baseCurrencyId: uuid('base_currency_id')
    .notNull()
    .references(() => currencies.id),
  exchangeRate: decimal('exchange_rate', { precision: 15, scale: 6 })
    .default('1')
    .notNull(),
  installments: integer('installments').notNull(),
  installmentAmount: decimal('installment_amount', {
    precision: 15,
    scale: 2,
  }).notNull(),
  startDate: date('start_date', { mode: 'date' }).notNull(),
  endDate: date('end_date', { mode: 'date' }).notNull(),
  frequency: creditFrequencyEnum('frequency').default('monthly').notNull(),
  description: varchar('description', { length: 500 }),
  notes: text('notes'),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ============================================================================
// RECURRING ITEMS (Fixed expenses/incomes preloaded each month)
// ============================================================================

export const recurringItems = pgTable('n1n4_recurring_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id),
  accountId: uuid('account_id').references(() => accounts.id),
  type: categoryTypeEnum('type').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  currencyId: uuid('currency_id')
    .notNull()
    .references(() => currencies.id),
  dayOfMonth: integer('day_of_month'), // 1-31
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ============================================================================
// TRANSACTIONS (Income/Expenses)
// ============================================================================

export const transactions = pgTable('n1n4_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id),
  accountId: uuid('account_id').references(() => accounts.id),
  type: categoryTypeEnum('type').notNull(),
  originalAmount: decimal('original_amount', {
    precision: 15,
    scale: 2,
  }).notNull(),
  originalCurrency: varchar('original_currency', { length: 3 }).notNull(),
  originalCurrencyId: uuid('original_currency_id')
    .notNull()
    .references(() => currencies.id),
  baseAmount: decimal('base_amount', { precision: 15, scale: 2 }).notNull(),
  baseCurrency: varchar('base_currency', { length: 3 }).notNull(),
  baseCurrencyId: uuid('base_currency_id')
    .notNull()
    .references(() => currencies.id),
  exchangeRate: decimal('exchange_rate', { precision: 15, scale: 6 })
    .default('1')
    .notNull(),
  date: date('date', { mode: 'date' }).notNull(),
  description: varchar('description', { length: 500 }).notNull(),
  notes: text('notes'),
  isPaid: boolean('is_paid').default(false).notNull(),
  paidAt: timestamp('paid_at', { mode: 'date' }),
  creditId: uuid('credit_id').references(() => credits.id, {
    onDelete: 'set null',
  }),
  recurringItemId: uuid('recurring_item_id').references(() => recurringItems.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ============================================================================
// BUDGETS (Monthly budget per category)
// ============================================================================

export const budgets = pgTable(
  'n1n4_budgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    year: integer('year').notNull(),
    month: integer('month').notNull(), // 1-12
    amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    unique('budgets_project_category_period').on(
      table.projectId,
      table.categoryId,
      table.year,
      table.month
    ),
  ]
);
