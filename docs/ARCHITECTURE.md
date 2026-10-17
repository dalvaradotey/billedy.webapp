---
title: Arquitectura Feature-Based
description: Guía de arquitectura y convenciones del proyecto Billedy
version: 1.0.0
created: 2025-01-28
updated: 2025-01-28
author: Claude Code
tags: [arquitectura, convenciones, feature-based, next.js]
---

# Billedy - Arquitectura Feature-Based

## Principio General

Usamos una arquitectura **feature-based** donde cada módulo funcional contiene todo lo necesario para funcionar de forma autónoma: componentes, actions, queries, tipos y validaciones.

**Regla de oro**: Empezar simple con archivos, escalar a carpetas cuando el archivo supere ~150-200 líneas o tenga 3+ elementos del mismo tipo.

---

## Estructura del Proyecto

```
src/
├── app/                         # Next.js App Router (rutas y páginas)
│   ├── (auth)/                  # Grupo de rutas de autenticación
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/             # Grupo de rutas del dashboard
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Resumen mensual
│   │   ├── transactions/
│   │   ├── credits/
│   │   ├── budgets/
│   │   ├── savings/
│   │   └── settings/
│   ├── api/                     # API Routes (si se necesitan)
│   │   └── auth/[...nextauth]/
│   ├── layout.tsx
│   └── page.tsx                 # Landing
│
├── features/                    # Módulos feature-based
│   ├── transactions/
│   ├── credits/
│   ├── budgets/
│   ├── savings/
│   ├── categories/
│   ├── accounts/
│   └── projects/
│
├── components/                  # Componentes compartidos globales
│   ├── ui/                      # Shadcn/ui components
│   ├── layout/                  # Header, Sidebar, Footer
│   └── common/                  # Componentes reutilizables
│
├── lib/                         # Utilidades core
│   ├── db/
│   │   ├── index.ts             # Drizzle client
│   │   ├── schema/              # Drizzle schemas (tablas)
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── auth.ts                  # NextAuth config
│   └── utils.ts                 # Utilidades generales
│
├── hooks/                       # Hooks globales compartidos
├── types/                       # Tipos globales
└── config/                      # Configuración de la app
```

---

## Estructura de una Feature

### Versión Simple (inicio)

Cuando una feature es pequeña, usar archivos simples:

```
src/features/transactions/
├── index.ts              # Barrel exports
├── components.tsx        # Componentes de la feature
├── actions.ts            # Server actions ('use server')
├── queries.ts            # Server queries (funciones async)
├── hooks.ts              # Hooks específicos de la feature
├── schemas.ts            # Validaciones Zod
├── types.ts              # TypeScript interfaces/types
└── constants.ts          # Constantes de la feature
```

### Versión Escalada (cuando crece)

Cuando un archivo supera ~150-200 líneas o tiene 3+ elementos, escalar a carpeta:

```
src/features/transactions/
├── index.ts
├── components/                  # Escalado cuando hay 3+ componentes
│   ├── index.ts                 # Barrel exports
│   ├── transaction-list.tsx
│   ├── transaction-form.tsx
│   └── transaction-table/       # Sub-componente complejo
│       ├── index.tsx
│       └── columns.tsx
├── actions/                     # Escalado cuando hay 3+ actions
│   ├── index.ts
│   ├── create-transaction.ts
│   ├── update-transaction.ts
│   └── delete-transaction.ts
├── queries.ts                   # Puede seguir como archivo
├── hooks.ts
├── schemas.ts
├── types.ts
└── constants.ts
```

---

## Convenciones de Nombrado

### Archivos y Carpetas

| Tipo | Formato | Ejemplo |
|------|---------|---------|
| Features (carpetas) | kebab-case | `transactions/`, `savings/` |
| Componentes | kebab-case.tsx | `transaction-form.tsx` |
| Actions | kebab-case.ts | `create-transaction.ts` |
| Queries | kebab-case.ts | `get-transactions.ts` |
| Hooks | use-kebab-case.ts | `use-transaction-filters.ts` |
| Types | types.ts | Un archivo por feature |
| Schemas | schemas.ts | Validaciones Zod |
| Constants | constants.ts | Valores fijos |
| Barrel exports | index.ts | En cada carpeta |

### Código

| Tipo | Formato | Ejemplo |
|------|---------|---------|
| Componentes | PascalCase | `TransactionForm`, `TransactionList` |
| Funciones | camelCase | `createTransaction`, `getTransactions` |
| Variables | camelCase | `transactionData`, `isLoading` |
| Constantes | UPPER_SNAKE_CASE | `MAX_INSTALLMENT_AMOUNT` |
| Types/Interfaces | PascalCase | `Transaction`, `CreateTransactionInput` |
| Schemas Zod | camelCase + Schema | `createTransactionSchema` |

### Base de Datos (Drizzle)

| Tipo | Formato | Ejemplo |
|------|---------|---------|
| Tablas | n1n4_snake_case (plural) | `n1n4_transactions`, `n1n4_savings_funds` |
| Columnas | snake_case | `created_at`, `user_id` |
| Enums | PascalCase | `TransactionType`, `AccountType` |

---

## Barrel Exports (index.ts)

Cada feature debe tener un `index.ts` que exporte todo lo público:

```typescript
// src/features/transactions/index.ts

// Componentes
export * from './components';
// o si es archivo: export { TransactionList, TransactionForm } from './components';

// Actions
export * from './actions';

// Queries
export * from './queries';

// Hooks
export * from './hooks';

// Types
export * from './types';

// Schemas (opcional, solo si se usan externamente)
export * from './schemas';
```

---

## Separación Client/Server

### Componentes Cliente
```typescript
'use client';

import { useState } from 'react';

export function TransactionForm() {
  // ...
}
```

### Server Actions
```typescript
'use server';

import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema';

export async function createTransaction(data: CreateTransactionInput) {
  // ...
}
```

### Server Queries
```typescript
// Sin 'use server' - son funciones async normales
import { db } from '@/lib/db';

export async function getTransactions(projectId: string) {
  return db.query.transactions.findMany({
    where: eq(transactions.projectId, projectId),
  });
}
```

---

## Flujo de Datos

```
┌─────────────────────────────────────────────────────────────┐
│                    app/(dashboard)/transactions/page.tsx     │
│                    (Server Component - SSR)                  │
└─────────────────────────────────┬───────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │  Llama queries del server │
                    │  getTransactions()        │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │  Pasa data a componentes  │
                    │  <TransactionList data /> │
                    └─────────────┬─────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────┐
│                 TransactionList (Client Component)           │
│                                                              │
│  - Renderiza UI interactiva                                  │
│  - Llama server actions para mutaciones                      │
│  - createTransaction(), updateTransaction()                  │
└──────────────────────────────────────────────────────────────┘
```

---

## Features de Billedy

| Feature | Descripción |
|---------|-------------|
| `transactions` | Ingresos y egresos |
| `credits` | Créditos/préstamos con cuotas |
| `budgets` | Presupuestos mensuales por categoría |
| `savings` | Fondos de ahorro y movimientos |
| `categories` | Categorías de transacciones |
| `accounts` | Cuentas bancarias y efectivo |
| `projects` | Proyectos/períodos financieros |

---

## Cuándo Escalar

### De archivo a carpeta

Escalar cuando:
- El archivo supera ~150-200 líneas
- Hay 3+ componentes/actions/queries
- La lógica se vuelve difícil de navegar

### Ejemplo de escalado

**Antes** (archivo simple):
```
features/transactions/
└── components.tsx  # 250 líneas, 4 componentes
```

**Después** (carpeta):
```
features/transactions/
└── components/
    ├── index.ts
    ├── transaction-list.tsx
    ├── transaction-form.tsx
    ├── transaction-card.tsx
    └── transaction-filters.tsx
```

---

## Imports

### Desde fuera de la feature
```typescript
// Usar el barrel export
import { TransactionList, createTransaction } from '@/features/transactions';
```

### Dentro de la feature
```typescript
// Imports directos están permitidos
import { Transaction } from './types';
import { createTransactionSchema } from './schemas';
```

---

## Reglas Importantes

1. **Una feature = un dominio funcional**
2. **No importar entre features directamente** - usar tipos compartidos en `src/types/`
3. **Componentes compartidos van en `src/components/`**
4. **Lógica de DB va en queries/actions, no en componentes**
5. **Validar inputs con Zod antes de enviar al servidor**
6. **Mantener componentes pequeños y enfocados**

---

## Seguridad en server actions (octubre 2026)

Las server actions son endpoints públicos y la BD no usa RLS para la app: cada action verifica todo.

1. **Sesión:** primera línea `isSessionUser(userId)` o `requireUserId()` (`@/lib/auth/guards`).
2. **Membresía** (`@/lib/auth/project-access`):
   - Lecturas: `verifyProjectAccess(projectId, userId)`, para cualquier miembro aceptado.
   - Modificaciones: `verifyProjectWriteAccess(projectId, userId)`, solo para owner o editor (el rol viewer solo lee).
   - En joins con `projectMembers`: `memberCondition(userId, { write: true })`.
3. **Ids del input:** toda cuenta, categoría, presupuesto, meta o crédito se valida con `projectRefsError(projectId, {...})` contra el proyecto ya verificado. Nunca se acepta un `projectId` del cliente para mover una fila: se deriva de la fila padre.
4. **Updates y deletes por id:** el WHERE incluye también `projectId`.
5. **Resultado:** `ActionResult<T>` de `@/types/action-result`. Los errores son mensajes legibles; los errores internos de la BD van solo a `console.error`.
6. **Saldos:** las operaciones de varios pasos que tocan saldos van dentro de `db.transaction`. `updateAccountBalance(id, delta, tx)` acepta la transacción.

## Imports entre features

- Se permite importar directo `queries`, `actions` y `types` de otra feature.
- La lógica de dominio compartida vive en `src/lib/` (acceso, fechas, formato).
- Los barrels de feature no deben mezclar componentes cliente con código de servidor que no se use en el cliente.

## Pruebas

- Vitest: `npm test`, `npm run test:watch` y `npm run test:coverage`.
- Se prueba la lógica pura (cascada de ciclos, parsers, bot, previsión, validaciones zod), sin BD.
- Lo que arma SQL o lee la BD se separa de la lógica pura para poder probarla, como las vistas del bot en `telegram/views.ts`.
- Los archivos `*.test.ts` van junto al código que prueban.

## Migraciones

- **No usar `drizzle-kit push` ni `generate`.** El journal está desincronizado y borraría las FKs, los CHECKs y `n1n4_schema_migrations`.
- Los cambios de esquema van como SQL en `src/lib/db/manual-migrations/` y se aplican con `npx tsx scripts/db-migrate.ts --apply`.
