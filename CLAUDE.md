# Billedy - Instrucciones para Claude

## Idioma

El idioma predeterminado para la comunicación con Claude Code es **español**. Todas las respuestas, comentarios y documentación deben escribirse en español a menos que se indique lo contrario.

## Contexto

Este es **Billedy**, una app web de finanzas personales en Next.js 15+ con App Router. El objetivo es reemplazar una planilla Excel de gestión financiera.

**Documentación**:
- `docs/BILLEDY_CONTEXT.md` - Schema de BD y requerimientos funcionales
- `docs/ARCHITECTURE.md` - Arquitectura feature-based y convenciones
- `docs/ROADMAP.md` - Plan de desarrollo y pendientes

## Stack

- Next.js 15+ (App Router)
- TypeScript
- TailwindCSS + Shadcn/ui
- Drizzle ORM + PostgreSQL
- NextAuth.js (Google OAuth)

## Arquitectura Feature-Based

Usamos arquitectura feature-based en `src/features/`. Cada feature contiene todo lo necesario para funcionar.

**Regla de oro**: Empezar con archivos simples, escalar a carpetas cuando superen ~150-200 líneas o tengan 3+ elementos.

### Estructura de una Feature

```
src/features/transactions/
├── index.ts          # Barrel exports
├── components.tsx    # Componentes (escalar a carpeta si crece)
├── actions.ts        # Server actions ('use server')
├── queries.ts        # Server queries
├── hooks.ts          # Hooks específicos
├── schemas.ts        # Validaciones Zod
├── types.ts          # TypeScript types
└── constants.ts      # Constantes
```

### Features del Proyecto

- `transactions` - Ingresos y egresos
- `credits` - Créditos/préstamos con cuotas
- `budgets` - Presupuestos mensuales
- `savings` - Fondos de ahorro
- `recurring-items` - Gastos fijos recurrentes
- `categories` - Categorías
- `accounts` - Cuentas bancarias
- `projects` - Proyectos/períodos

## Diseño

### Mobile-First
El uso principal de esta app es a través del teléfono. **Siempre usar mobile-first** como enfoque de diseño:
- Diseñar primero para pantallas móviles (< 768px)
- Escalar hacia arriba con breakpoints (`md:`, `lg:`, `xl:`)
- Priorizar touch targets grandes (mínimo 44x44px)
- Optimizar para uso con una mano

## Convenciones

### Nombrado de Archivos
| Tipo | Formato | Ejemplo |
|------|---------|---------|
| Features | kebab-case/ | `recurring-items/` |
| Componentes | kebab-case.tsx | `transaction-form.tsx` |
| Actions | kebab-case.ts | `create-transaction.ts` |
| Hooks | use-kebab-case.ts | `use-filters.ts` |

### Nombrado de Código
| Tipo | Formato | Ejemplo |
|------|---------|---------|
| Componentes | PascalCase | `TransactionForm` |
| Funciones | camelCase | `createTransaction` |
| Constantes | UPPER_SNAKE_CASE | `MAX_AMOUNT` |
| Types | PascalCase | `Transaction` |

### Base de Datos
- Prefijo: `n1n4_`
- Formato: snake_case, plural
- Ejemplo: `n1n4_transactions`, `n1n4_savings_funds`

### Rutas API
- Usar Route Handlers de Next.js 15
- Formato REST: `/api/[recurso]`
- Validación con Zod

## Estructura de Carpetas

```
src/
├── app/                 # Next.js App Router
├── features/            # Módulos feature-based
├── components/          # Componentes compartidos
│   └── ui/              # Shadcn/ui
├── lib/
│   ├── db/              # Drizzle (schema/, migrations/)
│   └── auth.ts          # NextAuth config
├── hooks/               # Hooks globales
└── types/               # Tipos globales
```

## Variables de Entorno

```env
DATABASE_URL=postgresql://...
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
```

## Comandos Útiles

```bash
# Generar migración
npx drizzle-kit generate

# Aplicar migraciones
npx drizzle-kit migrate

# Abrir Drizzle Studio
npx drizzle-kit studio

# Seed inicial
npx tsx src/lib/db/seed.ts
```
