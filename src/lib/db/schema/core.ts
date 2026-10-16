import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  integer,
  decimal,
  date,
  pgEnum,
  unique,
  primaryKey,
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
  'pension',
  'unemployment',
]);
export const projectRoleEnum = pgEnum('project_role', ['owner', 'editor', 'viewer']);

/**
 * Naturaleza de una transacción: separa lo propio de lo que se compensa.
 * - expense: own | external (lo paga otra persona) | reimbursable | fund (sale del fondo de imprevistos)
 * - income:  own | reimbursement (abono / devolución)
 */
export const transactionNatureEnum = pgEnum('transaction_nature', [
  'own',
  'external',
  'reimbursable',
  'fund',
  'reimbursement',
]);
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
  'pension_fund',
  'unemployment_fund',
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
  // Plan del ciclo: ahorro objetivo, techo de gasto propio en TC y cuenta del fondo de imprevistos
  savingsTarget: decimal('savings_target', { precision: 15, scale: 2 }),
  cardSpendingCap: decimal('card_spending_cap', { precision: 15, scale: 2 }),
  contingencyAccountId: uuid('contingency_account_id'),
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
  defaultNature: transactionNatureEnum('default_nature'),
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
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
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
  // Diseño de tarjeta de la billetera (null = automático según el banco)
  cardDesign: varchar('card_design', { length: 40 }),
  // Previsión por cuotas (AFP / AFC): saldo = cuotas × valor cuota del día
  pensionProvider: varchar('pension_provider', { length: 20 }),
  pensionFund: varchar('pension_fund', { length: 10 }),
  quotaCount: decimal('quota_count', { precision: 18, scale: 4 }),
  quotaCountDate: date('quota_count_date'),
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

// ============================================================================
// ACCOUNT FUNDS (fondos dentro de una cuenta)
// ============================================================================

/**
 * Divide el saldo de una cuenta en fondos que solo existen en la app.
 * Saldo del fondo = movimientos (initial + allocate − release) − gastos pagados con el fondo.
 * Libre de la cuenta = saldo de la cuenta − saldo de sus fondos.
 */
export const accountFunds = pgTable('n1n4_account_funds', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  targetAmount: decimal('target_amount', { precision: 15, scale: 2 }),
  isThirdParty: boolean('is_third_party').default(false).notNull(),
  // Provisión: para gastos que vienen; apartar baja lo libre pero no es ahorro
  isProvision: boolean('is_provision').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

export const fundMovementKindEnum = pgEnum('fund_movement_kind', ['initial', 'allocate', 'release']);

export const fundMovements = pgTable('n1n4_fund_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  fundId: uuid('fund_id')
    .notNull()
    .references(() => accountFunds.id, { onDelete: 'cascade' }),
  kind: fundMovementKindEnum('kind').notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  date: date('date', { mode: 'date' }).notNull(),
  notes: varchar('notes', { length: 500 }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

/** Valor cuota diario de los fondos de pensiones y de cesantía (dato público) */
export const quotaValues = pgTable(
  'n1n4_quota_values',
  {
    provider: varchar('provider', { length: 20 }).notNull(),
    fund: varchar('fund', { length: 10 }).notNull(),
    date: date('date').notNull(),
    value: decimal('value', { precision: 14, scale: 2 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.fund, t.date] })]
);

/** Cotizaciones de AFP / AFC por cuenta: historial y aportes que suman cuotas */
export const pensionContributions = pgTable(
  'n1n4_pension_contributions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    period: date('period').notNull(),
    paidDate: date('paid_date'),
    taxableIncome: decimal('taxable_income', { precision: 15, scale: 2 }),
    amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
    quotas: decimal('quotas', { precision: 18, scale: 4 }),
    employerRut: varchar('employer_rut', { length: 20 }),
    source: varchar('source', { length: 30 }).notNull(),
    applied: boolean('applied').default(false).notNull(),
    transactionId: uuid('transaction_id'),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.accountId, t.period)]
);
