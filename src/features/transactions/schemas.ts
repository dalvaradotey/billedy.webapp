import { z } from 'zod';

export const createTransactionSchema = z.object({
  projectId: z.string().uuid('El proyecto es requerido'),
  categoryId: z.string().uuid('La categoría es requerida'),
  accountId: z.string().uuid('La cuenta es requerida'),
  entityId: z.string().uuid().optional().nullable(),
  budgetId: z.string().uuid().optional().nullable(),
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

// Schema para transferencias entre cuentas
// Nota: entityId se hereda automáticamente de las cuentas origen y destino
export const createAccountTransferSchema = z.object({
  projectId: z.string().uuid('El proyecto es requerido'),
  fromAccountId: z.string().uuid('La cuenta origen es requerida'),
  toAccountId: z.string().uuid('La cuenta destino es requerida'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  date: z.date({ message: 'La fecha es requerida' }),
  description: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
}).refine((data) => data.fromAccountId !== data.toAccountId, {
  message: 'La cuenta origen y destino deben ser diferentes',
  path: ['toAccountId'],
});

export const updateAccountTransferSchema = z.object({
  amount: z.number().positive('El monto debe ser mayor a 0').optional(),
  date: z.date().optional(),
  description: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export type CreateAccountTransferInput = z.infer<typeof createAccountTransferSchema>;
export type UpdateAccountTransferInput = z.infer<typeof updateAccountTransferSchema>;
