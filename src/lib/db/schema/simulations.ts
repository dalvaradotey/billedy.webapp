import { pgTable, uuid, varchar, decimal, jsonb, text, timestamp, index } from 'drizzle-orm/pg-core';
import { projects } from './core';
import { users } from './auth';

/**
 * Simulaciones "¿Me alcanza?" guardadas (migración 0027). `plan` es el PlanInput
 * de src/features/simulator/lib/plan.ts; `source` dice si la armó la app o Claude.
 */
export const simulations = pgTable(
  'n1n4_simulations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    target: decimal('target', { precision: 15, scale: 2 }).notNull(),
    plan: jsonb('plan').notNull(),
    source: varchar('source', { length: 10 }).notNull().default('app'),
    note: text('note'),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [index('n1n4_simulations_project_id_idx').on(t.projectId, t.createdAt)]
);
