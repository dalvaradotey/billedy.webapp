import { z } from 'zod';

export const createCardPurchaseSchema = z.object({
  userId: z.string().uuid('El usuario es requerido'),
  projectId: z.string().uuid('El proyecto es requerido'),
  accountId: z.string().uuid('La tarjeta de crédito es requerida'),
  categoryId: z.string().uuid('La categoría es requerida'),
  entityId: z.string().uuid().optional().nullable(),

  description: z.string().min(1, 'La descripción es requerida').max(500),
  storeName: z.string().max(255).optional().nullable(), // Alternative to entityId - user can use one or the other
  purchaseDate: z.date({ message: 'La fecha de compra es requerida' }),

  originalAmount: z.number().positive('El monto original debe ser mayor a 0'),
  interestRate: z.number().min(0).max(100).optional().nullable(),
  installments: z.number().int().min(1, 'Mínimo 1 cuota').max(60, 'Máximo 60 cuotas'),

  firstChargeDate: z.date({ message: 'La fecha de primer cargo es requerida' }),
  chargedInstallments: z.number().int().min(0).optional().default(0),

  isExternalDebt: z.boolean().optional().default(false), // Deuda externa (familiares, etc.)
  notes: z.string().max(1000).optional().nullable(),
});

export const updateCardPurchaseSchema = z.object({
  categoryId: z.string().uuid().optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  description: z.string().min(1).max(500).optional(),
  storeName: z.string().max(255).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CreateCardPurchaseInput = z.infer<typeof createCardPurchaseSchema>;
export type UpdateCardPurchaseInput = z.infer<typeof updateCardPurchaseSchema>;
