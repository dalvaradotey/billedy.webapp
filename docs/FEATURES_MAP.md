---
title: Mapa de Features
description: Documentación de cada feature, sus componentes y lógica de negocio
version: 1.0.0
created: 2025-02-02
updated: 2025-02-02
author: Claude Code
tags: [features, componentes, lógica, documentación]
---

# Billedy - Mapa de Features

## Visión General

```
┌─────────────────────────────────────────────────────────────────┐
│                          BILLEDY                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  PROJECTS   │  │  ACCOUNTS   │  │ CATEGORIES  │              │
│  │  (períodos) │  │  (cuentas)  │  │ (tipos)     │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          │                                       │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    TRANSACTIONS                             │  │
│  │              (core - ingresos y egresos)                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│         │                │                │                      │
│         ▼                ▼                ▼                      │
│  ┌───────────┐    ┌───────────┐    ┌───────────┐               │
│  │  CREDITS  │    │  BUDGETS  │    │ CARD-PURCH│               │
│  │ (cuotas)  │    │ (límites) │    │  (cuotas) │               │
│  └───────────┘    └───────────┘    └───────────┘               │
│         │                │                │                      │
│         ▼                ▼                ▼                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    BILLING-CYCLES                           │  │
│  │              (consolidación mensual)                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌───────────┐    ┌───────────┐    ┌───────────┐               │
│  │  SAVINGS  │    │ TEMPLATES │    │ ENTITIES  │               │
│  │ (ahorro)  │    │(plantillas)│    │ (bancos)  │               │
│  └───────────┘    └───────────┘    └───────────┘               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. TRANSACTIONS (Core)

### Propósito
Gestión de ingresos y egresos. Es el módulo central de la aplicación.

### Modelo de Datos
```typescript
Transaction {
  id: UUID
  userId: UUID
  projectId: UUID
  categoryId: UUID
  accountId?: UUID
  entityId?: UUID
  type: 'income' | 'expense'
  originalAmount: Decimal
  originalCurrencyId: UUID
  baseAmount: Decimal
  baseCurrencyId: UUID
  exchangeRate: Decimal
  date: Date
  description: string
  notes?: string
  isPaid: boolean
  paidAt?: DateTime
  creditId?: UUID          // Si viene de crédito
  budgetId?: UUID          // Si afecta presupuesto
  cardPurchaseId?: UUID    // Si viene de compra en cuotas
  linkedTransactionId?: UUID // Para transferencias
  paidByTransferId?: UUID  // Si fue pagado por transferencia
}
```

### Componentes Actuales
| Componente | Líneas | Función |
|------------|--------|---------|
| TransactionsPage | ~200 | Página principal con filtros y lista |
| TransactionList | ~150 | Lista de transacciones |
| TransactionCard | ~100 | Card de transacción individual |
| TransactionForm | ~300 | Formulario crear/editar |
| TransactionFilters | ~150 | Filtros de fecha, tipo, estado |
| TransactionSummary | ~100 | Cards de resumen (ingresos/gastos/balance) |
| TransferDialog | ~200 | Diálogo para transferencias |
| PayCreditCardDialog | ~250 | Diálogo para pago de tarjeta |
| TransactionTableSkeleton | ~50 | Skeleton de carga |

### Actions
| Action | Función |
|--------|---------|
| createTransaction | Crear nueva transacción |
| updateTransaction | Actualizar transacción |
| deleteTransaction | Eliminar transacción |
| togglePaid | Cambiar estado pagado |
| createTransfer | Crear transferencia entre cuentas |
| payCreditCard | Pagar transacciones de tarjeta |

### Queries
| Query | Función |
|-------|---------|
| getTransactions | Listar transacciones con filtros |
| getTransactionsSummary | Obtener totales del período |
| getUnpaidCreditCardTransactions | Transacciones pendientes de pago |

### Relaciones
- **Depende de**: Projects, Categories, Accounts, Entities, Currencies
- **Usado por**: Credits, Budgets, CardPurchases, BillingCycles

---

## 2. ACCOUNTS

### Propósito
Gestión de cuentas bancarias, efectivo y tarjetas de crédito.

### Modelo de Datos
```typescript
Account {
  id: UUID
  userId: UUID
  name: string
  type: 'checking' | 'savings' | 'cash' | 'credit_card'
  bankName?: string
  entityId?: UUID
  currency: string
  initialBalance: Decimal
  currentBalance: Decimal
  isDefault: boolean
  isArchived: boolean
}
```

### Componentes Actuales
| Componente | Función |
|------------|---------|
| AccountsPage | Página principal |
| AccountList | Lista de cuentas por tipo |
| AccountCard | Card con balance y acciones |
| AccountForm | Formulario crear/editar |
| AccountCardSkeleton | Skeleton de carga |

### Actions
| Action | Función |
|--------|---------|
| createAccount | Crear cuenta |
| updateAccount | Actualizar cuenta |
| deleteAccount | Eliminar cuenta |
| archiveAccount | Archivar cuenta |
| restoreAccount | Restaurar cuenta |
| recalculateBalance | Recalcular balance desde transacciones |

### Lógica de Negocio
- Balance se actualiza automáticamente con transacciones
- Una cuenta puede ser default (usada por defecto en forms)
- Tarjetas de crédito tienen lógica especial de pago

---

## 3. CREDITS

### Propósito
Gestión de créditos y préstamos con cuotas automáticas.

### Modelo de Datos
```typescript
Credit {
  id: UUID
  userId: UUID
  projectId: UUID
  categoryId: UUID
  entityId?: UUID
  accountId?: UUID
  name: string
  originalPrincipalAmount: Decimal
  originalTotalAmount: Decimal
  installments: number
  installmentAmount: Decimal
  startDate: Date
  endDate: Date
  frequency: 'monthly' | 'biweekly' | 'weekly'
  isArchived: boolean
}
```

### Componentes Actuales
| Componente | Función |
|------------|---------|
| CreditsPage | Página principal con resumen |
| CreditList | Lista de créditos activos |
| CreditCard | Card con progreso de pago |
| CreditForm | Formulario crear/editar |
| CreditInstallments | Vista de cuotas |

### Actions
| Action | Función |
|--------|---------|
| createCredit | Crear crédito y generar cuotas |
| updateCredit | Actualizar crédito |
| deleteCredit | Eliminar crédito y sus cuotas |
| archiveCredit | Archivar crédito |
| generateInstallments | Generar transacciones de cuotas |

### Lógica de Negocio
- Al crear crédito, se generan N transacciones automáticas
- Cada cuota es una transacción con `creditId`
- El progreso se calcula por cuotas pagadas vs totales
- Frecuencia determina fechas de cada cuota

---

## 4. BUDGETS

### Propósito
Presupuestos mensuales por categoría con tracking de gasto.

### Modelo de Datos
```typescript
Budget {
  id: UUID
  projectId: UUID
  categoryId: UUID
  year: number
  month: number
  amount: Decimal
}
```

### Componentes Actuales
| Componente | Función |
|------------|---------|
| BudgetsPage | Página principal |
| BudgetList | Lista con barras de progreso |
| BudgetCard | Card con gasto vs presupuesto |
| BudgetForm | Formulario crear/editar |

### Actions
| Action | Función |
|--------|---------|
| createBudget | Crear presupuesto |
| updateBudget | Actualizar presupuesto |
| deleteBudget | Eliminar presupuesto |
| copyFromPreviousMonth | Copiar presupuestos del mes anterior |

### Lógica de Negocio
- Único por (projectId, categoryId, year, month)
- El gasto se calcula sumando transacciones de la categoría
- Progreso = (gastado / presupuestado) * 100
- Rojo si supera 100%

---

## 5. SAVINGS

### Propósito
Fondos de ahorro con metas y movimientos.

### Modelo de Datos
```typescript
SavingsFund {
  id: UUID
  userId: UUID
  projectId?: UUID
  name: string
  type: 'emergency' | 'investment' | 'goal' | 'other'
  accountType: string
  currencyId: UUID
  targetAmount?: Decimal
  monthlyTarget: Decimal
  currentBalance: Decimal
  isArchived: boolean
}

SavingsMovement {
  id: UUID
  savingsFundId: UUID
  type: 'deposit' | 'withdrawal'
  amount: Decimal
  date: Date
  description?: string
}
```

### Componentes Actuales
| Componente | Función |
|------------|---------|
| SavingsPage | Página principal con resumen |
| SavingsFundList | Lista de fondos |
| SavingsFundCard | Card con progreso hacia meta |
| SavingsFundForm | Formulario crear/editar fondo |
| SavingsMovementForm | Formulario depósito/retiro |
| SavingsMovementHistory | Historial de movimientos |

### Actions
| Action | Función |
|--------|---------|
| createSavingsFund | Crear fondo |
| updateSavingsFund | Actualizar fondo |
| deleteSavingsFund | Eliminar fondo |
| createMovement | Registrar depósito/retiro |
| deleteMovement | Eliminar movimiento |

### Lógica de Negocio
- Balance se actualiza con cada movimiento
- Retiros validados contra balance disponible
- Progreso total = currentBalance / targetAmount
- Progreso mensual = depósitos del mes / monthlyTarget

---

## 6. CARD-PURCHASES

### Propósito
Compras en cuotas con tarjeta de crédito.

### Modelo de Datos
```typescript
CardPurchase {
  id: UUID
  userId: UUID
  projectId: UUID
  accountId: UUID          // Tarjeta de crédito
  categoryId: UUID
  entityId?: UUID
  storeName?: string
  description: string
  totalAmount: Decimal
  installments: number
  installmentAmount: Decimal
  firstInstallmentDate: Date
  lastInstallmentDate: Date
  currentInstallment: number
  isArchived: boolean
}
```

### Componentes Actuales
| Componente | Función |
|------------|---------|
| CardPurchasesPage | Página principal |
| CardPurchaseList | Lista de compras |
| CardPurchaseCard | Card con cuotas pagadas |
| CardPurchaseForm | Formulario crear/editar |
| CardPurchaseInstallments | Vista de cuotas |

### Actions
| Action | Función |
|--------|---------|
| createCardPurchase | Crear compra y generar cuotas |
| updateCardPurchase | Actualizar compra |
| deleteCardPurchase | Eliminar compra y cuotas |

### Lógica de Negocio
- Genera N transacciones automáticas (cuotas)
- Cada cuota tiene `cardPurchaseId`
- Cuota actual = meses desde primera cuota
- Integra con Transactions para pago

---

## 7. BILLING-CYCLES

### Propósito
Ciclos de facturación mensuales para consolidar finanzas.

### Modelo de Datos
```typescript
BillingCycle {
  id: UUID
  projectId: UUID
  name: string
  startDate: Date
  endDate: Date
  status: 'open' | 'closed'
}

BillingCycleBudget {
  id: UUID
  billingCycleId: UUID
  budgetId: UUID
  allocatedAmount: Decimal
}
```

### Componentes Actuales
| Componente | Función |
|------------|---------|
| BillingCyclesPage | Página principal |
| BillingCycleList | Lista de ciclos |
| BillingCycleCard | Card con estado y totales |
| BillingCycleForm | Formulario crear/editar |
| BillingCycleBudgets | Asignación de presupuestos |

### Actions
| Action | Función |
|--------|---------|
| createBillingCycle | Crear ciclo |
| updateBillingCycle | Actualizar ciclo |
| closeBillingCycle | Cerrar ciclo |
| openBillingCycle | Reabrir ciclo |
| assignBudgets | Asignar presupuestos al ciclo |

### Lógica de Negocio
- Agrupa transacciones por período
- Permite cerrar período para reportes
- Asigna presupuestos específicos al ciclo

---

## 8. TEMPLATES

### Propósito
Plantillas de transacciones recurrentes.

### Modelo de Datos
```typescript
Template {
  id: UUID
  userId: UUID
  name: string
  description: string
  isArchived: boolean
}

TemplateItem {
  id: UUID
  templateId: UUID
  categoryId: UUID
  type: 'income' | 'expense'
  amount: Decimal
  currencyId: UUID
  description: string
}
```

### Componentes Actuales
| Componente | Función |
|------------|---------|
| TemplatesPage | Página principal |
| TemplateList | Lista de plantillas |
| TemplateCard | Card con items |
| TemplateForm | Formulario crear/editar |
| TemplateItemForm | Formulario de items |

### Actions
| Action | Función |
|--------|---------|
| createTemplate | Crear plantilla |
| updateTemplate | Actualizar plantilla |
| deleteTemplate | Eliminar plantilla |
| addTemplateItem | Agregar item |
| updateTemplateItem | Actualizar item |
| deleteTemplateItem | Eliminar item |
| applyTemplate | Crear transacciones desde plantilla |

### Lógica de Negocio
- Permite definir gastos/ingresos recurrentes
- Al aplicar, crea transacciones reales
- Útil para inicio de mes

---

## 9. CATEGORIES

### Propósito
Categorías de transacciones con colores y grupos.

### Modelo de Datos
```typescript
Category {
  id: UUID
  userId: UUID
  projectId: UUID
  name: string
  type: 'income' | 'expense'
  group?: string
  color: string
  isArchived: boolean
}
```

### Componentes Actuales
| Componente | Función |
|------------|---------|
| CategoriesPage | Página principal con tabs |
| CategoryList | Lista agrupada por tipo |
| CategoryCard | Card con color |
| CategoryForm | Formulario crear/editar |
| CategorySelector | Selector para forms |

### Actions
| Action | Función |
|--------|---------|
| createCategory | Crear categoría |
| updateCategory | Actualizar categoría |
| deleteCategory | Eliminar categoría |
| archiveCategory | Archivar categoría |
| restoreCategory | Restaurar categoría |

---

## 10. PROJECTS

### Propósito
Proyectos/períodos financieros (típicamente mensuales).

### Modelo de Datos
```typescript
Project {
  id: UUID
  userId: UUID
  name: string
  description?: string
  baseCurrencyId: UUID
  defaultIncomeAmount?: Decimal
  maxInstallmentAmount?: Decimal
  debitAvailable?: Decimal
  isArchived: boolean
}

ProjectMember {
  id: UUID
  projectId: UUID
  userId: UUID
  role: 'owner' | 'editor' | 'viewer'
}
```

### Componentes Actuales
| Componente | Función |
|------------|---------|
| ProjectSelector | Selector en header |
| ProjectForm | Formulario crear/editar |

### Actions
| Action | Función |
|--------|---------|
| createProject | Crear proyecto |
| updateProject | Actualizar proyecto |
| archiveProject | Archivar proyecto |
| setCurrentProject | Cambiar proyecto activo (cookie) |

---

## 11. ENTITIES

### Propósito
Entidades globales (bancos, tiendas, servicios).

### Modelo de Datos
```typescript
Entity {
  id: UUID
  name: string
  type: 'bank' | 'credit_card' | 'supermarket' | ...
  logo?: string
  isGlobal: boolean
  createdByUserId?: UUID
}
```

### Componentes Actuales
Solo en admin: `EntitiesList`, `EntityForm`

### Lógica de Negocio
- Entidades globales visibles para todos
- Usuarios pueden crear entidades propias
- Usadas en Accounts, Transactions, Credits, CardPurchases

---

## 12. ONBOARDING

### Propósito
Inicialización automática de nuevos usuarios.

### Lógica
1. Detecta usuario sin proyectos
2. Crea proyecto default (mes actual)
3. Copia categorías del sistema al usuario

### Actions
| Action | Función |
|--------|---------|
| initializeUserData | Crear proyecto y categorías iniciales |
| hasCompletedOnboarding | Verificar si ya tiene datos |

---

## Flujos de Usuario Principales

### Flujo: Registrar Transacción
```
1. Usuario abre /dashboard/transactions
2. Click en "Nueva transacción"
3. Formulario con campos:
   - Tipo (ingreso/egreso)
   - Monto
   - Categoría (filtrada por tipo)
   - Cuenta (opcional)
   - Fecha
   - Descripción
4. Guardar → createTransaction
5. Lista actualizada con revalidatePath
```

### Flujo: Crear Crédito
```
1. Usuario abre /dashboard/credits
2. Click en "Nuevo crédito"
3. Formulario con:
   - Nombre
   - Monto total
   - Número de cuotas
   - Fecha inicio
   - Frecuencia
4. Guardar → createCredit + generateInstallments
5. Se crean N transacciones automáticas
```

### Flujo: Pagar Tarjeta
```
1. Usuario en /dashboard/transactions
2. Click en "Pagar tarjeta"
3. Selecciona tarjeta
4. Ve transacciones pendientes
5. Selecciona cuáles pagar
6. Confirma → payCreditCard
7. Transacciones marcadas como pagadas
```

### Flujo: Inicio de Mes
```
1. Usuario accede al sistema
2. Sistema detecta nuevo mes
3. Muestra opción de:
   - Crear nuevo proyecto
   - Copiar presupuestos anteriores
   - Aplicar plantilla de gastos fijos
4. Usuario confirma
5. Sistema genera datos iniciales
```
