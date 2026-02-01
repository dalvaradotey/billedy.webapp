import type { InferSelectModel } from 'drizzle-orm';
import type { projects, currencies } from '@/lib/db/schema';

export type Project = InferSelectModel<typeof projects>;

export type Currency = InferSelectModel<typeof currencies>;

export type ProjectWithCurrency = Project & {
  currencySymbol: string;
  currencyName: string;
};
