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

// Billing Cycles
export * from './billing-cycles';

// ============================================================================
// RELATIONS
// ============================================================================

import { relations } from 'drizzle-orm';
import { users, oauthAccounts, sessions } from './auth';
import { currencies, categories, projects, projectMembers, accounts, transfers, entities } from './core';
import { transactions, credits, recurringItems, budgets, cardPurchases } from './transactions';
import { savingsFunds, savingsMovements } from './savings';
import { templates, templateItems } from './templates';
import { billingCycles, billingCycleBudgets } from './billing-cycles';

// User relations
export const usersRelations = relations(users, ({ many }) => ({
  oauthAccounts: many(oauthAccounts),
  sessions: many(sessions),
  projects: many(projects),
  projectMemberships: many(projectMembers),
  accounts: many(accounts),
  transactions: many(transactions),
  credits: many(credits),
  recurringItems: many(recurringItems),
  savingsFunds: many(savingsFunds),
  templates: many(templates),
  transfers: many(transfers),
  cardPurchases: many(cardPurchases),
  createdEntities: many(entities),
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
  project: one(projects, {
    fields: [categories.projectId],
    references: [projects.id],
  }),
  transactions: many(transactions),
  credits: many(credits),
  recurringItems: many(recurringItems),
  budgets: many(budgets),
  templateItems: many(templateItems),
  cardPurchases: many(cardPurchases),
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
  members: many(projectMembers),
  categories: many(categories),
  transactions: many(transactions),
  credits: many(credits),
  recurringItems: many(recurringItems),
  budgets: many(budgets),
  savingsFunds: many(savingsFunds),
  billingCycles: many(billingCycles),
  transfers: many(transfers),
  cardPurchases: many(cardPurchases),
  templates: many(templates),
}));

// Project members relations
export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
  inviter: one(users, {
    fields: [projectMembers.invitedBy],
    references: [users.id],
  }),
}));

// Accounts relations
export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
  recurringItems: many(recurringItems),
  outgoingTransfers: many(transfers, { relationName: 'fromAccount' }),
  incomingTransfers: many(transfers, { relationName: 'toAccount' }),
  cardPurchases: many(cardPurchases),
  templateItems: many(templateItems),
}));

// Currencies relations
export const currenciesRelations = relations(currencies, ({ many }) => ({
  projects: many(projects),
  accounts: many(accounts),
  savingsFunds: many(savingsFunds),
}));

// Entities relations
export const entitiesRelations = relations(entities, ({ one, many }) => ({
  creator: one(users, {
    fields: [entities.createdBy],
    references: [users.id],
  }),
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
  entity: one(entities, {
    fields: [transactions.entityId],
    references: [entities.id],
  }),
  credit: one(credits, {
    fields: [transactions.creditId],
    references: [credits.id],
  }),
  recurringItem: one(recurringItems, {
    fields: [transactions.recurringItemId],
    references: [recurringItems.id],
  }),
  budget: one(budgets, {
    fields: [transactions.budgetId],
    references: [budgets.id],
  }),
  cardPurchase: one(cardPurchases, {
    fields: [transactions.cardPurchaseId],
    references: [cardPurchases.id],
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
export const budgetsRelations = relations(budgets, ({ one, many }) => ({
  project: one(projects, {
    fields: [budgets.projectId],
    references: [projects.id],
  }),
  category: one(categories, {
    fields: [budgets.categoryId],
    references: [categories.id],
  }),
  billingCycleBudgets: many(billingCycleBudgets),
  transactions: many(transactions),
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
  project: one(projects, {
    fields: [templates.projectId],
    references: [projects.id],
  }),
  items: many(templateItems),
}));

// Template items relations
export const templateItemsRelations = relations(templateItems, ({ one }) => ({
  template: one(templates, {
    fields: [templateItems.templateId],
    references: [templates.id],
  }),
  user: one(users, {
    fields: [templateItems.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [templateItems.projectId],
    references: [projects.id],
  }),
  category: one(categories, {
    fields: [templateItems.categoryId],
    references: [categories.id],
  }),
  account: one(accounts, {
    fields: [templateItems.accountId],
    references: [accounts.id],
  }),
  entity: one(entities, {
    fields: [templateItems.entityId],
    references: [entities.id],
  }),
}));

// Billing cycles relations
export const billingCyclesRelations = relations(billingCycles, ({ one, many }) => ({
  project: one(projects, {
    fields: [billingCycles.projectId],
    references: [projects.id],
  }),
  billingCycleBudgets: many(billingCycleBudgets),
}));

// Billing cycle budgets relations
export const billingCycleBudgetsRelations = relations(billingCycleBudgets, ({ one }) => ({
  billingCycle: one(billingCycles, {
    fields: [billingCycleBudgets.billingCycleId],
    references: [billingCycles.id],
  }),
  budget: one(budgets, {
    fields: [billingCycleBudgets.budgetId],
    references: [budgets.id],
  }),
}));

// Transfers relations
export const transfersRelations = relations(transfers, ({ one }) => ({
  user: one(users, {
    fields: [transfers.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [transfers.projectId],
    references: [projects.id],
  }),
  fromAccount: one(accounts, {
    fields: [transfers.fromAccountId],
    references: [accounts.id],
    relationName: 'fromAccount',
  }),
  toAccount: one(accounts, {
    fields: [transfers.toAccountId],
    references: [accounts.id],
    relationName: 'toAccount',
  }),
}));

// Card purchases relations
export const cardPurchasesRelations = relations(cardPurchases, ({ one, many }) => ({
  user: one(users, {
    fields: [cardPurchases.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [cardPurchases.projectId],
    references: [projects.id],
  }),
  account: one(accounts, {
    fields: [cardPurchases.accountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [cardPurchases.categoryId],
    references: [categories.id],
  }),
  transactions: many(transactions),
}));
