// ============================================================================
// SCHEMA EXPORTS
// ============================================================================

// Auth
export * from './auth';

// Core
export * from './core';

// Transactions
export * from './transactions';

// Savings
export * from './savings';

// Templates
export * from './templates';

// ============================================================================
// RELATIONS
// ============================================================================

import { relations } from 'drizzle-orm';
import { users, oauthAccounts, sessions } from './auth';
import { currencies, categories, categoryTemplates, projects, accounts } from './core';
import { transactions, credits, recurringItems, budgets } from './transactions';
import { savingsFunds, savingsMovements } from './savings';
import { templates, templateItems } from './templates';

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  oauthAccounts: many(oauthAccounts),
  sessions: many(sessions),
  categories: many(categories),
  projects: many(projects),
  accounts: many(accounts),
  transactions: many(transactions),
  credits: many(credits),
  recurringItems: many(recurringItems),
  savingsFunds: many(savingsFunds),
  templates: many(templates),
}));

// OAuth accounts relations
export const oauthAccountsRelations = relations(oauthAccounts, ({ one }) => ({
  user: one(users, {
    fields: [oauthAccounts.userId],
    references: [users.id],
  }),
}));

// Sessions relations
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// Categories relations
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
  credits: many(credits),
  recurringItems: many(recurringItems),
  budgets: many(budgets),
  templateItems: many(templateItems),
}));

// Projects relations
export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  baseCurrency: one(currencies, {
    fields: [projects.baseCurrencyId],
    references: [currencies.id],
  }),
  transactions: many(transactions),
  credits: many(credits),
  recurringItems: many(recurringItems),
  budgets: many(budgets),
  savingsFunds: many(savingsFunds),
}));

// Accounts relations
export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
  currency: one(currencies, {
    fields: [accounts.currencyId],
    references: [currencies.id],
  }),
  transactions: many(transactions),
  recurringItems: many(recurringItems),
}));

// Currencies relations
export const currenciesRelations = relations(currencies, ({ many }) => ({
  projects: many(projects),
  accounts: many(accounts),
  savingsFunds: many(savingsFunds),
  templateItems: many(templateItems),
}));

// Transactions relations
export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [transactions.projectId],
    references: [projects.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  originalCurrencyRef: one(currencies, {
    fields: [transactions.originalCurrencyId],
    references: [currencies.id],
  }),
  baseCurrencyRef: one(currencies, {
    fields: [transactions.baseCurrencyId],
    references: [currencies.id],
  }),
  credit: one(credits, {
    fields: [transactions.creditId],
    references: [credits.id],
  }),
  recurringItem: one(recurringItems, {
    fields: [transactions.recurringItemId],
    references: [recurringItems.id],
  }),
}));

// Credits relations
export const creditsRelations = relations(credits, ({ one, many }) => ({
  user: one(users, {
    fields: [credits.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [credits.projectId],
    references: [projects.id],
  }),
  category: one(categories, {
    fields: [credits.categoryId],
    references: [categories.id],
  }),
  transactions: many(transactions),
}));

// Recurring items relations
export const recurringItemsRelations = relations(recurringItems, ({ one, many }) => ({
  user: one(users, {
    fields: [recurringItems.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [recurringItems.projectId],
    references: [projects.id],
  }),
  category: one(categories, {
    fields: [recurringItems.categoryId],
    references: [categories.id],
  }),
  account: one(accounts, {
    fields: [recurringItems.accountId],
    references: [accounts.id],
  }),
  currency: one(currencies, {
    fields: [recurringItems.currencyId],
    references: [currencies.id],
  }),
  transactions: many(transactions),
}));

// Budgets relations
export const budgetsRelations = relations(budgets, ({ one }) => ({
  project: one(projects, {
    fields: [budgets.projectId],
    references: [projects.id],
  }),
  category: one(categories, {
    fields: [budgets.categoryId],
    references: [categories.id],
  }),
}));

// Savings funds relations
export const savingsFundsRelations = relations(savingsFunds, ({ one, many }) => ({
  user: one(users, {
    fields: [savingsFunds.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [savingsFunds.projectId],
    references: [projects.id],
  }),
  currency: one(currencies, {
    fields: [savingsFunds.currencyId],
    references: [currencies.id],
  }),
  movements: many(savingsMovements),
}));

// Savings movements relations
export const savingsMovementsRelations = relations(savingsMovements, ({ one }) => ({
  savingsFund: one(savingsFunds, {
    fields: [savingsMovements.savingsFundId],
    references: [savingsFunds.id],
  }),
}));

// Templates relations
export const templatesRelations = relations(templates, ({ one, many }) => ({
  user: one(users, {
    fields: [templates.userId],
    references: [users.id],
  }),
  items: many(templateItems),
}));

// Template items relations
export const templateItemsRelations = relations(templateItems, ({ one }) => ({
  template: one(templates, {
    fields: [templateItems.templateId],
    references: [templates.id],
  }),
  category: one(categories, {
    fields: [templateItems.categoryId],
    references: [categories.id],
  }),
  currency: one(currencies, {
    fields: [templateItems.currencyId],
    references: [currencies.id],
  }),
}));
