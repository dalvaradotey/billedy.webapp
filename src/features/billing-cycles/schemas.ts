import { z } from 'zod';

export const createBillingCycleSchema = z.object({
  projectId: z.string().uuid('El proyecto es requerido'),
  name: z.string().min(1, 'El nombre es requerido').max(255),
  startDate: z.date({ message: 'La fecha de inicio es requerida' }),
  endDate: z.date({ message: 'La fecha de fin es requerida' }),
  notes: z.string().max(1000).optional().nullable(),
}).refine((data) => data.endDate > data.startDate, {
  message: 'La fecha de fin debe ser posterior a la fecha de inicio',
  path: ['endDate'],
});

export const updateBillingCycleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export const closeBillingCycleSchema = z.object({
  endDate: z.date().optional(),
});

export type CreateBillingCycleInput = z.infer<typeof createBillingCycleSchema>;
export type UpdateBillingCycleInput = z.infer<typeof updateBillingCycleSchema>;
export type CloseBillingCycleInput = z.infer<typeof closeBillingCycleSchema>;
