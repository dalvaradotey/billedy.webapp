import { z } from 'zod';

export const createBudgetSchema = z.object({
  projectId: z.string().uuid('El proyecto es requerido'),
  categoryId: z.string().uuid('La categoría es requerida'),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  amount: z.number().positive('El monto debe ser mayor a 0'),
});

export const updateBudgetSchema = z.object({
  amount: z.number().positive('El monto debe ser mayor a 0'),
});

export const upsertBudgetSchema = createBudgetSchema;

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type UpsertBudgetInput = z.infer<typeof upsertBudgetSchema>;
