---
title: Plan de Refactorización
description: Plan detallado para refactorizar el codebase de Billedy
version: 1.0.0
created: 2025-02-02
updated: 2025-02-02
author: Claude Code
tags: [refactoring, plan, mejoras, estructura]
---

# Billedy - Plan de Refactorización

## Visión General

Este plan organiza las mejoras en fases incrementales, priorizando cambios que no rompan funcionalidad existente.

---

## Fase 1: División de Archivos Críticos

**Objetivo**: Dividir archivos monolíticos en módulos manejables.
**Impacto**: Alto - Mejora mantenibilidad y testabilidad.

### 1.1 Feature: transactions (Prioridad CRÍTICA)

**Estado actual**:
- `components.tsx`: 2,461 líneas
- `actions.ts`: 1,116 líneas

**Propuesta de estructura**:
```
src/features/transactions/
├── index.ts
├── types.ts
├── schemas.ts
├── constants.ts
├── components/
│   ├── index.ts
│   ├── transactions-page.tsx        # Componente principal
│   ├── transaction-list.tsx          # Lista de transacciones
│   ├── transaction-card.tsx          # Card individual
│   ├── transaction-form.tsx          # Formulario crear/editar
│   ├── transaction-filters.tsx       # Filtros y búsqueda
│   ├── transaction-summary.tsx       # Cards de resumen
│   ├── transaction-skeleton.tsx      # Estado de carga
│   ├── transfer-dialog.tsx           # Diálogo de transferencias
│   └── pay-credit-card-dialog.tsx    # Pago de tarjeta
├── actions/
│   ├── index.ts
│   ├── create-transaction.ts
│   ├── update-transaction.ts
│   ├── delete-transaction.ts
│   ├── toggle-paid.ts
│   ├── create-transfer.ts
│   └── pay-credit-card.ts
└── queries.ts
```

### 1.2 Feature: card-purchases (Prioridad CRÍTICA)

**Estado actual**:
- `components.tsx`: 1,147 líneas
- `actions.ts`: 564 líneas

**Propuesta de estructura**:
```
src/features/card-purchases/
├── index.ts
├── types.ts
├── schemas.ts
├── components/
│   ├── index.ts
│   ├── card-purchases-page.tsx
│   ├── card-purchase-list.tsx
│   ├── card-purchase-card.tsx
│   ├── card-purchase-form.tsx
│   ├── card-purchase-installments.tsx
│   └── card-purchase-skeleton.tsx
├── actions/
│   ├── index.ts
│   ├── create-purchase.ts
│   ├── update-purchase.ts
│   └── delete-purchase.ts
└── queries.ts
```

### 1.3 Feature: savings (Prioridad CRÍTICA)

**Estado actual**:
- `components.tsx`: 1,113 líneas

**Propuesta de estructura**:
```
src/features/savings/
├── index.ts
├── types.ts
├── schemas.ts
├── components/
│   ├── index.ts
│   ├── savings-page.tsx
│   ├── savings-fund-list.tsx
│   ├── savings-fund-card.tsx
│   ├── savings-fund-form.tsx
│   ├── savings-movement-form.tsx
│   ├── savings-movement-history.tsx
│   └── savings-skeleton.tsx
├── actions.ts
└── queries.ts
```

### 1.4 Feature: credits (Prioridad CRÍTICA)

**Estado actual**:
- `components.tsx`: 1,055 líneas

**Propuesta de estructura**:
```
src/features/credits/
├── index.ts
├── types.ts
├── schemas.ts
├── components/
│   ├── index.ts
│   ├── credits-page.tsx
│   ├── credit-list.tsx
│   ├── credit-card.tsx
│   ├── credit-form.tsx
│   ├── credit-installments.tsx
│   └── credit-skeleton.tsx
├── actions.ts
└── queries.ts
```

### 1.5 Feature: templates (Prioridad CRÍTICA)

**Estado actual**:
- `components.tsx`: 1,079 líneas

**Propuesta de estructura**:
```
src/features/templates/
├── index.ts
├── types.ts
├── schemas.ts
├── components/
│   ├── index.ts
│   ├── templates-page.tsx
│   ├── template-list.tsx
│   ├── template-card.tsx
│   ├── template-form.tsx
│   ├── template-item-form.tsx
│   └── template-skeleton.tsx
├── actions.ts
└── queries.ts
```

### 1.6 Features de Prioridad ALTA

**accounts** (985 líneas) y **billing-cycles** (801 líneas) siguen el mismo patrón de división.

---

## Fase 2: Utilidades y Hooks Globales

**Objetivo**: Eliminar código duplicado y centralizar lógica común.
**Impacto**: Alto - Reduce ~1500 líneas duplicadas.

### 2.1 Crear src/lib/formatting.ts

```typescript
// src/lib/formatting.ts

/**
 * Formatea un número como moneda
 */
export function formatCurrency(
  amount: number | string,
  currency: string = 'CLP',
  locale: string = 'es-CL'
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const decimals = currency === 'CLP' ? 0 : 2;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Formatea una fecha en formato corto
 */
export function formatDate(
  date: Date | string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;

  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    ...options,
  });
}

/**
 * Formatea una fecha en formato largo
 */
export function formatDateLong(date: Date | string | null): string {
  return formatDate(date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Parsea un string de moneda a número
 */
export function parseCurrencyToNumber(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
}
```

### 2.2 Crear src/hooks/

```
src/hooks/
├── index.ts
├── use-dialog-state.ts
├── use-mutation-handler.ts
├── use-refresh-detector.ts
└── use-confirm-dialog.ts
```

#### use-dialog-state.ts
```typescript
import { useState, useCallback } from 'react';

interface DialogState<T> {
  isOpen: boolean;
  editingItem: T | null;
  openCreate: () => void;
  openEdit: (item: T) => void;
  close: () => void;
}

export function useDialogState<T>(): DialogState<T> {
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setIsOpen(true);
  }, []);

  const openEdit = useCallback((item: T) => {
    setEditingItem(item);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setEditingItem(null);
  }, []);

  return { isOpen, editingItem, openCreate, openEdit, close };
}
```

#### use-mutation-handler.ts
```typescript
import { useTransition, useCallback } from 'react';
import { toast } from 'sonner';

interface MutationOptions {
  loadingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function useMutationHandler() {
  const [isPending, startTransition] = useTransition();

  const execute = useCallback(
    async <T>(
      action: () => Promise<{ success: boolean; error?: string; data?: T }>,
      options: MutationOptions = {}
    ) => {
      const {
        loadingMessage = 'Procesando...',
        successMessage = 'Operación exitosa',
        errorMessage = 'Error en la operación',
        onSuccess,
        onError,
      } = options;

      const toastId = toast.loading(loadingMessage);

      startTransition(async () => {
        try {
          const result = await action();

          if (result.success) {
            toast.success(successMessage, { id: toastId });
            onSuccess?.();
          } else {
            toast.error(result.error || errorMessage, { id: toastId });
            onError?.(result.error || errorMessage);
          }
        } catch (error) {
          toast.error(errorMessage, { id: toastId });
          onError?.(errorMessage);
        }
      });
    },
    [startTransition]
  );

  return { isPending, execute };
}
```

---

## Fase 3: Estandarización de UX

**Objetivo**: Crear patrones consistentes para estados de carga, vacíos y feedback.
**Impacto**: Alto - Mejora experiencia de usuario.

### 3.1 Crear Componente EmptyState

```typescript
// src/components/empty-state.tsx
'use client';

import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && (
        <div className="mb-4 rounded-full bg-muted p-3">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-medium">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

### 3.2 Crear Componentes Skeleton Estandarizados

```typescript
// src/components/skeletons/
├── index.ts
├── card-skeleton.tsx
├── list-skeleton.tsx
├── table-skeleton.tsx
└── form-skeleton.tsx
```

### 3.3 Crear Componente LoadingButton

```typescript
// src/components/loading-button.tsx
'use client';

import { Button, ButtonProps } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface LoadingButtonProps extends ButtonProps {
  isLoading?: boolean;
  loadingText?: string;
}

export function LoadingButton({
  children,
  isLoading,
  loadingText,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button disabled={disabled || isLoading} {...props}>
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText || children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
```

---

## Fase 4: Componentes Reutilizables

**Objetivo**: Crear componentes abstractos para patrones repetidos.
**Impacto**: Medio - Reduce código futuro.

### 4.1 FormDialog

```typescript
// src/components/form-dialog.tsx
interface FormDialogProps<T extends z.ZodType> {
  title: string;
  description?: string;
  schema: T;
  defaultValues?: Partial<z.infer<T>>;
  onSubmit: (data: z.infer<T>) => Promise<void>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  submitLabel?: string;
  isSubmitting?: boolean;
}
```

### 4.2 ConfirmDialog

```typescript
// src/components/confirm-dialog.tsx
interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => Promise<void>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}
```

### 4.3 DataTable Genérico

```typescript
// src/components/data-table/
├── index.tsx
├── data-table-header.tsx
├── data-table-row.tsx
├── data-table-pagination.tsx
└── data-table-skeleton.tsx
```

---

## Fase 5: App Router Improvements

**Objetivo**: Agregar archivos especiales de Next.js para mejor UX.
**Impacto**: Medio - Mejora manejo de errores y carga.

### 5.1 Agregar loading.tsx

```typescript
// src/app/(dashboard)/dashboard/transactions/loading.tsx
import { TransactionsSkeleton } from '@/features/transactions';

export default function Loading() {
  return <TransactionsSkeleton />;
}
```

### 5.2 Agregar error.tsx

```typescript
// src/app/(dashboard)/dashboard/transactions/error.tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h2 className="text-lg font-medium">Algo salió mal</h2>
      <p className="text-muted-foreground mt-1">
        No pudimos cargar las transacciones
      </p>
      <Button onClick={reset} className="mt-4">
        Intentar de nuevo
      </Button>
    </div>
  );
}
```

### 5.3 Agregar not-found.tsx

```typescript
// src/app/not-found.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <FileQuestion className="h-16 w-16 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-bold">Página no encontrada</h1>
      <p className="text-muted-foreground mt-2">
        La página que buscas no existe
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Volver al inicio</Link>
      </Button>
    </div>
  );
}
```

---

## Fase 6: Limpieza de Schema BD

**Objetivo**: Eliminar redundancias y mejorar integridad.
**Impacto**: Bajo - Cambios de migración requeridos.

### 6.1 Cambios Propuestos

| Cambio | Tabla | Acción |
|--------|-------|--------|
| Eliminar campo `currency` redundante | projects | Usar solo `baseCurrencyId` |
| Agregar `currencyId` FK | accounts | Reemplazar `currency` string |
| Hacer `projectId` required | savingsFunds | Cambiar a `.notNull()` |
| Eliminar `storeName` | cardPurchases | Usar solo `entityId` |
| Agregar FKs formales | transactions | linkedTransactionId, paidByTransferId |

---

## Orden de Ejecución Recomendado

### Sprint 1: Fundamentos
1. [ ] Crear `src/lib/formatting.ts`
2. [ ] Crear `src/hooks/` con hooks básicos
3. [ ] Crear componente `EmptyState`
4. [ ] Crear componente `LoadingButton`

### Sprint 2: Feature Crítica - Transactions
5. [ ] Dividir `transactions/components.tsx`
6. [ ] Dividir `transactions/actions.ts`
7. [ ] Agregar skeleton y empty state
8. [ ] Agregar loading.tsx y error.tsx

### Sprint 3: Features Críticas
9. [ ] Dividir card-purchases
10. [ ] Dividir savings
11. [ ] Dividir credits
12. [ ] Dividir templates

### Sprint 4: Features de Alta Prioridad
13. [ ] Dividir accounts
14. [ ] Dividir billing-cycles
15. [ ] Agregar skeletons faltantes

### Sprint 5: Componentes Abstractos
16. [ ] Crear FormDialog
17. [ ] Crear ConfirmDialog
18. [ ] Crear DataTable genérico

### Sprint 6: Pulido
19. [ ] Agregar not-found.tsx global
20. [ ] Revisar y limpiar schema BD
21. [ ] Testing y documentación

---

## Métricas de Éxito

| Métrica | Antes | Objetivo |
|---------|-------|----------|
| Archivo más grande | 2,461 líneas | < 300 líneas |
| Código duplicado | ~1,500 líneas | < 100 líneas |
| Features con skeleton | 3/9 | 9/9 |
| Features con empty state | 5/9 | 9/9 |
| Hooks globales | 0 | 5+ |
| Archivos > 500 líneas | 15 | 0 |

---

## Notas Importantes

1. **No romper funcionalidad**: Cada cambio debe ser incremental y testeable
2. **Commits atómicos**: Un commit por componente/archivo migrado
3. **Mantener barrel exports**: Los imports externos no deben cambiar
4. **Documentar cambios**: Actualizar CLAUDE.md si cambian convenciones
