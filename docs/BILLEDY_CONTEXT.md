---
title: Contexto del Proyecto
description: Requerimientos funcionales y schema de base de datos de Billedy
version: 1.0.0
created: 2025-01-28
updated: 2025-01-28
author: Claude Code
tags: [requerimientos, schema, base-de-datos, drizzle]
---

# Billedy - Contexto del Proyecto

## Qué es Billedy

Aplicación web de gestión financiera personal que reemplaza una planilla Excel. Permite el seguimiento mensual de ingresos, egresos, deudas, ahorros y presupuesto.

## Stack Tecnológico

- **Framework**: Next.js 15+ con App Router
- **UI**: TailwindCSS + Shadcn/ui
- **ORM**: Drizzle ORM
- **Base de Datos**: PostgreSQL
- **Autenticación**: NextAuth.js con Google OAuth
- **Lenguaje**: TypeScript

## Variables de Entorno Requeridas

```env
# Base de datos PostgreSQL
DATABASE_URL=postgresql://user:password@host:5432/billedy

# NextAuth
AUTH_SECRET=tu-secret-generado
AUTH_GOOGLE_ID=tu-google-client-id
AUTH_GOOGLE_SECRET=tu-google-client-secret
NEXTAUTH_URL=http://localhost:3000
```

---

## Módulos Funcionales

### 1. Gastos Fijos Recurrentes
Items que se precargan automáticamente cada mes como transacciones pendientes:
- CAE, Agua, Luz (Prioritarios)
- Netflix, Spotify, Prime (Suscripciones)
- Github, UNICEF, Seguros (Otros)

### 2. Créditos/Préstamos
Créditos bancarios o hipotecarios que generan cuotas automáticas mensuales:
- Crédito Santander (termina Feb 2028)
- Banco Estado (termina Nov 2027)
- Pago terreno

### 3. Compras en Cuotas (Tarjeta)
Compras pagadas en cuotas con control de capacidad de endeudamiento:
- Total cuotas, cuota actual, cuotas restantes
- Fecha primera/última cuota
- Límite máximo mensual: $140,000

### 4. Presupuestos Variables
Categorías con monto asignado mensual que se va consumiendo:
- Comida: $320,000/mes
- Bencina: $90,000/mes
- Pellets: $110,000/mes
- Veterinario: $48,000/mes

### 5. Fondos de Ahorro
Objetivos de ahorro separados con depósitos mensuales:
- Fondo emergencia: $100,000/mes (Cuenta ahorro)
- Fondo inversión #1: $50,000/mes (Depósito plazo)
- Fondo inversión #2: $50,000/mes (Fintual)
- Compra dólares: $10,000/mes (Cuenta USD)

### 6. Balance Mensual
Cálculo automático:
```
Ingresos (sueldo fijo + extras)
- Gastos fijos
- Cuotas créditos
- Gastos variables (presupuestos)
= Ahorro total mes

- Plan ahorro mensual
- Débito disponible
- Máximo cuotas
= Resto disponible
```

---

## Schema de Base de Datos

### Convención de Nombres
- **Prefijo**: `n1n4_`
- **Formato**: Plural, snake_case

### Tablas (16 total)

#### Core App (12 tablas)

##### n1n4_currencies
```sql
id              UUID PRIMARY KEY
code            VARCHAR UNIQUE (ISO 4217: USD, EUR, CLP)
symbol          VARCHAR ($, €)
name            VARCHAR
decimal_separator    VARCHAR ("." o ",")
thousands_separator  VARCHAR (".", ",", "")
decimal_places  INTEGER (0, 2)
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

##### n1n4_category_templates
Categorías base del sistema que se copian al crear usuario.
```sql
id              UUID PRIMARY KEY
name            VARCHAR
type            ENUM (income, expense)
color           VARCHAR
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

##### n1n4_categories
Categorías personalizadas por usuario.
```sql
id              UUID PRIMARY KEY
user_id         UUID FK → users
name            VARCHAR
type            ENUM (income, expense)
group           VARCHAR NULLABLE (Prioritarios, Suscripciones, Movilización, Otros)
color           VARCHAR
is_archived     BOOLEAN DEFAULT false
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

##### n1n4_projects
Proyectos financieros (equivalente a un "balance" o período).
```sql
id                      UUID PRIMARY KEY
user_id                 UUID FK → users
name                    VARCHAR
description             VARCHAR
base_currency_id        UUID FK → currencies
currency                VARCHAR (código: CLP, USD)
default_income_amount   DECIMAL NULLABLE (sueldo fijo)
max_installment_amount  DECIMAL NULLABLE (límite cuotas: $140,000)
debit_available         DECIMAL NULLABLE (débito disponible: $210,000)
is_archived             BOOLEAN DEFAULT false
created_at              TIMESTAMP
updated_at              TIMESTAMP
```

##### n1n4_accounts
Cuentas bancarias, efectivo, tarjetas.
```sql
id              UUID PRIMARY KEY
user_id         UUID FK → users
name            VARCHAR (Primera cuenta Santander, Caja chica)
type            ENUM (checking, savings, cash, credit_card)
bank_name       VARCHAR NULLABLE (Santander, Banco Estado)
currency_id     UUID FK → currencies
initial_balance DECIMAL
current_balance DECIMAL
is_default      BOOLEAN DEFAULT false
is_archived     BOOLEAN DEFAULT false
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

##### n1n4_transactions
Transacciones (ingresos/egresos) con soporte multi-moneda.
```sql
id                  UUID PRIMARY KEY
user_id             UUID FK → users
project_id          UUID FK → projects
category_id         UUID FK → categories
account_id          UUID NULLABLE FK → accounts
type                ENUM (income, expense)
original_amount     DECIMAL
original_currency   VARCHAR
original_currency_id UUID FK → currencies
base_amount         DECIMAL
base_currency       VARCHAR
base_currency_id    UUID FK → currencies
exchange_rate       DECIMAL
date                DATE
description         VARCHAR
notes               TEXT NULLABLE
is_paid             BOOLEAN DEFAULT false
paid_at             TIMESTAMP NULLABLE
credit_id           UUID NULLABLE FK → credits
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

##### n1n4_credits
Créditos/préstamos que generan cuotas automáticas.
```sql
id                      UUID PRIMARY KEY
user_id                 UUID FK → users
project_id              UUID FK → projects
category_id             UUID FK → categories
name                    VARCHAR (Crédito Santander, Banco Estado)
original_principal_amount DECIMAL
original_total_amount   DECIMAL
original_currency       VARCHAR
original_currency_id    UUID FK → currencies
base_principal_amount   DECIMAL
base_total_amount       DECIMAL
base_currency           VARCHAR
base_currency_id        UUID FK → currencies
exchange_rate           DECIMAL
installments            INTEGER (número de cuotas)
installment_amount      DECIMAL (monto por cuota)
start_date              DATE
end_date                DATE
frequency               ENUM (monthly, biweekly, weekly)
description             VARCHAR
notes                   TEXT NULLABLE
is_archived             BOOLEAN DEFAULT false
created_at              TIMESTAMP
updated_at              TIMESTAMP
```

##### n1n4_budgets
Presupuesto mensual por categoría.
```sql
id              UUID PRIMARY KEY
project_id      UUID FK → projects
category_id     UUID FK → categories
year            INTEGER
month           INTEGER (1-12)
amount          DECIMAL
created_at      TIMESTAMP
updated_at      TIMESTAMP

UNIQUE(project_id, category_id, year, month)
```

##### n1n4_savings_funds
Fondos de ahorro con objetivo y tipo.
```sql
id              UUID PRIMARY KEY
user_id         UUID FK → users
project_id      UUID NULLABLE FK → projects
name            VARCHAR (Fondo emergencia, Fondo inversión)
type            ENUM (emergency, investment, goal, other)
account_type    VARCHAR (Cuenta ahorro, Depósito plazo, Fintual)
currency_id     UUID FK → currencies
target_amount   DECIMAL NULLABLE (meta de ahorro)
monthly_target  DECIMAL (cuánto depositar cada mes)
current_balance DECIMAL DEFAULT 0
is_archived     BOOLEAN DEFAULT false
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

##### n1n4_savings_movements
Depósitos y retiros de fondos de ahorro.
```sql
id              UUID PRIMARY KEY
savings_fund_id UUID FK → savings_funds
type            ENUM (deposit, withdrawal)
amount          DECIMAL
date            DATE
description     VARCHAR NULLABLE
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

##### n1n4_templates
Plantillas de transacciones reutilizables.
```sql
id              UUID PRIMARY KEY
user_id         UUID FK → users
name            VARCHAR
description     VARCHAR
is_archived     BOOLEAN DEFAULT false
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

##### n1n4_template_items
Items de cada plantilla.
```sql
id              UUID PRIMARY KEY
template_id     UUID FK → templates
category_id     UUID FK → categories
type            ENUM (income, expense)
amount          DECIMAL
currency        VARCHAR
currency_id     UUID FK → currencies
description     VARCHAR
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### Auth (4 tablas - NextAuth standard)

##### n1n4_users
```sql
id              UUID PRIMARY KEY
name            VARCHAR
email           VARCHAR UNIQUE
email_verified  TIMESTAMP NULLABLE
image           VARCHAR NULLABLE
is_active       BOOLEAN DEFAULT true
last_login_at   TIMESTAMP NULLABLE
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

##### n1n4_oauth_accounts
```sql
id                  UUID PRIMARY KEY
user_id             UUID FK → users
type                VARCHAR
provider            VARCHAR (google)
provider_account_id VARCHAR
refresh_token       TEXT NULLABLE
access_token        TEXT NULLABLE
expires_at          INTEGER NULLABLE
token_type          VARCHAR NULLABLE
scope               VARCHAR NULLABLE
id_token            TEXT NULLABLE
session_state       VARCHAR NULLABLE

UNIQUE(provider, provider_account_id)
```

##### n1n4_sessions
```sql
id              UUID PRIMARY KEY
session_token   VARCHAR UNIQUE
user_id         UUID FK → users
expires         TIMESTAMP
```

##### n1n4_verification_tokens
```sql
identifier      VARCHAR
token           VARCHAR
expires         TIMESTAMP

PRIMARY KEY(identifier, token)
```

---

## Índices Recomendados

```sql
-- Users
CREATE UNIQUE INDEX idx_users_email ON n1n4_users(email);

-- Currencies
CREATE UNIQUE INDEX idx_currencies_code ON n1n4_currencies(code);

-- Transactions
CREATE INDEX idx_transactions_user_date ON n1n4_transactions(user_id, date DESC);
CREATE INDEX idx_transactions_project ON n1n4_transactions(project_id);
CREATE INDEX idx_transactions_credit ON n1n4_transactions(credit_id);
CREATE INDEX idx_transactions_category ON n1n4_transactions(category_id);

-- Credits
CREATE INDEX idx_credits_user ON n1n4_credits(user_id);
CREATE INDEX idx_credits_project ON n1n4_credits(project_id);

-- Projects
CREATE INDEX idx_projects_user ON n1n4_projects(user_id);

-- Categories
CREATE INDEX idx_categories_user ON n1n4_categories(user_id);

-- Budgets
CREATE INDEX idx_budgets_project_month ON n1n4_budgets(project_id, year, month);

-- Savings
CREATE INDEX idx_savings_funds_user ON n1n4_savings_funds(user_id);
CREATE INDEX idx_savings_movements_fund ON n1n4_savings_movements(savings_fund_id);

-- NextAuth
CREATE UNIQUE INDEX idx_oauth_accounts_provider ON n1n4_oauth_accounts(provider, provider_account_id);
CREATE UNIQUE INDEX idx_sessions_token ON n1n4_sessions(session_token);
```

---

## Flujo de Inicio de Mes

1. Se generan `transactions` desde `credits` activos (cuotas del mes)
2. Se copian/crean `budgets` del mes (o desde mes anterior)
3. Se registra transacción de ingreso fijo (sueldo) automáticamente

## Flujo Durante el Mes

- Usuario marca gastos como pagados (`is_paid=true`)
- Usuario agrega gastos variables (Comida, Bencina, Otros)
- Usuario registra ingresos extras (bonos, ventas)
- Usuario registra depósitos a fondos de ahorro

## Cálculo del Balance

```typescript
const ingresos = project.defaultIncomeAmount + sumExtras;
const cuotasCreditos = sum(transactions where credit_id != null);
const gastosVariables = sum(transactions where category in presupuestos);

const totalEgresos = cuotasCreditos + gastosVariables;
const ahorroTotalMes = ingresos - totalEgresos;

const planAhorro = sum(savings_funds.monthly_target);
const debitoDisponible = project.debit_available;
const maxCuotas = project.max_installment_amount;

const restoDisponible = ahorroTotalMes - planAhorro - debitoDisponible - maxCuotas;
```

---

## Próximos Pasos de Implementación

1. [ ] Configurar Drizzle ORM con PostgreSQL
2. [ ] Crear schemas de Drizzle para las 16 tablas
3. [ ] Generar migraciones iniciales
4. [ ] Configurar NextAuth con Google OAuth
5. [ ] Crear adapter de NextAuth para Drizzle
6. [ ] Implementar seed de currencies y category_templates
7. [ ] Crear API routes para CRUD de cada entidad
8. [ ] Implementar UI con Shadcn/ui

---

## Estructura de Carpetas Sugerida

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx (resumen mensual)
│   │   ├── transactions/
│   │   ├── credits/
│   │   ├── budgets/
│   │   ├── savings/
│   │   └── settings/
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   ├── transactions/
│   │   ├── credits/
│   │   ├── budgets/
│   │   └── savings/
│   ├── layout.tsx
│   └── page.tsx (landing)
├── components/
│   ├── ui/ (shadcn)
│   ├── forms/
│   └── dashboard/
├── lib/
│   ├── db/
│   │   ├── index.ts (drizzle client)
│   │   ├── schema/ (tablas)
│   │   └── migrations/
│   ├── auth.ts (nextauth config)
│   └── utils.ts
├── types/
└── hooks/
```

---

## Datos de Ejemplo (Seed)

### Currencies
```typescript
[
  { code: 'CLP', symbol: '$', name: 'Peso Chileno', decimalSeparator: '.', thousandsSeparator: '.', decimalPlaces: 0 },
  { code: 'USD', symbol: 'US$', name: 'Dólar', decimalSeparator: '.', thousandsSeparator: ',', decimalPlaces: 2 },
  { code: 'EUR', symbol: '€', name: 'Euro', decimalSeparator: ',', thousandsSeparator: '.', decimalPlaces: 2 },
]
```

### Category Templates
```typescript
[
  // Gastos - Prioritarios
  { name: 'CAE', type: 'expense', group: 'Prioritarios', color: '#ef4444' },
  { name: 'Agua', type: 'expense', group: 'Prioritarios', color: '#3b82f6' },
  { name: 'Luz', type: 'expense', group: 'Prioritarios', color: '#eab308' },
  { name: 'Gas', type: 'expense', group: 'Prioritarios', color: '#f97316' },
  { name: 'Internet', type: 'expense', group: 'Prioritarios', color: '#8b5cf6' },

  // Gastos - Suscripciones
  { name: 'Netflix', type: 'expense', group: 'Suscripciones', color: '#dc2626' },
  { name: 'Spotify', type: 'expense', group: 'Suscripciones', color: '#22c55e' },
  { name: 'Prime Video', type: 'expense', group: 'Suscripciones', color: '#0ea5e9' },

  // Gastos - Presupuestos
  { name: 'Comida', type: 'expense', group: 'Presupuestos', color: '#84cc16' },
  { name: 'Bencina', type: 'expense', group: 'Presupuestos', color: '#64748b' },
  { name: 'Veterinario', type: 'expense', group: 'Presupuestos', color: '#ec4899' },

  // Gastos - Otros
  { name: 'Github', type: 'expense', group: 'Otros', color: '#171717' },
  { name: 'Seguros', type: 'expense', group: 'Otros', color: '#0891b2' },

  // Ingresos
  { name: 'Sueldo', type: 'income', color: '#22c55e' },
  { name: 'Bono', type: 'income', color: '#10b981' },
  { name: 'Venta', type: 'income', color: '#14b8a6' },
]
```
