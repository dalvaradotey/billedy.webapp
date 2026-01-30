import type { InferSelectModel } from 'drizzle-orm';
import type { projects } from '@/lib/db/schema';

export type Project = InferSelectModel<typeof projects>;

export type ProjectWithCurrency = Project & {
  currencySymbol: string;
  currencyName: string;
};
