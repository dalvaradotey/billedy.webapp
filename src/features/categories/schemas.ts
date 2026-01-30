import { createInsertSchema } from 'drizzle-zod';
import { categories } from '@/lib/db/schema';
import { z } from 'zod';

export const createCategorySchema = createInsertSchema(categories, {
  name: z.string().min(1, 'El nombre es requerido').max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido (formato: #RRGGBB)'),
  type: z.enum(['income', 'expense'], { message: 'El tipo es requerido' }),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
