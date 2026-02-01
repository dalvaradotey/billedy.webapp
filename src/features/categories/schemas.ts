import { z } from 'zod';

export const createCategorySchema = z.object({
  projectId: z.string().uuid('El proyecto es requerido'),
  name: z.string().min(1, 'El nombre es requerido').max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido (formato: #RRGGBB)'),
  isArchived: z.boolean().optional(),
});

export const updateCategorySchema = createCategorySchema.omit({ projectId: true }).partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
