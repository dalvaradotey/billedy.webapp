/**
 * Configuración de caché para Next.js 16
 *
 * Este módulo centraliza la gestión de cache tags para revalidación.
 * Usa unstable_cache para cachear queries y revalidateTag para invalidar.
 *
 * @example
 * ```ts
 * // En queries.ts - Cachear datos
 * import { cachedQuery, CACHE_TAGS } from '@/lib/cache';
 *
 * export const getTransactions = cachedQuery(
 *   async (projectId: string) => {
 *     return db.query.transactions.findMany(...);
 *   },
 *   ['transactions'],
 *   { tags: [CACHE_TAGS.transactions], revalidate: 60 }
 * );
 *
 * // En actions.ts - Invalidar caché
 * import { invalidateCache, CACHE_TAGS } from '@/lib/cache';
 *
 * export async function createTransaction(data) {
 *   await db.insert(transactions).values(data);
 *   invalidateCache(CACHE_TAGS.transactions);
 * }
 * ```
 */

import { unstable_cache, updateTag } from 'next/cache';

/**
 * Tags de caché por feature
 * Usar estos tags para mantener consistencia
 */
export const CACHE_TAGS = {
  // Core features
  transactions: 'transactions',
  accounts: 'accounts',
  credits: 'credits',
  budgets: 'budgets',
  savings: 'savings',
  categories: 'categories',
  templates: 'templates',
  cardPurchases: 'card-purchases',
  billingCycles: 'billing-cycles',

  // Entities y proyectos
  entities: 'entities',
  projects: 'projects',

  // Dashboard y resumen
  dashboard: 'dashboard',
  summary: 'summary',
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * Tiempo de revalidación por defecto (en segundos)
 */
export const DEFAULT_REVALIDATE = 60; // 1 minuto

/**
 * Wrapper sobre unstable_cache con tipado mejorado
 *
 * @param fn - Función async a cachear
 * @param keyParts - Partes de la key de caché
 * @param options - Opciones de caché (tags, revalidate)
 */
export function cachedQuery<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyParts: string[],
  options: {
    tags: CacheTag[];
    revalidate?: number;
  }
): (...args: TArgs) => Promise<TResult> {
  return unstable_cache(fn, keyParts, {
    tags: options.tags,
    revalidate: options.revalidate ?? DEFAULT_REVALIDATE,
  }) as (...args: TArgs) => Promise<TResult>;
}

/**
 * Invalida uno o más cache tags
 * Usar en Server Actions después de mutaciones
 *
 * @param tags - Tag(s) a invalidar
 */
export function invalidateCache(...tags: CacheTag[]): void {
  for (const tag of tags) {
    updateTag(tag);
  }
}

/**
 * Tags relacionados por feature
 * Útil cuando una mutación afecta múltiples features
 */
export const RELATED_TAGS = {
  // Transacciones afectan: dashboard, accounts (balances), budgets
  transactions: [
    CACHE_TAGS.transactions,
    CACHE_TAGS.dashboard,
    CACHE_TAGS.accounts,
    CACHE_TAGS.summary,
  ],

  // Cuentas afectan: dashboard, transactions (para selects)
  accounts: [CACHE_TAGS.accounts, CACHE_TAGS.dashboard, CACHE_TAGS.summary],

  // Créditos afectan: dashboard, transactions (cuotas)
  credits: [
    CACHE_TAGS.credits,
    CACHE_TAGS.dashboard,
    CACHE_TAGS.transactions,
    CACHE_TAGS.summary,
  ],

  // Fondos de ahorro afectan: dashboard
  savings: [CACHE_TAGS.savings, CACHE_TAGS.dashboard, CACHE_TAGS.summary],

  // Presupuestos afectan: dashboard, transactions (para selects)
  budgets: [
    CACHE_TAGS.budgets,
    CACHE_TAGS.dashboard,
    CACHE_TAGS.transactions,
    CACHE_TAGS.summary,
  ],

  // Categorías afectan: transactions, credits, budgets (para selects)
  categories: [
    CACHE_TAGS.categories,
    CACHE_TAGS.transactions,
    CACHE_TAGS.credits,
    CACHE_TAGS.budgets,
  ],

  // Plantillas son independientes
  templates: [CACHE_TAGS.templates],

  // Compras en cuotas afectan: transactions (cuotas), billing cycles
  cardPurchases: [
    CACHE_TAGS.cardPurchases,
    CACHE_TAGS.transactions,
    CACHE_TAGS.billingCycles,
    CACHE_TAGS.dashboard,
  ],

  // Ciclos de facturación afectan: card purchases
  billingCycles: [CACHE_TAGS.billingCycles, CACHE_TAGS.cardPurchases],

  // Entidades son bastante independientes
  entities: [CACHE_TAGS.entities, CACHE_TAGS.accounts],

  // Proyectos afectan todo
  projects: [CACHE_TAGS.projects, CACHE_TAGS.dashboard],
} as const;

/**
 * Invalida todos los tags relacionados con una feature
 *
 * @param feature - Nombre de la feature
 */
export function invalidateRelatedCache(
  feature: keyof typeof RELATED_TAGS
): void {
  const tags = RELATED_TAGS[feature];
  invalidateCache(...tags);
}
