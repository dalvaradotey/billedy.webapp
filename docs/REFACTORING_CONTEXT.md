# Contexto de Refactorización (para Claude)

> **IMPORTANTE**: Lee este archivo al inicio de cada sesión para mantener contexto.

## Estado Actual del Proyecto

Billedy es una app de finanzas personales en **Next.js 16** con App Router.

### Problema Principal
- 6 archivos `components.tsx` con >1000 líneas
- Código duplicado (~1500 líneas): `formatCurrency`, `formatDate`
- Patrón de loading inconsistente (algunos usan `isRefreshing` con refs, otros no)
- Sin estrategia de caché

## Plan de Refactorización (6 Sprints)

### Sprint 1: Fundamentos ✅ COMPLETADO
- [x] `src/lib/formatting.ts` - formatCurrency, formatDate, etc.
- [x] `src/hooks/use-dialog-state.ts` - estado de diálogos
- [x] `src/hooks/use-optimistic-action.ts` - useServerAction, useConfirmAction
- [x] `src/components/empty-state.tsx` - estado vacío consistente
- [x] `src/components/loading-button.tsx` - botón con loading
- [x] `src/components/page-skeleton.tsx` - skeletons reutilizables
- [x] `loading.tsx` en todas las rutas del dashboard (10 archivos)
- [x] `error.tsx` en dashboard
- [x] `not-found.tsx` global

### Sprint 2: Caché y Estado ✅ COMPLETADO
- [x] `src/lib/cache.ts` - sistema de cache tags con CACHE_TAGS y RELATED_TAGS
- [x] `cachedQuery()` wrapper sobre `unstable_cache`
- [x] `invalidateRelatedCache()` usa `updateTag()` de Next.js 16
- [x] Queries cacheadas: accounts, categories, budgets, savings
- [x] Actions actualizadas: 12 archivos migrados de `revalidatePath` a `updateTag`
- [x] Eliminado patrón `isRefreshing` con useRef (4 archivos simplificados)
- [~] `useOptimistic` diferido - la UX actual con toasts es suficiente

**Archivos simplificados (removido isRefreshing):**
- `src/features/transactions/components.tsx` ✅
- `src/features/savings/components.tsx` ✅
- `src/features/billing-cycles/components.tsx` ✅
- `src/features/credits/components.tsx` ✅
- `src/features/card-purchases/components.tsx` (ya usaba reload, sin cambios)

### Sprint 3-4: División de Archivos
Dividir en carpetas `components/` y `actions/`:
- transactions (2,461 líneas) - CRÍTICO
- card-purchases (1,147 líneas)
- savings (1,113 líneas)
- templates (1,079 líneas)
- credits (1,055 líneas)
- accounts (985 líneas)
- billing-cycles (801 líneas)

### Sprint 5: Polish
- Skeletons en todas las features
- Empty states consistentes
- UX móvil

### Sprint 6: Limpieza BD (POSPUESTA)
- Evaluar después de terminar refactorización

## Nuevos Archivos Creados

### Sprint 1
```
src/lib/formatting.ts
src/hooks/use-dialog-state.ts
src/hooks/use-optimistic-action.ts
src/hooks/index.ts
src/components/empty-state.tsx
src/components/loading-button.tsx
src/components/page-skeleton.tsx
src/app/(dashboard)/dashboard/loading.tsx
src/app/(dashboard)/dashboard/transactions/loading.tsx
src/app/(dashboard)/dashboard/accounts/loading.tsx
src/app/(dashboard)/dashboard/credits/loading.tsx
src/app/(dashboard)/dashboard/budgets/loading.tsx
src/app/(dashboard)/dashboard/savings/loading.tsx
src/app/(dashboard)/dashboard/categories/loading.tsx
src/app/(dashboard)/dashboard/templates/loading.tsx
src/app/(dashboard)/dashboard/card-purchases/loading.tsx
src/app/(dashboard)/dashboard/cycles/loading.tsx
src/app/(dashboard)/dashboard/error.tsx
src/app/not-found.tsx
```

### Sprint 2
```
src/lib/cache.ts - Sistema de caché centralizado
```

## Patrones a Seguir

### Loading Pattern (Next.js 16)
```typescript
// En page.tsx - Server Component carga datos
// En loading.tsx - Skeleton automático

// En componente cliente - useOptimistic para updates
const [optimisticItems, addOptimistic] = useOptimistic(items, (state, newItem) => [...state, newItem]);
```

### Cache Pattern
```typescript
// En queries.ts
import { cachedQuery, CACHE_TAGS } from '@/lib/cache';

export const getAccounts = cachedQuery(
  _getAccounts,
  ['accounts', 'list'],
  { tags: [CACHE_TAGS.accounts] }
);

// En actions.ts
import { invalidateRelatedCache } from '@/lib/cache';

export async function createAccount() {
  // ... crear cuenta
  invalidateRelatedCache('accounts'); // Invalida tags relacionados
}
```

### No usar Zustand ni TanStack Query
- Server Components cargan datos (no necesita client-side fetching)
- `useOptimistic` + `updateTag()` manejan updates
- `useState` suficiente para UI state

## Archivos de Documentación
- `docs/ROADMAP.md` - Plan detallado con checkboxes
- `docs/PATTERNS.md` - Patrones de código
- `docs/FEATURES_MAP.md` - Mapa de features
- `docs/ANALYSIS.md` - Análisis del codebase

## Convenciones
- Archivos: kebab-case (`transaction-form.tsx`)
- Componentes: PascalCase (`TransactionForm`)
- Mobile-first siempre
- Idioma español en UI y documentación
