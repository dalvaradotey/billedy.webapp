---
title: Análisis del Codebase
description: Análisis exhaustivo de la estructura actual, identificación de problemas y oportunidades de mejora
version: 1.0.0
created: 2025-02-02
updated: 2025-02-02
author: Claude Code
tags: [análisis, refactoring, código, estructura]
---

# Billedy - Análisis del Codebase

## Resumen Ejecutivo

Este documento presenta un análisis exhaustivo del codebase de Billedy, identificando la estructura actual, problemas encontrados y oportunidades de mejora.

### Métricas Generales

| Métrica | Valor |
|---------|-------|
| **Features** | 13 módulos |
| **Líneas en features** | ~18,000 |
| **Archivos > 200 líneas** | 14 archivos |
| **Componentes Shadcn/ui** | 23 instalados |
| **Tablas en BD** | 21 tablas |
| **Enums definidos** | 8 enums |

---

## 1. Estructura de Features

### 1.1 Features Existentes

| Feature | Propósito | Líneas Totales | Estado |
|---------|-----------|----------------|--------|
| **transactions** | Ingresos y egresos | 4,057 | Crítico - Necesita división |
| **card-purchases** | Compras en cuotas | 2,285 | Crítico - Necesita división |
| **savings** | Fondos de ahorro | 1,905 | Crítico - Necesita división |
| **credits** | Créditos/préstamos | 1,903 | Crítico - Necesita división |
| **templates** | Plantillas recurrentes | 1,851 | Crítico - Necesita división |
| **billing-cycles** | Ciclos de facturación | 1,783 | Alto - Considerar división |
| **accounts** | Cuentas bancarias | 1,535 | Alto - Considerar división |
| **budgets** | Presupuestos | 872 | OK |
| **categories** | Categorías | 767 | OK |
| **projects** | Proyectos/períodos | 655 | OK |
| **entities** | Entidades (bancos, tiendas) | 348 | OK (sin componentes) |
| **onboarding** | Onboarding inicial | 84 | OK (minimal) |

### 1.2 Archivos Críticos (> 500 líneas)

| Feature | Archivo | Líneas | Prioridad |
|---------|---------|--------|-----------|
| transactions | components.tsx | **2,461** | CRÍTICO |
| transactions | actions.ts | **1,116** | CRÍTICO |
| card-purchases | components.tsx | **1,147** | CRÍTICO |
| savings | components.tsx | **1,113** | CRÍTICO |
| templates | components.tsx | **1,079** | CRÍTICO |
| credits | components.tsx | **1,055** | CRÍTICO |
| accounts | components.tsx | **985** | ALTO |
| billing-cycles | components.tsx | **801** | ALTO |
| billing-cycles | actions.ts | **592** | ALTO |
| card-purchases | actions.ts | **564** | ALTO |
| budgets | components.tsx | 529 | MEDIO |
| card-purchases | queries.ts | 496 | MEDIO |
| credits | actions.ts | 478 | MEDIO |
| templates | actions.ts | 437 | MEDIO |
| categories | components.tsx | 432 | MEDIO |

---

## 2. Análisis de Patrones de Renderizado

### 2.1 Estado Actual

#### Skeletons Implementados
| Feature | Skeleton | Implementación |
|---------|----------|----------------|
| transactions | `TransactionTableSkeleton` | Custom, dinámico |
| accounts | `AccountCardSkeleton` | Custom |
| savings | `SavingsFundCardSkeleton` | Custom |
| credits | - | NO implementado |
| billing-cycles | - | NO implementado |
| templates | - | NO implementado |
| budgets | - | NO implementado |
| card-purchases | - | NO implementado |

#### Empty States Implementados
| Feature | Empty State | Consistencia |
|---------|-------------|--------------|
| transactions | "No hay transacciones registradas" | Sin icono |
| accounts | "No hay cuentas registradas." | Con icono Wallet |
| savings | "No hay fondos de ahorro registrados" | Sin icono |
| credits | - | NO implementado |
| billing-cycles | - | NO implementado |
| templates | - | NO implementado |
| budgets | "No hay presupuestos configurados" | Sin icono |
| categories | "No hay categorías" | Sin icono |
| card-purchases | - | NO implementado |

### 2.2 Problemas Identificados

1. **Inconsistencia en Skeletons**
   - Solo 3 de 9 features tienen skeletons personalizados
   - Causa parpadeo y sensación de no-respuesta en otras features

2. **Inconsistencia en Empty States**
   - Mensajes con/sin punto final
   - Algunos con icono, otros sin
   - 4 features sin empty state

3. **Patrones de Loading Diferentes**
   - **Patrón A**: `isRefreshing` con `useRef` (transactions, accounts, savings, credits, billing-cycles)
   - **Patrón B**: `useTransition` simple (budgets, categories)
   - Confusión y comportamiento inconsistente

4. **Toast Behavior Inconsistente**
   - Algunos esperan cambios en data antes de mostrar success
   - Otros muestran success inmediatamente
   - Timeout de 5s como fallback (no adaptativo)

---

## 3. Análisis de Código Duplicado

### 3.1 Funciones Duplicadas

#### `formatCurrency` (8 archivos)
```typescript
// Presente en: transactions, credits, accounts, budgets,
// savings, card-purchases, templates, billing-cycles
function formatCurrency(amount: number | string, currency: string = 'CLP'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}
```

#### `formatDate` (5+ archivos)
```typescript
// Variante 1 (más común)
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}
```

### 3.2 Patrones de UI Duplicados

| Patrón | Ocurrencias | Archivos Afectados |
|--------|-------------|-------------------|
| Dialog + Form | ~50 | Todas las features |
| useTransition + toast | ~76 | Todas las features |
| AccountTypeIcon | 2 | accounts, transactions |
| Dialog state management | ~40 | Todas las features |

---

## 4. Componentes Globales Actuales

### 4.1 Componentes Personalizados

| Componente | Líneas | Propósito |
|------------|--------|-----------|
| entity-selector.tsx | 210 | Selector con búsqueda y agrupación |
| category-selector.tsx | 328 | Selector con creación inline |
| currency-input.tsx | 167 | Input de moneda formateado |
| installment-selector.tsx | 126 | Selector de cuotas +/- |
| theme-toggle.tsx | 117 | Toggle tema claro/oscuro |
| dashboard-header.tsx | 163 | Header con navegación |
| no-projects-message.tsx | 122 | Estado vacío inicial |

### 4.2 Componentes Shadcn/ui Instalados (23)

alert, alert-dialog, avatar, badge, button, card, checkbox, command, confirm-dialog, dialog, dropdown-menu, form, input, label, popover, progress, select, separator, skeleton, sonner, switch, table, textarea

---

## 5. Análisis del Schema de Base de Datos

### 5.1 Tablas por Módulo

**Autenticación (4)**
- n1n4_users
- n1n4_oauth_accounts
- n1n4_sessions
- n1n4_verification_tokens

**Core (7)**
- n1n4_currencies
- n1n4_entities
- n1n4_projects
- n1n4_project_members
- n1n4_categories
- n1n4_accounts
- n1n4_transfers

**Transacciones (4)**
- n1n4_transactions
- n1n4_credits
- n1n4_budgets
- n1n4_card_purchases

**Ahorros (2)**
- n1n4_savings_funds
- n1n4_savings_movements

**Templates (2)**
- n1n4_templates
- n1n4_template_items

**Ciclos (2)**
- n1n4_billing_cycles
- n1n4_billing_cycle_budgets

### 5.2 Problemas de Schema Identificados

| Prioridad | Problema | Impacto |
|-----------|----------|---------|
| ALTA | Campos redundantes de moneda (currency + currencyId) | Inconsistencia de datos |
| ALTA | `accounts` sin `currencyId` FK explícita | Conversión imprecisa |
| MEDIA | FKs informales en transactions | Falta integridad referencial |
| MEDIA | `savingsFunds.projectId` nullable | Ambigüedad en ownership |
| MEDIA | `cardPurchases` con entityId Y storeName | Duplicación de datos |
| BAJA | `categories` no usa categoryTypeEnum | Falta enforcing |

---

## 6. Estructura de App Router

### 6.1 Rutas Existentes

```
src/app/
├── (auth)/login/           → /login
├── (dashboard)/
│   └── dashboard/
│       ├── page.tsx        → /dashboard
│       ├── transactions/   → /dashboard/transactions
│       ├── accounts/       → /dashboard/accounts
│       ├── cycles/         → /dashboard/cycles
│       ├── credits/        → /dashboard/credits
│       ├── budgets/        → /dashboard/budgets
│       ├── categories/     → /dashboard/categories
│       ├── savings/        → /dashboard/savings
│       ├── templates/      → /dashboard/templates
│       └── card-purchases/ → /dashboard/card-purchases
├── (admin)/admin/entities/ → /admin/entities
└── api/auth/[...nextauth]/ → API NextAuth
```

### 6.2 Archivos Especiales Faltantes

| Archivo | Estado | Recomendación |
|---------|--------|---------------|
| loading.tsx | NO existe | Agregar en rutas pesadas |
| error.tsx | NO existe | Agregar manejo de errores |
| not-found.tsx | NO existe | Agregar página 404 |

---

## 7. Análisis de Server Components vs Client Components

### 7.1 Estado Actual

- **Páginas**: 100% Server Components (correcto)
- **Layouts**: 100% Server Components (correcto)
- **Features**: Componentes marcados 'use client' para interactividad

### 7.2 Flujo de Datos

```
Page (Server) → Carga datos con queries
    ↓
    Pasa props a Feature Component
    ↓
Feature Component (Client) → UI interactiva + Server Actions
```

---

## 8. Hooks y Utilidades

### 8.1 Estado Actual

- **NO existe** carpeta `src/hooks/` global
- Hooks embebidos en cada `components.tsx`
- Alta duplicación de lógica entre features

### 8.2 Hooks Identificados para Extracción

| Hook | Uso Actual | Beneficio |
|------|------------|-----------|
| useDialogState | ~40 veces | Elimina 200+ líneas duplicadas |
| useMutationHandler | ~76 veces | Estandariza feedback |
| useRefreshDetector | ~5 features | Centraliza lógica compleja |

---

## 9. Conclusiones

### Fortalezas del Proyecto

1. **Arquitectura feature-based** bien definida
2. **Server Components** usados correctamente
3. **Tipado TypeScript** consistente
4. **Validaciones Zod** en todas las features
5. **Patrón de Server Actions** bien implementado

### Debilidades Críticas

1. **Archivos monolíticos** de 1000+ líneas
2. **Código duplicado** significativo (~1500 líneas)
3. **Patrones de UX inconsistentes** (skeletons, empty states, toasts)
4. **Falta de hooks globales** para lógica común
5. **Schema de BD** con redundancias

### Próximos Pasos Recomendados

1. **Fase 1**: Dividir archivos críticos (>1000 líneas)
2. **Fase 2**: Crear utilidades y hooks globales
3. **Fase 3**: Estandarizar patrones de UX
4. **Fase 4**: Crear componentes reutilizables
5. **Fase 5**: Limpiar schema de BD

Ver [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) para el plan detallado.
