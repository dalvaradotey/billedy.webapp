import { z } from 'zod';

// ============================================================================
// SAVINGS GOALS
// ============================================================================

export const createSavingsGoalSchema = z.object({
  projectId: z.string().uuid('El proyecto es requerido').optional(),
  name: z.string().min(1, 'El nombre es requerido').max(255),
  type: z.enum(['emergency', 'investment', 'goal', 'other'], {
    message: 'Tipo de meta requerido',
  }),
  currencyId: z.string().uuid('La moneda es requerida'),
  targetAmount: z.number({ message: 'Ingresa la meta' }).positive('La meta debe ser mayor a 0'),
  initialBalance: z.number().min(0, 'El balance no puede ser negativo').optional(),
});

export const updateSavingsGoalSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(255).optional(),
  type: z.enum(['emergency', 'investment', 'goal', 'other']).optional(),
  targetAmount: z.number().positive().optional(),
  isCompleted: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export type CreateSavingsGoalInput = z.infer<typeof createSavingsGoalSchema>;
export type UpdateSavingsGoalInput = z.infer<typeof updateSavingsGoalSchema>;
