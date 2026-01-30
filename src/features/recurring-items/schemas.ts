import { z } from 'zod';

export const createRecurringItemSchema = z.object({
  projectId: z.string().uuid('El proyecto es requerido'),
  categoryId: z.string().uuid('La categoría es requerida'),
  accountId: z.string().uuid().optional().nullable(),
  type: z.enum(['income', 'expense'], { message: 'El tipo es requerido' }),
  name: z.string().min(1, 'El nombre es requerido').max(255),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateRecurringItemSchema = createRecurringItemSchema.partial();

export const toggleActiveSchema = z.object({
  isActive: z.boolean(),
});

export type CreateRecurringItemInput = z.infer<typeof createRecurringItemSchema>;
export type UpdateRecurringItemInput = z.infer<typeof updateRecurringItemSchema>;
export type ToggleActiveInput = z.infer<typeof toggleActiveSchema>;
