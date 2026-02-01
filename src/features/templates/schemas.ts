import { z } from 'zod';

export const createTemplateSchema = z.object({
  userId: z.string().uuid('El usuario es requerido'),
  projectId: z.string().uuid('El proyecto es requerido'),
  name: z.string().min(1, 'El nombre es requerido').max(255),
  description: z.string().max(500).optional().nullable(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const createTemplateItemSchema = z.object({
  templateId: z.string().uuid('La plantilla es requerida'),
  userId: z.string().uuid('El usuario es requerido'),
  projectId: z.string().uuid('El proyecto es requerido'),
  categoryId: z.string().uuid('La categoría es requerida'),
  accountId: z.string().uuid().optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  type: z.enum(['income', 'expense'], { message: 'El tipo es requerido' }),
  description: z.string().min(1, 'La descripción es requerida').max(500),
  originalAmount: z.number().positive('El monto debe ser mayor a 0'),
  originalCurrency: z.string().length(3, 'Moneda inválida'),
  baseAmount: z.number().positive('El monto base debe ser mayor a 0'),
  baseCurrency: z.string().length(3, 'Moneda base inválida'),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateTemplateItemSchema = z.object({
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  description: z.string().min(1).max(500).optional(),
  originalAmount: z.number().positive().optional(),
  originalCurrency: z.string().length(3).optional(),
  baseAmount: z.number().positive().optional(),
  baseCurrency: z.string().length(3).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type CreateTemplateItemInput = z.infer<typeof createTemplateItemSchema>;
export type UpdateTemplateItemInput = z.infer<typeof updateTemplateItemSchema>;
