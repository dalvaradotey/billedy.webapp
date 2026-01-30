---
title: Roadmap de Desarrollo
description: Plan de trabajo pendiente para Billedy
version: 1.0.0
created: 2025-01-28
updated: 2025-01-28
author: Claude Code
tags: [roadmap, pendientes, plan]
---

# Billedy - Roadmap de Desarrollo

## Estado Actual

### Completado

- [x] Arquitectura feature-based definida y documentada
- [x] Estructura de carpetas (`src/features/`, `src/components/`, etc.)
- [x] Drizzle ORM configurado con PostgreSQL (Supabase)
- [x] 16 tablas creadas con migraciones aplicadas
- [x] Seed de currencies (3) y category_templates (30)
- [x] NextAuth v4 con Google OAuth funcionando
- [x] Adapter personalizado de Drizzle para NextAuth
- [x] Página de login (`/login`)
- [x] Layout del dashboard con protección de rutas
- [x] Dashboard básico (`/dashboard`)
- [x] Header con navegación y menú de usuario
- [x] Shadcn/ui configurado (button, card, avatar, dropdown-menu)
- [x] Deploy en Vercel funcionando
- [x] Dark/Light Mode con next-themes
- [x] Onboarding automático (proyecto inicial + categorías)
- [x] Zod + drizzle-zod para validaciones
- [x] Feature Projects (selector, crear proyecto, cookies)
- [x] Tabla project_members (estructura para compartir proyectos)

---

## Pendiente

### ~~Fase 0: Dark/Light Mode~~ ✅

**Completado**

- [x] Instalar `next-themes`
- [x] Crear ThemeProvider
- [x] Configurar para seguir preferencia del sistema por defecto
- [x] Agregar toggle de tema en el header
- [x] Persistir preferencia del usuario en localStorage

---

### ~~Fase 1: Onboarding de Usuario~~ ✅

**Completado**

#### 1.1 Crear proyecto inicial automáticamente
- [x] Detectar si el usuario es nuevo (sin proyectos)
- [x] Crear proyecto default con nombre del mes actual (ej: "Enero 2025")
- [x] Asignar CLP como moneda base

#### 1.2 Copiar categorías del sistema al usuario
- [x] Copiar `category_templates` a `categories` para el nuevo usuario
- [x] Mantener grupos y colores

#### 1.3 Página de configuración inicial (opcional - pendiente)
- [ ] Wizard de bienvenida
- [ ] Configurar sueldo fijo (`default_income_amount`)
- [ ] Configurar límite de cuotas (`max_installment_amount`)
- [ ] Configurar débito disponible (`debit_available`)

---

### ~~Fase 2: Feature - Projects~~ ✅

**Completado**

- [x] `src/features/projects/`
  - [x] `types.ts` - Tipos de proyecto
  - [x] `schemas.ts` - Validaciones Zod
  - [x] `queries.ts` - Obtener proyectos del usuario
  - [x] `actions.ts` - Crear, actualizar, archivar proyecto
  - [x] `components.tsx` - Selector de proyecto, formulario

- [x] UI
  - [x] Selector de proyecto en el header
  - [x] Modal para crear nuevo proyecto (mes)
  - [ ] Página de configuración del proyecto (pendiente)

---

### ~~Fase 3: Feature - Categories~~ ✅

**Completado**

- [x] `src/features/categories/`
  - [x] `types.ts` - Tipos de categoría
  - [x] `schemas.ts` - Validaciones Zod
  - [x] `queries.ts` - CRUD de categorías, filtrar por tipo, agrupar
  - [x] `actions.ts` - Crear, editar, archivar, restaurar, eliminar
  - [x] `components.tsx` - Lista, selector, modal de edición

- [x] UI
  - [x] Lista de categorías con colores agrupadas
  - [x] Modal para crear/editar categoría con selector de colores
  - [x] Página `/dashboard/categories` con tabs activas/archivadas

---

### ~~Fase 4: Feature - Transactions~~ ✅

**Completado**

- [x] `src/features/transactions/`
  - [x] `types.ts` - Tipos de transacción
  - [x] `schemas.ts` - Validaciones Zod
  - [x] `queries.ts` - Listar, filtrar, buscar, resumen
  - [x] `actions.ts` - Crear, editar, eliminar, toggle pagado
  - [x] `components.tsx` - Lista, tabla, formulario modal

- [x] UI
  - [x] Página `/dashboard/transactions`
  - [x] Cards de resumen (ingresos, gastos, balance, pendientes)
  - [x] Tabla con checkbox de pagado
  - [x] Filtros por tipo y estado de pago
  - [x] Modal para crear/editar transacción
  - [x] Selector de categoría filtrado por tipo

---

### ~~Fase 5: Feature - Recurring Items~~ ✅

**Completado**

- [x] `src/features/recurring-items/`
  - [x] `types.ts` - Tipos de item recurrente
  - [x] `schemas.ts` - Validaciones Zod
  - [x] `queries.ts` - Listar items, resumen
  - [x] `actions.ts` - CRUD + generación de transacciones
  - [x] `components.tsx` - Lista, tabla, formulario modal

- [x] UI
  - [x] Página `/dashboard/recurring`
  - [x] Cards de resumen (ingresos/gastos fijos, balance)
  - [x] Tabla con items activos/inactivos
  - [x] Toggle para activar/desactivar
  - [x] Modal para crear/editar con selector de día del mes
  - [x] Botón para generar transacciones

- [x] Lógica de negocio
  - [x] `generateTransactionsFromRecurring()` - Crea transacciones desde items activos
  - [x] Marca transacciones con `recurringItemId`

---

### ~~Fase 6: Feature - Credits~~ ✅

**Completado**

- [x] `src/features/credits/`
  - [x] `types.ts` - Tipos con progreso de pago
  - [x] `schemas.ts` - Validaciones Zod
  - [x] `queries.ts` - Créditos con cálculo de cuotas pagadas
  - [x] `actions.ts` - CRUD + generación de cuotas
  - [x] `components.tsx` - Lista con barras de progreso

- [x] UI
  - [x] Página `/dashboard/credits`
  - [x] Cards de resumen (activos, deuda total, pagado, cuota mensual)
  - [x] Lista de créditos con progreso visual
  - [x] Detalle con info de cuotas y próximo pago
  - [x] Modal para crear/editar crédito
  - [x] Botón para generar todas las cuotas

- [x] Lógica de negocio
  - [x] Calcular cuotas pagadas automáticamente por fecha
  - [x] Generar transacciones de cuotas
  - [x] Marcar transacciones con `creditId`

---

### ~~Fase 7: Feature - Budgets~~ ✅

**Completado**

- [x] `src/features/budgets/`
  - [x] `types.ts` - Tipos con progreso de gasto
  - [x] `schemas.ts` - Validaciones Zod
  - [x] `queries.ts` - Presupuestos con cálculo de gasto
  - [x] `actions.ts` - CRUD + copiar del mes anterior
  - [x] `components.tsx` - Lista con barras de progreso

- [x] UI
  - [x] Página `/dashboard/budgets`
  - [x] Cards de resumen (presupuestado, gastado, disponible)
  - [x] Lista de presupuestos con barra de progreso colorida
  - [x] Indicador de sobre-presupuesto (rojo)
  - [x] Modal para crear/editar presupuesto
  - [x] Botón para copiar presupuestos del mes anterior

---

### ~~Fase 8: Feature - Savings~~ ✅

**Completado**

- [x] `src/features/savings/`
  - [x] `types.ts` - Tipos con progreso y movimientos
  - [x] `schemas.ts` - Validaciones Zod
  - [x] `queries.ts` - Fondos con cálculo de progreso mensual
  - [x] `actions.ts` - CRUD de fondos + movimientos
  - [x] `components.tsx` - Lista con barras de progreso

- [x] UI
  - [x] Página `/dashboard/savings`
  - [x] Cards de resumen (fondos activos, balance total, meta mensual, depositado)
  - [x] Lista de fondos con progreso hacia meta total y mensual
  - [x] Historial de últimos movimientos por fondo
  - [x] Modal para crear/editar fondo
  - [x] Modal para registrar depósito/retiro

- [x] Lógica de negocio
  - [x] Recalcular balance automáticamente al agregar movimientos
  - [x] Calcular progreso mensual (depósitos del mes vs meta)
  - [x] Validar retiros contra balance disponible

---

### Fase 9: Dashboard Completo

**Objetivo**: Resumen mensual con todos los datos.

- [ ] Cards con totales reales
  - [ ] Total ingresos del mes
  - [ ] Total gastos del mes
  - [ ] Balance disponible
  - [ ] Total ahorros

- [ ] Cálculo del balance según fórmula:
  ```
  Ingresos (sueldo + extras)
  - Gastos fijos
  - Cuotas créditos
  - Gastos variables
  = Ahorro total mes

  - Plan ahorro mensual
  - Débito disponible
  - Máximo cuotas
  = Resto disponible
  ```

- [ ] Gráficos
  - [ ] Distribución de gastos por categoría
  - [ ] Evolución mensual (línea de tiempo)

- [ ] Transacciones recientes (últimas 5-10)
- [ ] Estado de presupuestos

---

### Fase 10: Flujo de Inicio de Mes

**Objetivo**: Automatizar la precarga del nuevo mes.

- [ ] Detectar cambio de mes o primer acceso del mes
- [ ] Generar transacciones desde `recurring_items` con `is_paid=false`
- [ ] Generar cuotas de `credits` activos
- [ ] Copiar `budgets` del mes anterior (o crear nuevos)
- [ ] Registrar ingreso fijo (sueldo) si está configurado

---

### Fase 11: Accounts (Opcional)

**Objetivo**: Gestionar múltiples cuentas bancarias.

- [ ] CRUD de cuentas
- [ ] Asignar transacciones a cuentas
- [ ] Balance por cuenta

---

### Fase 12: Multi-moneda (Opcional)

**Objetivo**: Soporte para transacciones en diferentes monedas.

- [ ] Selector de moneda en transacciones
- [ ] Tipo de cambio
- [ ] Conversión automática a moneda base

---

### Fase 13: Proyectos Compartidos (Opcional)

**Objetivo**: Permitir compartir proyectos con otros usuarios.

**Completado (estructura):**
- [x] Tabla `project_members` con roles (owner, editor, viewer)
- [x] Queries usando membresía en lugar de userId
- [x] Creación automática de owner al crear proyecto

**Pendiente (UI):**
- [ ] Botón para invitar usuarios por email
- [ ] Modal de gestión de miembros del proyecto
- [ ] Lista de invitaciones pendientes (aceptar/rechazar)
- [ ] Indicador visual de rol en el proyecto
- [ ] Permisos según rol (viewer solo lectura, editor puede modificar)
- [ ] Notificaciones de invitación

---

## Orden Sugerido de Implementación

0. **Dark/Light Mode** - UX básica
1. **Onboarding** - Para que nuevos usuarios tengan datos
2. **Projects** - Selector de período
3. **Categories** - Base para transacciones
4. **Transactions** - Core de la app
5. **Recurring Items** - Automatizar gastos fijos
6. **Budgets** - Control de presupuestos
7. **Credits** - Gestión de deudas
8. **Savings** - Fondos de ahorro
9. **Dashboard** - Integrar todo
10. **Flujo de mes** - Automatización

---

## Notas Técnicas

### Patrón de Feature

Cada feature sigue esta estructura (escalar según necesidad):

```
src/features/[nombre]/
├── index.ts          # Barrel exports
├── types.ts          # TypeScript types
├── schemas.ts        # Zod validations
├── queries.ts        # Server queries
├── actions.ts        # Server actions
├── constants.ts      # Constants (si aplica)
└── components.tsx    # UI components (o carpeta)
```

### Componentes Shadcn a instalar

```bash
pnpm dlx shadcn@latest add table dialog form input select badge progress tabs
```

### Server Actions vs API Routes

- Usar **Server Actions** para mutaciones (crear, editar, eliminar)
- Usar **queries** directas en Server Components para lectura
- Solo usar API Routes si se necesita endpoint externo

---

## Próxima Sesión

Comenzar con:
1. **Fase 0: Dark/Light Mode** - Configurar next-themes y toggle
2. **Fase 1: Onboarding** - Crear proyecto y categorías automáticamente
3. **Fase 4: Transactions** - Es el core de la aplicación
