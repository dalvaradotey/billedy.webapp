import { z } from 'zod';

export const createBudgetSchema = z.object({
  projectId: z.string().uuid('El proyecto es requerido'),
  name: z.string().min(1, 'El nombre es requerido').max(255),
  categoryId: z.string().uuid().optional().nullable(),
  defaultAmount: z.number({ message: 'Ingresa el monto' }).positive('El monto debe ser mayor a 0'),
  currency: z.string().length(3, 'Código de moneda inválido'),
});

export const updateBudgetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  defaultAmount: z.number({ message: 'Ingresa el monto' }).positive('El monto debe ser mayor a 0').optional(),
  currency: z.string().length(3).optional(),
  isActive: z.boolean().optional(),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
