import { pgTable, uuid, varchar, bigint, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { projects } from './core';
import { transactions } from './transactions';

/** Usuario ↔ chat de Telegram. Activo cuando chat_id no es null. */
export const telegramLinks = pgTable('n1n4_telegram_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  chatId: bigint('chat_id', { mode: 'number' }).unique(),
  linkCode: varchar('link_code', { length: 16 }).unique(),
  codeExpiresAt: timestamp('code_expires_at', { mode: 'date' }),
  linkedAt: timestamp('linked_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

/** Gasto interpretado desde un mensaje: pendiente de confirmar o ya guardado */
export const telegramDrafts = pgTable('n1n4_telegram_drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  linkId: uuid('link_id')
    .notNull()
    .references(() => telegramLinks.id, { onDelete: 'cascade' }),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  transactionId: uuid('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});
