/**
 * Schemas Zod generados desde Drizzle
 *
 * drizzle-zod genera schemas automáticamente desde las tablas,
 * evitando duplicar definiciones.
 *
 * Uso:
 * - createInsertSchema: para validar datos al crear
 * - createSelectSchema: para validar datos al leer
 * - createUpdateSchema: para validar datos al actualizar (campos opcionales)
 */

import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { projects, categories, transactions } from './schema';
import { z } from 'zod';

// ============================================================================
// PROJECTS
// ============================================================================

export const insertProjectSchema = createInsertSchema(projects, {
  // Puedes sobrescribir validaciones específicas
  name: z.string().min(1, 'El nombre es requerido').max(255),
});

export const selectProjectSchema = createSelectSchema(projects);

// Schema para actualizar (todos los campos opcionales excepto id)
export const updateProjectSchema = insertProjectSchema.partial().required({ id: true });

// ============================================================================
// CATEGORIES
// ============================================================================

export const insertCategorySchema = createInsertSchema(categories, {
  name: z.string().min(1, 'El nombre es requerido').max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido (formato: #RRGGBB)'),
});

export const selectCategorySchema = createSelectSchema(categories);

// ============================================================================
// TRANSACTIONS
// ============================================================================

export const insertTransactionSchema = createInsertSchema(transactions, {
  description: z.string().min(1, 'La descripción es requerida').max(500),
  originalAmount: z.string().refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'El monto debe ser mayor a 0'
  ),
});

export const selectTransactionSchema = createSelectSchema(transactions);

// ============================================================================
// TIPOS INFERIDOS
// ============================================================================

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type SelectProject = z.infer<typeof selectProjectSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type SelectCategory = z.infer<typeof selectCategorySchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type SelectTransaction = z.infer<typeof selectTransactionSchema>;
