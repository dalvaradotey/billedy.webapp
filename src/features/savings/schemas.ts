import { z } from 'zod';

// ============================================================================
// SAVINGS FUNDS
// ============================================================================

export const createSavingsFundSchema = z.object({
  projectId: z.string().uuid('El proyecto es requerido').optional(),
  name: z.string().min(1, 'El nombre es requerido').max(255),
  type: z.enum(['emergency', 'investment', 'goal', 'other'], {
    message: 'Tipo de fondo requerido',
  }),
  accountType: z.string().min(1, 'El tipo de cuenta es requerido').max(100),
  currencyId: z.string().uuid('La moneda es requerida'),
  targetAmount: z.number().positive('La meta debe ser mayor a 0').optional().nullable(),
  monthlyTarget: z.number().positive('La meta mensual debe ser mayor a 0'),
  currentBalance: z.number().min(0, 'El balance no puede ser negativo').optional(),
});

export const updateSavingsFundSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(255).optional(),
  type: z.enum(['emergency', 'investment', 'goal', 'other']).optional(),
  accountType: z.string().min(1).max(100).optional(),
  targetAmount: z.number().positive().optional().nullable(),
  monthlyTarget: z.number().positive().optional(),
  isArchived: z.boolean().optional(),
});

export type CreateSavingsFundInput = z.infer<typeof createSavingsFundSchema>;
export type UpdateSavingsFundInput = z.infer<typeof updateSavingsFundSchema>;

// ============================================================================
// SAVINGS MOVEMENTS
// ============================================================================

export const createMovementSchema = z.object({
  savingsFundId: z.string().uuid('El fondo de ahorro es requerido'),
  type: z.enum(['deposit', 'withdrawal'], { message: 'Tipo de movimiento requerido' }),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  date: z.date({ message: 'La fecha es requerida' }),
  description: z.string().max(500).optional().nullable(),
});

export const updateMovementSchema = z.object({
  type: z.enum(['deposit', 'withdrawal']).optional(),
  amount: z.number().positive().optional(),
  date: z.date().optional(),
  description: z.string().max(500).optional().nullable(),
});

export type CreateMovementInput = z.infer<typeof createMovementSchema>;
export type UpdateMovementInput = z.infer<typeof updateMovementSchema>;
