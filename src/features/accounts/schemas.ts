import { z } from 'zod';

export const accountTypeSchema = z.enum(['checking', 'savings', 'cash', 'credit_card']);

export const createAccountSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(255),
  type: accountTypeSchema,
  bankName: z.string().max(255).optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  currency: z.string().length(3, 'Código de moneda inválido'),
  initialBalance: z.number(),
  creditLimit: z.number().optional().nullable(), // Solo para tarjetas de crédito
  isDefault: z.boolean(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(255).optional(),
  type: accountTypeSchema.optional(),
  bankName: z.string().max(255).optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  currency: z.string().length(3).optional(),
  initialBalance: z.number().optional(),
  creditLimit: z.number().optional().nullable(),
  isDefault: z.boolean().optional(),
});

export const adjustBalanceSchema = z.object({
  newBalance: z.number(),
  reason: z.string().max(500).optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type AdjustBalanceInput = z.infer<typeof adjustBalanceSchema>;
