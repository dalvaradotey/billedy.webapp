---
title: Roadmap - Plan de Refactorización
description: Plan de refactorización y mejoras para Billedy
version: 2.0.0
created: 2025-01-28
updated: 2026-02-03
author: Claude Code
tags: [roadmap, refactoring, mejoras]
---

# Billedy - Plan de Refactorización

## Resumen Ejecutivo

Este documento define el plan de refactorización para mejorar la calidad del código, rendimiento y experiencia de usuario de Billedy.

### Áreas de Mejora Identificadas

| Área | Problema | Estado |
|------|----------|--------|
| **Archivos grandes** | 8 archivos > 500 líneas | ✅ Completado (todos divididos en carpetas) |
| **Código duplicado** | ~1500 líneas duplicadas | ✅ Reducido (~300 líneas restantes) |
| **Loading states** | Patrón inconsistente | 🔄 En progreso |
| **Caché** | Sin estrategia definida | ✅ `lib/cache.ts` implementado |
| **BD** | 15 campos no usados | ⏳ Pospuesto |

---

## Fase 1: Arquitectura de Loading y Estado

### 1.1 Patrón de Loading Recomendado

Basado en [documentación oficial de Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/loading) y [mejores prácticas 2026](https://dev.to/boopykiki/a-complete-nextjs-streaming-guide-loadingtsx-suspense-and-performance-9g9):

#### Carga Inicial (SSR)
- **Usar `loading.tsx`** para cada ruta del dashboard
- Next.js automáticamente wrappea en `<Suspense>`
- El skeleton se muestra mientras se cargan los datos del servidor

```
src/app/(dashboard)/dashboard/transactions/
├── page.tsx        # Server Component - carga datos
├── loading.tsx     # Skeleton automático durante SSR
└── error.tsx       # Manejo de errores
```

#### Actualizaciones Post-Mutación
- **Usar `useOptimistic`** de React para updates inmediatos
- **Usar `updateTag()`** de Next.js 16 para invalidar caché
- **NO usar** `isRefreshing` con refs (patrón actual - eliminar)

```typescript
// Patrón correcto Next.js 16
'use client';
import { useOptimistic } from 'react';
import { updateTag } from 'next/cache';

function TransactionList({ transactions }) {
  const [optimisticTxns, addOptimistic] = useOptimistic(
    transactions,
    (state, newTxn) => [...state, newTxn]
  );

  async function handleCreate(data) {
    addOptimistic(data); // UI se actualiza inmediatamente
    await createTransaction(data); // Server Action
    // updateTag() en el server action invalida el caché
  }
}
```

#### Tareas
- [ ] Crear `loading.tsx` en cada ruta del dashboard
- [ ] Implementar `useOptimistic` para mutaciones
- [ ] Migrar de `isRefreshing` pattern a `useOptimistic`
- [ ] Agregar `error.tsx` en rutas críticas
- [ ] Agregar `not-found.tsx` global

### 1.2 Estado y Caché

Basado en [análisis de state management 2026](https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns):

#### Decisión: NO usar Zustand ni TanStack Query

**Razón**: Con Server Components de Next.js 16:
- Los datos se cargan en el servidor (no necesitamos client-side fetching)
- `useOptimistic` maneja updates optimistas
- `updateTag()` y `revalidateTag()` manejan invalidación de caché
- El estado local (`useState`) es suficiente para UI state

**Zustand sería útil SOLO si**:
- Necesitáramos estado global complejo entre componentes no relacionados
- Tuviéramos preferencias de usuario que persisten entre páginas

**TanStack Query sería útil SOLO si**:
- Consumiéramos APIs externas desde el cliente
- Necesitáramos polling o real-time updates

#### Estrategia de Caché Next.js 16

Usar las nuevas APIs de [Next.js 16](https://nextjs.org/blog/next-16):

```typescript
// En queries.ts - Cachear datos con tags
import { unstable_cache } from 'next/cache';

export const getTransactions = unstable_cache(
  async (projectId: string) => {
    return db.query.transactions.findMany({
      where: eq(transactions.projectId, projectId),
    });
  },
  ['transactions'],
  { tags: ['transactions'], revalidate: 60 }
);

// En actions.ts - Invalidar caché
import { updateTag } from 'next/cache';

export async function createTransaction(data) {
  await db.insert(transactions).values(data);
  updateTag('transactions'); // Invalida inmediatamente
}
```

#### Tareas
- [ ] Implementar `unstable_cache` en queries principales
- [ ] Usar `updateTag()` en todas las Server Actions
- [ ] Definir tags por feature (transactions, credits, budgets, etc.)
- [ ] Eliminar lógica de `isRefreshing` y `useRef` para tracking

---

## Fase 2: Limpieza de Base de Datos (POSPUESTA)

> **NOTA**: Esta fase se ejecutará DESPUÉS de completar la refactorización del código.
> Los cambios de BD se evaluarán cuando todo esté funcionando correctamente.

<details>
<summary>Ver análisis de campos (referencia futura)</summary>

### Campos a Eliminar

| Tabla | Campo | Razón |
|-------|-------|-------|
| `currencies` | `decimalSeparator` | Nunca se lee, hardcodeado en frontend |
| `currencies` | `thousandsSeparator` | Nunca se lee, hardcodeado en frontend |
| `currencies` | `decimalPlaces` | Nunca se lee, hardcodeado en frontend |
| `entities` | `createdBy` | Se escribe pero nunca se lee |
| `project_members` | `invitedBy` | Feature de invitaciones no implementada |
| `project_members` | `invitedAt` | Feature de invitaciones no implementada |
| `projects` | `maxInstallmentAmount` | Se define pero nunca se valida |

### Campos Redundantes a Consolidar

| Tabla | Campos | Acción |
|-------|--------|--------|
| `projects` | `currency` + `baseCurrencyId` | Eliminar `currency`, usar solo FK |
| `transactions` | `originalCurrency` + `originalCurrencyId` | Eliminar string, usar solo FK |
| `transactions` | `baseCurrency` + `baseCurrencyId` | Eliminar string, usar solo FK |
| `credits` | Misma redundancia | Eliminar strings de moneda |

### Campos a Revisar/Implementar

| Tabla | Campo | Estado |
|-------|-------|--------|
| `transactions.paidAt` | Definido pero nunca se actualiza | Implementar o eliminar |
| `transactions.linkedTransactionId` | Para transferencias, sin FK formal | Agregar FK o documentar |
| `transactions.paidByTransferId` | Sin uso actual | Implementar o eliminar |
| `savingsFunds.accountType` | String libre, debería ser enum | Convertir a enum |

</details>

---

## Fase 3: División de Archivos

### 3.1 Prioridad CRÍTICA (> 1000 líneas)

#### ✅ transactions/ - COMPLETADO
```
src/features/transactions/
├── components/                     # ✅ Dividido (10+ archivos)
│   ├── index.ts
│   ├── transaction-list.tsx
│   ├── transaction-form.tsx
│   ├── transaction-table.tsx
│   ├── summary-card.tsx
│   ├── transfer-form.tsx
│   ├── confirmation-dialogs.tsx
│   ├── pay-credit-card-dialog.tsx
│   └── bulk-pay-cc-dialog.tsx
├── actions/                        # ✅ Dividido (4 archivos)
│   ├── index.ts
│   ├── transaction-crud.ts         # CRUD + verifyProjectAccess
│   ├── transfer-actions.ts         # Transferencias
│   └── credit-card-actions.ts      # Pagos TC
└── ...
```

#### ✅ card-purchases/ - COMPLETADO
```
src/features/card-purchases/
├── components/                     # ✅ Dividido (5 archivos)
│   ├── index.ts
│   ├── summary-cards.tsx
│   ├── debt-capacity-card.tsx
│   ├── card-purchase-card.tsx
│   ├── create-purchase-dialog.tsx
│   └── card-purchases-list.tsx
├── actions/                        # ✅ Dividido (3 archivos)
│   ├── index.ts
│   ├── purchase-crud.ts            # CRUD de compras
│   └── installment-actions.ts      # Operaciones de cuotas
└── ...
```

#### ✅ savings/ - COMPLETADO
```
src/features/savings/
├── components/                     # ✅ Dividido (7 archivos)
│   ├── index.ts
│   ├── constants.tsx
│   ├── movement-row.tsx
│   ├── movement-dialog.tsx
│   ├── savings-fund-dialog.tsx
│   ├── savings-fund-card.tsx
│   └── savings-list.tsx
└── actions.ts                      # Sin cambios
```

#### ✅ templates/ - COMPLETADO
```
src/features/templates/
├── components/                     # ✅ Dividido (6 archivos)
│   ├── index.ts
│   ├── constants.ts
│   ├── template-list.tsx
│   ├── template-card.tsx
│   ├── template-item-row.tsx
│   ├── template-dialog.tsx
│   └── template-item-dialog.tsx
└── actions.ts                      # Sin cambios
```

#### ✅ credits/ - COMPLETADO
```
src/features/credits/
├── components/                     # ✅ Dividido (7 archivos)
│   ├── index.ts
│   ├── constants.ts
│   ├── utils.ts
│   ├── summary-card.tsx
│   ├── credit-card-skeleton.tsx
│   ├── credit-card.tsx
│   ├── credit-dialog.tsx
│   └── credit-list.tsx
└── actions.ts                      # Sin cambios
```

#### ✅ accounts/ - COMPLETADO
```
src/features/accounts/
├── components/                     # ✅ Dividido (7 archivos)
│   ├── index.ts
│   ├── account-type-icon.tsx
│   ├── recalculate-button.tsx
│   ├── summary-card.tsx
│   ├── account-card-skeleton.tsx
│   ├── account-card.tsx
│   ├── account-dialog.tsx
│   └── accounts-list.tsx
└── actions.ts                      # Sin cambios
```

#### ✅ billing-cycles/ - COMPLETADO
```
src/features/billing-cycles/
├── components/                     # ✅ Dividido (6 archivos)
│   ├── index.ts
│   ├── utils.ts
│   ├── summary-card.tsx
│   ├── billing-cycle-card-skeleton.tsx
│   ├── billing-cycle-card.tsx
│   ├── billing-cycle-dialog.tsx
│   └── billing-cycles-list.tsx
├── actions/                        # ✅ Dividido (5 archivos)
│   ├── index.ts
│   ├── utils.ts                    # Helpers compartidos
│   ├── cycle-transactions.ts       # Carga de transacciones
│   ├── billing-cycle-crud.ts       # CRUD de ciclos
│   └── billing-cycle-status.ts     # Cerrar/reabrir ciclos
└── ...
```

### 3.2 Prioridad ALTA (500-1000 líneas) ✅ COMPLETADO
- [x] `billing-cycles/actions.ts` (592 líneas) → carpeta con 5 archivos
- [x] `card-purchases/actions.ts` (564 líneas) → carpeta con 3 archivos

---

## Fase 4: Utilidades Globales

### 4.1 Crear src/lib/formatting.ts

Eliminar duplicación de `formatCurrency` (8 archivos) y `formatDate` (5 archivos):

```typescript
// src/lib/formatting.ts
export function formatCurrency(amount: number | string, currency = 'CLP'): string
export function formatDate(date: Date | string | null): string
export function formatDateLong(date: Date | string | null): string
export function parseCurrencyToNumber(value: string): number
```

### 4.2 Crear src/hooks/

```
src/hooks/
├── index.ts
├── use-dialog-state.ts      # Estado de diálogos (reemplaza ~40 implementaciones)
├── use-optimistic-action.ts # Wrapper sobre useOptimistic + Server Action
└── use-confirm.ts           # Confirmaciones con callback
```

### 4.3 Tareas
- [ ] Crear `src/lib/formatting.ts`
- [ ] Crear hooks globales
- [ ] Migrar features a usar utilidades globales
- [ ] Eliminar código duplicado

---

## Fase 5: Componentes Estandarizados

### 5.1 Componentes de UI

| Componente | Propósito | Uso |
|------------|-----------|-----|
| `EmptyState` | Estado vacío consistente | Todas las listas |
| `LoadingButton` | Botón con estado de carga | Todos los forms |
| `FormDialog` | Dialog con form integrado | ~50 diálogos |
| `ConfirmDialog` | Confirmación de acciones | Eliminaciones |
| `DataCard` | Card de estadística | Dashboards |

### 5.2 Skeletons por Feature ✅ COMPLETADO

Cada feature con lista compleja tiene su skeleton en `components/`:

- [x] `TransactionTableSkeleton`
- [x] `AccountCardSkeleton`
- [x] `CreditCardSkeleton`
- [x] `SavingsFundCardSkeleton`
- [x] `TemplateCardSkeleton`
- [x] `CardPurchaseCardSkeleton`
- [x] `BillingCycleCardSkeleton`
- [~] `BudgetsSkeleton` (no requerido - lista simple)

---

## Fase 6: Mejoras de UX

### 6.1 Patrones de Feedback ✅ COMPLETADO

Usar `lib/toast-messages.ts` para mensajes consistentes:

```typescript
import { toastActions } from '@/lib/toast-messages';

// Ejemplo de uso
const { onSuccess, onError } = toastActions.deleting('categoría');
const result = await deleteCategory(id, userId);
result.success ? onSuccess() : onError(result.error);
```

Acciones disponibles: `creating`, `updating`, `deleting`, `archiving`, `restoring`, `processing`

### 6.2 Empty States Consistentes ✅ COMPLETADO

Todas las features usan el componente `EmptyState` de `@/components/empty-state`:
- card-purchases, credits, savings, templates, accounts
- billing-cycles, transactions, budgets, categories

### 6.3 Mobile-First
- [ ] Revisar touch targets (mínimo 44px)
- [ ] Optimizar formularios largos (steps/wizard)
- [ ] Mejorar navegación móvil

---

## Orden de Ejecución

### Sprint 1: Fundamentos ✅ COMPLETADO
1. [x] Crear `src/lib/formatting.ts`
2. [x] Crear hooks globales (`use-dialog-state`, `use-optimistic-action`)
3. [x] Crear componentes base (`EmptyState`, `LoadingButton`)
4. [ ] Agregar `loading.tsx` y `error.tsx` en rutas

### Sprint 2: Caché y Estado ✅ COMPLETADO
5. [x] Implementar `src/lib/cache.ts` con `invalidateRelatedCache`
6. [x] Definir tags por feature (transactions, credits, budgets, etc.)
7. [ ] Eliminar patrón `isRefreshing` (en progreso)
8. [ ] Implementar `useOptimistic` en forms principales

### Sprint 3: División de Código (Crítico) ✅ COMPLETADO
9. [x] Dividir `transactions/components` → carpeta con 10+ archivos
10. [x] Dividir `transactions/actions` → carpeta con 4 archivos (ver patrón abajo)
11. [x] Mejorar `ConfirmDialog` para soportar modo controlado
12. [x] Dividir `card-purchases` → carpeta con 5 archivos
13. [x] Dividir `savings` → carpeta con 7 archivos
14. [x] Dividir `templates` → carpeta con 6 archivos
15. [x] Dividir `credits` → carpeta con 7 archivos

### Sprint 4: División de Código (Alta) ✅ COMPLETADO
16. [x] Dividir `accounts` → carpeta con 7 archivos
17. [x] Dividir `billing-cycles/components` → carpeta con 6 archivos
18. [x] Dividir `billing-cycles/actions` → carpeta con 5 archivos
19. [x] Dividir `card-purchases/actions` → carpeta con 3 archivos

### Sprint 5: Polish 🔄 EN PROGRESO
20. [x] Agregar skeletons faltantes (CardPurchaseCardSkeleton, TemplateCardSkeleton)
21. [x] Estandarizar empty states (9 features migradas a EmptyState)
22. [ ] Revisar UX móvil
23. [x] Estandarizar mensajes de toast (lib/toast-messages.ts + migraciones)
24. [ ] Testing y documentación

### Sprint 6: Limpieza BD (POST-REFACTORIZACIÓN)
23. [ ] Evaluar campos a eliminar
24. [ ] Crear migraciones necesarias
25. [ ] Actualizar seeds y queries

---

## Patrones Establecidos

### Patrón de División de Actions

Cuando `actions.ts` supera ~500 líneas, dividir en carpeta agrupando por responsabilidad:

```
features/[feature]/actions/
├── index.ts               # Barrel exports (re-exporta todo)
├── [feature]-crud.ts      # CRUD básico + helpers compartidos
├── transfer-actions.ts    # Operaciones de transferencia
└── [domain]-actions.ts    # Otras operaciones específicas
```

**Ejemplo real (transactions):**
```
actions/
├── index.ts               # ~20 líneas
├── transaction-crud.ts    # ~355 líneas (CRUD + verifyProjectAccess)
├── transfer-actions.ts    # ~330 líneas (transferencias entre cuentas)
└── credit-card-actions.ts # ~310 líneas (pago TC, histórico)
```

**Reglas:**
- `ActionResult<T>` va en `types.ts` (compartido)
- Helpers como `verifyProjectAccess` van en el archivo CRUD y se exportan
- Cada archivo tiene sus propios imports de schema y db
- El `index.ts` solo re-exporta, no tiene lógica

### Patrón de División de Components

Cuando `components.tsx` supera ~500 líneas, dividir en carpeta:

```
features/[feature]/components/
├── index.ts                    # Barrel exports
├── [feature]-form.tsx          # Formulario principal
├── [feature]-table.tsx         # Tabla/lista
├── [feature]-dialogs.tsx       # Diálogos de confirmación
└── [domain]-specific.tsx       # Componentes específicos
```

### Patrón de ConfirmDialog Reutilizable

El componente `ConfirmDialog` soporta dos modos:

1. **Modo Trigger** - El dialog maneja su propio estado:
```tsx
<ConfirmDialog
  trigger={<Button>Eliminar</Button>}
  title="¿Eliminar?"
  description="Esta acción no se puede deshacer"
  onConfirm={handleDelete}
/>
```

2. **Modo Controlado** - Estado externo:
```tsx
<ConfirmDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  title="¿Eliminar?"
  description="Esta acción no se puede deshacer"
  onConfirm={handleDelete}
  isPending={isDeleting}
/>
```

---

## Métricas de Éxito

| Métrica | Antes | Objetivo |
|---------|-------|----------|
| Archivo más grande | 2,461 líneas | < 300 líneas |
| Código duplicado | ~1,500 líneas | < 100 líneas |
| Features con skeleton | 3/9 | 9/9 |
| Features con empty state | 5/9 | 9/9 |
| Rutas con loading.tsx | 0/9 | 9/9 |
| Tiempo de respuesta (mutaciones) | Variable | < 100ms (optimistic) |

---

## Referencias

- [Next.js 16 Caching](https://nextjs.org/docs/app/getting-started/caching-and-revalidating)
- [Next.js Loading UI](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
- [useOptimistic Hook](https://nextjs.org/docs/app/getting-started/updating-data)
- [State Management 2026](https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns)

---

## Documentación Relacionada

- [ANALYSIS.md](./ANALYSIS.md) - Análisis completo del codebase
- [PATTERNS.md](./PATTERNS.md) - Patrones de código a seguir
- [FEATURES_MAP.md](./FEATURES_MAP.md) - Mapa de features y lógica
- [BILLEDY_CONTEXT.md](./BILLEDY_CONTEXT.md) - Contexto de negocio
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Arquitectura general
