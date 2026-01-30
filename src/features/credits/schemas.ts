import { z } from 'zod';

export const createCreditSchema = z.object({
  projectId: z.string().uuid('El proyecto es requerido'),
  categoryId: z.string().uuid('La categoría es requerida'),
  name: z.string().min(1, 'El nombre es requerido').max(255),
  principalAmount: z.number().positive('El monto solicitado debe ser mayor a 0'),
  installmentAmount: z.number().positive('El valor de la cuota debe ser mayor a 0'),
  installments: z.number().int().min(1, 'Debe tener al menos 1 cuota').max(360, 'Máximo 360 cuotas'),
  paidInstallments: z.number().int().min(0, 'Las cuotas pagadas no pueden ser negativas').optional(),
  startDate: z.date({ message: 'La fecha de inicio es requerida' }),
  frequency: z.enum(['monthly', 'biweekly', 'weekly'], { message: 'La frecuencia es requerida' }),
  description: z.string().max(500).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateCreditSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(255).optional(),
  description: z.string().max(500).optional().nullable(),
  notes: z.string().optional().nullable(),
  isArchived: z.boolean().optional(),
});

export type CreateCreditInput = z.infer<typeof createCreditSchema>;
export type UpdateCreditInput = z.infer<typeof updateCreditSchema>;
