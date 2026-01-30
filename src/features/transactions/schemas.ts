import { z } from 'zod';

export const createTransactionSchema = z.object({
  projectId: z.string().uuid('El proyecto es requerido'),
  categoryId: z.string().uuid('La categoría es requerida'),
  accountId: z.string().uuid().optional().nullable(),
  type: z.enum(['income', 'expense'], { message: 'El tipo es requerido' }),
  originalAmount: z.number().positive('El monto debe ser mayor a 0'),
  date: z.date({ message: 'La fecha es requerida' }),
  description: z.string().min(1, 'La descripción es requerida').max(500),
  notes: z.string().max(1000).optional().nullable(),
  isPaid: z.boolean().optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const togglePaidSchema = z.object({
  isPaid: z.boolean(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TogglePaidInput = z.infer<typeof togglePaidSchema>;
