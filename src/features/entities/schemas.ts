import { z } from 'zod';

export const entityTypeSchema = z.enum([
  'bank',
  'credit_card',
  'supermarket',
  'pharmacy',
  'store',
  'restaurant',
  'service',
  'utility',
  'government',
  'hardware_store',
  'mechanic',
  'streaming',
  'grocery_store',
  'other',
]);

export const createEntitySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(255),
  type: entityTypeSchema,
  imageUrl: z.string().url().optional(),
});

export const updateEntitySchema = createEntitySchema.partial();

export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
