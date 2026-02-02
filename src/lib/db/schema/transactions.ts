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
  entities,
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
  entityId: uuid('entity_id').references(() => entities.id, {
    onDelete: 'set null',
  }),
  accountId: uuid('account_id').references(() => accounts.id, {
    onDelete: 'set null',
  }),
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
  initialPaidInstallments: integer('initial_paid_installments').default(0).notNull(),
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
  entityId: uuid('entity_id').references(() => entities.id, {
    onDelete: 'set null',
  }),
  type: categoryTypeEnum('type').notNull(),
  originalAmount: decimal('original_amount', {
    precision: 15,
    scale: 2,
  }).notNull(),
  originalCurrency: varchar('original_currency', { length: 3 }).notNull(),
  baseAmount: decimal('base_amount', { precision: 15, scale: 2 }).notNull(),
  baseCurrency: varchar('base_currency', { length: 3 }).notNull(),
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
  budgetId: uuid('budget_id').references(() => budgets.id, {
    onDelete: 'set null',
  }),
  cardPurchaseId: uuid('card_purchase_id').references(() => cardPurchases.id, {
    onDelete: 'set null',
  }),
  // Para transferencias entre cuentas: referencia a la transacción vinculada
  linkedTransactionId: uuid('linked_transaction_id'),
  // Para pagos de tarjeta de crédito: referencia a la transferencia que pagó esta transacción
  paidByTransferId: uuid('paid_by_transfer_id'),
  // Para compras en cuotas: indica si la cuota fue pagada antes de usar la app
  isHistoricallyPaid: boolean('is_historically_paid').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ============================================================================
// CREDIT CARD PURCHASES (Installment purchases on credit cards)
// ============================================================================

export const cardPurchases = pgTable('n1n4_card_purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  entityId: uuid('entity_id').references(() => entities.id, {
    onDelete: 'set null',
  }),

  // Purchase details
  description: varchar('description', { length: 500 }).notNull(),
  storeName: varchar('store_name', { length: 255 }), // Alternative to entityId - user can use one or the other
  purchaseDate: date('purchase_date', { mode: 'date' }).notNull(),

  // Amounts
  originalAmount: decimal('original_amount', { precision: 15, scale: 2 }).notNull(), // Cash price
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull(), // Total with interest
  interestAmount: decimal('interest_amount', { precision: 15, scale: 2 }).notNull(), // Calculated interest
  interestRate: decimal('interest_rate', { precision: 5, scale: 2 }), // Optional: interest rate %

  // Installments
  installments: integer('installments').notNull(),
  installmentAmount: decimal('installment_amount', { precision: 15, scale: 2 }).notNull(),
  firstChargeDate: date('first_charge_date', { mode: 'date' }).notNull(),
  chargedInstallments: integer('charged_installments').default(0).notNull(),
  initialPaidInstallments: integer('initial_paid_installments').default(0).notNull(),

  // Status
  isActive: boolean('is_active').default(true).notNull(),
  isExternalDebt: boolean('is_external_debt').default(false).notNull(), // For purchases made for others (family, etc.)
  notes: text('notes'),

  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ============================================================================
// BUDGETS (Budget definitions/templates)
// ============================================================================

export const budgets = pgTable('n1n4_budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  categoryId: uuid('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  defaultAmount: decimal('default_amount', { precision: 15, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('CLP').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});
