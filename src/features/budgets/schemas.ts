import { z } from 'zod';

export const createBudgetSchema = z.object({
  projectId: z.string().uuid('El proyecto es requerido'),
  name: z.string().min(1, 'El nombre es requerido').max(255),
  categoryId: z.string().uuid().optional().nullable(),
  defaultAccountId: z.string().uuid().optional().nullable(),
  defaultAmount: z.number({ message: 'Ingresa el monto' }).positive('El monto debe ser mayor a 0'),
  currency: z.string().length(3, 'Código de moneda inválido'),
  startDate: z.date().optional().nullable(),
  endDate: z.date().optional().nullable(),
}).refine(
  (data) => {
    // Ambas deben estar presentes o ambas ausentes
    const hasStart = data.startDate != null;
    const hasEnd = data.endDate != null;
    return hasStart === hasEnd;
  },
  { message: 'Debes indicar tanto fecha de inicio como fecha de fin', path: ['endDate'] }
).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate >= data.startDate;
    }
    return true;
  },
  { message: 'La fecha de fin debe ser igual o posterior a la fecha de inicio', path: ['endDate'] }
);

export const updateBudgetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  defaultAccountId: z.string().uuid().optional().nullable(),
  defaultAmount: z.number({ message: 'Ingresa el monto' }).positive('El monto debe ser mayor a 0').optional(),
  currency: z.string().length(3).optional(),
  isActive: z.boolean().optional(),
  startDate: z.date().optional().nullable(),
  endDate: z.date().optional().nullable(),
}).refine(
  (data) => {
    // Solo validar si al menos una fecha fue proporcionada en el update
    const hasStart = data.startDate !== undefined;
    const hasEnd = data.endDate !== undefined;
    if (hasStart || hasEnd) {
      const startPresent = data.startDate != null;
      const endPresent = data.endDate != null;
      return startPresent === endPresent;
    }
    return true;
  },
  { message: 'Debes indicar tanto fecha de inicio como fecha de fin', path: ['endDate'] }
).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate >= data.startDate;
    }
    return true;
  },
  { message: 'La fecha de fin debe ser igual o posterior a la fecha de inicio', path: ['endDate'] }
);

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
