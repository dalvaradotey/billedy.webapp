---
title: Patrones de Código
description: Guía de patrones y convenciones a seguir en Billedy
version: 1.0.0
created: 2025-02-02
updated: 2025-02-02
author: Claude Code
tags: [patrones, convenciones, código, ui, ux]
---

# Billedy - Patrones de Código

Este documento define los patrones estándar que deben seguirse en todo el proyecto para mantener consistencia.

---

## 1. Patrones de Componentes

### 1.1 Estructura de Archivo de Componente

```typescript
// feature/components/component-name.tsx
'use client';

import { useState } from 'react';
// 1. Imports de React/Next
// 2. Imports de librerías externas
// 3. Imports de componentes UI
// 4. Imports de la feature
// 5. Imports de tipos

// Types locales (si son pequeños)
interface ComponentNameProps {
  // props
}

// Componente principal
export function ComponentName({ prop1, prop2 }: ComponentNameProps) {
  // 1. Hooks de estado
  // 2. Hooks de efectos
  // 3. Handlers
  // 4. Render helpers
  // 5. Return JSX

  return (
    // JSX
  );
}

// Sub-componentes (si son pequeños y solo usados aquí)
function SubComponent() {
  // ...
}
```

### 1.2 Componente de Lista

```typescript
// Patrón estándar para listas
interface ListComponentProps<T> {
  items: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: LucideIcon;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
}

export function ListComponent<T>({
  items,
  isLoading,
  emptyMessage = 'No hay elementos',
  emptyIcon: Icon,
  onEdit,
  onDelete,
}: ListComponentProps<T>) {
  // Loading state
  if (isLoading) {
    return <ListSkeleton />;
  }

  // Empty state
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Icon}
        title={emptyMessage}
        description="Crea uno nuevo para comenzar"
      />
    );
  }

  // List render
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
```

### 1.3 Componente de Formulario

```typescript
// Patrón estándar para formularios en diálogos
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutationHandler } from '@/hooks';

const formSchema = z.object({
  // schema
});

type FormData = z.infer<typeof formSchema>;

interface FormComponentProps {
  defaultValues?: Partial<FormData>;
  onSuccess?: () => void;
}

export function FormComponent({ defaultValues, onSuccess }: FormComponentProps) {
  const { isPending, execute } = useMutationHandler();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      // defaults
      ...defaultValues,
    },
  });

  const onSubmit = async (data: FormData) => {
    await execute(
      () => serverAction(data),
      {
        loadingMessage: 'Guardando...',
        successMessage: 'Guardado exitosamente',
        onSuccess: () => {
          form.reset();
          onSuccess?.();
        },
      }
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Form fields */}
        <LoadingButton type="submit" isLoading={isPending}>
          Guardar
        </LoadingButton>
      </form>
    </Form>
  );
}
```

---

## 2. Patrones de Estado

### 2.1 Estado de Diálogo

```typescript
// Usar hook useDialogState para todos los diálogos
import { useDialogState } from '@/hooks';

function ParentComponent() {
  const createDialog = useDialogState();
  const editDialog = useDialogState<ItemType>();
  const deleteDialog = useDialogState<ItemType>();

  return (
    <>
      <Button onClick={createDialog.openCreate}>Crear</Button>

      <CreateDialog
        isOpen={createDialog.isOpen}
        onClose={createDialog.close}
      />

      <EditDialog
        isOpen={editDialog.isOpen}
        item={editDialog.editingItem}
        onClose={editDialog.close}
      />

      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        item={deleteDialog.editingItem}
        onClose={deleteDialog.close}
      />
    </>
  );
}
```

### 2.2 Estado de Mutación

```typescript
// Usar hook useMutationHandler para todas las mutaciones
import { useMutationHandler } from '@/hooks';

function ActionComponent() {
  const { isPending, execute } = useMutationHandler();

  const handleDelete = async (id: string) => {
    await execute(
      () => deleteItem(id),
      {
        loadingMessage: 'Eliminando...',
        successMessage: 'Elemento eliminado',
        errorMessage: 'No se pudo eliminar',
        onSuccess: () => {
          // Acciones post-éxito
        },
      }
    );
  };

  return (
    <LoadingButton
      variant="destructive"
      isLoading={isPending}
      onClick={() => handleDelete(itemId)}
    >
      Eliminar
    </LoadingButton>
  );
}
```

---

## 3. Patrones de UI

### 3.1 Empty State

**SIEMPRE** mostrar empty state cuando una lista está vacía:

```typescript
// Patrón obligatorio
<EmptyState
  icon={IconComponent}           // Opcional pero recomendado
  title="No hay [elementos]"     // Siempre en español, sin punto
  description="Descripción..."   // Opcional
  action={<Button>Crear</Button>} // Opcional
/>
```

**Ejemplos correctos**:
- "No hay transacciones registradas"
- "No hay cuentas configuradas"
- "No hay presupuestos para este mes"

**Ejemplos incorrectos**:
- "No hay transacciones." ❌ (punto final)
- "Empty" ❌ (en inglés)
- "Sin datos" ❌ (muy genérico)

### 3.2 Skeleton Loading

**SIEMPRE** mostrar skeleton durante la carga:

```typescript
// Cada feature debe tener su skeleton
export function FeatureSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-lg border p-4">
          <Skeleton className="h-6 w-1/3 mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}
```

### 3.3 Toast Messages

**Formato estándar**:

| Acción | Loading | Success | Error |
|--------|---------|---------|-------|
| Crear | "Creando..." | "Elemento creado" | "No se pudo crear" |
| Editar | "Guardando..." | "Cambios guardados" | "No se pudo guardar" |
| Eliminar | "Eliminando..." | "Elemento eliminado" | "No se pudo eliminar" |
| Archivar | "Archivando..." | "Elemento archivado" | "No se pudo archivar" |

**Incluir contexto cuando sea posible**:
```typescript
toast.success(`Transacción "${description}" creada`);
toast.success(`Presupuesto de ${formatCurrency(amount)} guardado`);
```

### 3.4 Botones de Acción

```typescript
// Botón primario (crear, guardar)
<Button>Crear transacción</Button>

// Botón secundario (cancelar, cerrar)
<Button variant="outline">Cancelar</Button>

// Botón destructivo (eliminar)
<Button variant="destructive">Eliminar</Button>

// Botón con loading
<LoadingButton isLoading={isPending}>Guardar</LoadingButton>

// Botón de icono (acciones en lista)
<Button variant="ghost" size="icon">
  <Pencil className="h-4 w-4" />
</Button>
```

---

## 4. Patrones de Server Actions

### 4.1 Estructura de Action

```typescript
// feature/actions/action-name.ts
'use server';

import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

const inputSchema = z.object({
  // validación
});

type Input = z.infer<typeof inputSchema>;

type Result = {
  success: boolean;
  error?: string;
  data?: ReturnType;
};

export async function actionName(input: Input): Promise<Result> {
  try {
    // 1. Autenticación
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'No autorizado' };
    }

    // 2. Validación
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: 'Datos inválidos' };
    }

    // 3. Lógica de negocio
    const result = await db.insert(table).values({
      // ...
    }).returning();

    // 4. Revalidación
    revalidatePath('/dashboard/feature');

    // 5. Retorno exitoso
    return { success: true, data: result[0] };

  } catch (error) {
    console.error('Error en actionName:', error);
    return { success: false, error: 'Error interno del servidor' };
  }
}
```

### 4.2 Nombres de Actions

| Acción | Nombre | Ejemplo |
|--------|--------|---------|
| Crear | `create[Entity]` | `createTransaction` |
| Actualizar | `update[Entity]` | `updateTransaction` |
| Eliminar | `delete[Entity]` | `deleteTransaction` |
| Archivar | `archive[Entity]` | `archiveCategory` |
| Restaurar | `restore[Entity]` | `restoreCategory` |
| Toggle | `toggle[Property]` | `togglePaid` |

---

## 5. Patrones de Queries

### 5.1 Estructura de Query

```typescript
// feature/queries.ts
import { db } from '@/lib/db';
import { table } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function getItems(projectId: string) {
  return db.query.table.findMany({
    where: eq(table.projectId, projectId),
    orderBy: [desc(table.createdAt)],
    with: {
      category: true,
      account: true,
    },
  });
}

export async function getItemById(id: string) {
  return db.query.table.findFirst({
    where: eq(table.id, id),
  });
}

export async function getItemsSummary(projectId: string) {
  // Queries de agregación
}
```

### 5.2 Nombres de Queries

| Acción | Nombre | Ejemplo |
|--------|--------|---------|
| Listar | `get[Entities]` | `getTransactions` |
| Obtener uno | `get[Entity]ById` | `getTransactionById` |
| Resumen | `get[Entities]Summary` | `getTransactionsSummary` |
| Filtrar | `get[Entities]By[Filter]` | `getTransactionsByCategory` |

---

## 6. Patrones de Estilos

### 6.1 Mobile-First

**SIEMPRE** diseñar mobile-first:

```typescript
// Correcto: mobile-first
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Incorrecto: desktop-first
<div className="grid grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-4">
```

### 6.2 Espaciado Consistente

```typescript
// Entre secciones
<div className="space-y-6">

// Entre elementos de lista
<div className="space-y-4">

// Dentro de cards
<div className="p-4">

// Padding de página
<div className="container py-6">
```

### 6.3 Touch Targets

```typescript
// Mínimo 44x44px para elementos táctiles
<Button size="lg">  // Uso recomendado en mobile

// O padding adicional
<button className="p-3">
```

---

## 7. Patrones de Tipos

### 7.1 Tipos de Feature

```typescript
// feature/types.ts

// Tipo base (de la BD)
export type Transaction = typeof transactions.$inferSelect;

// Tipo con relaciones
export type TransactionWithRelations = Transaction & {
  category: Category;
  account: Account | null;
};

// Tipo de input para crear
export type CreateTransactionInput = {
  // campos requeridos
};

// Tipo de input para actualizar
export type UpdateTransactionInput = Partial<CreateTransactionInput> & {
  id: string;
};
```

### 7.2 Tipos de Props

```typescript
// Siempre definir interfaces para props
interface ComponentProps {
  // Props requeridas primero
  items: Item[];
  projectId: string;

  // Props opcionales después
  isLoading?: boolean;
  onSuccess?: () => void;

  // Callbacks al final
  onEdit?: (item: Item) => void;
  onDelete?: (item: Item) => void;
}
```

---

## 8. Patrones de Testing (Futuro)

### 8.1 Estructura de Tests

```
feature/
├── __tests__/
│   ├── components.test.tsx
│   ├── actions.test.ts
│   └── queries.test.ts
```

### 8.2 Nombres de Tests

```typescript
describe('TransactionForm', () => {
  it('should render empty form for create mode', () => {});
  it('should populate form with data in edit mode', () => {});
  it('should validate required fields', () => {});
  it('should call onSubmit with form data', () => {});
  it('should show loading state during submission', () => {});
});
```

---

## Checklist de Nuevo Componente

- [ ] Archivo en kebab-case
- [ ] Nombre de componente en PascalCase
- [ ] Props tipadas con interface
- [ ] Mobile-first styles
- [ ] Empty state si aplica
- [ ] Loading state si aplica
- [ ] Touch targets mínimo 44px
- [ ] Usa hooks globales (useDialogState, useMutationHandler)
- [ ] Toasts con mensajes contextuales
- [ ] Exportado en index.ts

## Checklist de Nueva Action

- [ ] Validación con Zod
- [ ] Verificación de autenticación
- [ ] Try-catch con manejo de errores
- [ ] Retorna `{ success, error?, data? }`
- [ ] Usa revalidatePath
- [ ] Logging de errores
- [ ] Exportada en index.ts
