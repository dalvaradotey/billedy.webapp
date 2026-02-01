import type { InferSelectModel } from 'drizzle-orm';
import type { entities } from '@/lib/db/schema';

export type Entity = InferSelectModel<typeof entities>;

export type EntityType =
  | 'bank'
  | 'credit_card'
  | 'supermarket'
  | 'pharmacy'
  | 'store'
  | 'restaurant'
  | 'service'
  | 'utility'
  | 'government'
  | 'hardware_store'
  | 'mechanic'
  | 'streaming'
  | 'grocery_store'
  | 'other';

export const entityTypeLabels: Record<EntityType, string> = {
  bank: 'Banco',
  credit_card: 'Tarjeta de crédito',
  supermarket: 'Supermercado',
  pharmacy: 'Farmacia',
  store: 'Tienda',
  restaurant: 'Restaurante',
  service: 'Servicio',
  utility: 'Servicio básico',
  government: 'Gobierno',
  hardware_store: 'Ferretería',
  mechanic: 'Taller mecánico',
  streaming: 'Streaming',
  grocery_store: 'Frutería/Verdulería',
  other: 'Otro',
};
