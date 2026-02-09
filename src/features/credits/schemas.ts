import { z } from 'zod';

export const createCreditSchema = z.object({
  projectId: z.string().uuid('El proyecto es requerido'),
  categoryId: z.string().uuid('La categoría es requerida'),
  entityId: z.string().uuid().optional().nullable(),
  accountId: z.string().uuid('La cuenta es requerida'),
  name: z.string().min(1, 'El nombre es requerido').max(255),
  principalAmount: z.number({ message: 'Ingresa el monto' }).positive('El monto solicitado debe ser mayor a 0'),
  installmentAmount: z.number({ message: 'Ingresa el valor de la cuota' }).positive('El valor de la cuota debe ser mayor a 0'),
  installments: z.number({ message: 'Ingresa el número de cuotas' }).int().min(1, 'Debe tener al menos 1 cuota').max(60, 'Máximo 60 cuotas'),
  paidInstallments: z.number().int().min(0, 'Las cuotas pagadas no pueden ser negativas').optional(),
  startDate: z.date({ message: 'La fecha de inicio es requerida' }),
  frequency: z.enum(['monthly', 'biweekly', 'weekly'], { message: 'La frecuencia es requerida' }),
  description: z.string().max(500).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateCreditSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(255).optional(),
  entityId: z.string().uuid().optional().nullable(),
  accountId: z.string().uuid().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  notes: z.string().optional().nullable(),
  isArchived: z.boolean().optional(),
});

export type CreateCreditInput = z.infer<typeof createCreditSchema>;
export type UpdateCreditInput = z.infer<typeof updateCreditSchema>;
