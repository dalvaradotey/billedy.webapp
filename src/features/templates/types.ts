import type { templates, templateItems } from '@/lib/db/schema';

// Base types from schema
export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;

export type TemplateItem = typeof templateItems.$inferSelect;
export type NewTemplateItem = typeof templateItems.$inferInsert;

// Template with items and related data
export interface TemplateWithItems extends Template {
  items: TemplateItemWithDetails[];
  itemsCount: number;
  totalIncome: number;
  totalExpense: number;
}

// Template item with category and entity info
export interface TemplateItemWithDetails extends TemplateItem {
  categoryName: string;
  categoryColor: string;
  accountName: string | null;
  entityName: string | null;
  entityImageUrl: string | null;
}

// Summary for dashboard
export interface TemplatesSummary {
  totalTemplates: number;
  activeTemplates: number;
  totalItems: number;
  totalMonthlyIncome: number;
  totalMonthlyExpense: number;
  netMonthly: number;
}
