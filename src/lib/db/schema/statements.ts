import { pgTable, uuid, varchar, date, decimal, jsonb, timestamp, integer, unique } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { projects, accounts, categories, entities, transactionNatureEnum } from './core';
import { budgets } from './transactions';

/** Estado de cuenta de TC leído desde el PDF (sin guardar el archivo) */
export const cardStatements = pgTable(
  'n1n4_card_statements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    statementDate: date('statement_date').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    dueDate: date('due_date'),
    totalBilled: decimal('total_billed', { precision: 15, scale: 2 }).notNull(),
    minimumPayment: decimal('minimum_payment', { precision: 15, scale: 2 }),
    lines: jsonb('lines').notNull(),
    reconciledAt: timestamp('reconciled_at', { mode: 'date' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.accountId, t.statementDate)]
);

/** Comercio como aparece en el banco → cómo lo registra el usuario */
export const merchantAliases = pgTable(
  'n1n4_merchant_aliases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 120 }).notNull(),
    description: varchar('description', { length: 500 }).notNull(),
    budgetId: uuid('budget_id').references(() => budgets.id, { onDelete: 'set null' }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'set null' }),
    nature: transactionNatureEnum('nature').notNull().default('own'),
    times: integer('times').notNull().default(1),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.projectId, t.key)]
);
