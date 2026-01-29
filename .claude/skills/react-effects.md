---
name: react-effects
description: Guía para el uso correcto de useEffect en React/Next.js. Úsalo cuando necesites revisar efectos, auditar componentes por anti-patrones de useEffect, optimizar renders o determinar si un efecto es necesario.
allowed-tools: Read, Grep, Glob
---

# React Effects Guidelines

Guía para el uso correcto de `useEffect` en componentes React de este proyecto.

**Referencia principal**: https://react.dev/learn/you-might-not-need-an-effect

## Árbol de decisión rápido

Antes de agregar `useEffect`, pregúntate:

1. **¿Puedo calcular esto durante el render?** → Derivarlo, no almacenar + sincronizar
2. **¿Estoy reseteando estado cuando una prop cambia?** → Usar prop `key` en su lugar
3. **¿Esto se dispara por un evento del usuario?** → Ponerlo en el event handler
4. **¿Estoy sincronizando con un sistema externo?** → Effect es apropiado

## Usos legítimos de useEffect

- **Manipulación DOM**: focus, scroll, medir elementos
- **Lifecycle de widgets externos**: charts, librerías no-React
- **Suscripciones a APIs del browser**: ResizeObserver, IntersectionObserver
- **Data fetching** en mount o cambio de prop (aunque preferir Server Components en Next.js)
- **Event listeners globales**: window, document

## Anti-patrones comunes

### 1. Estado derivado almacenado separadamente

```tsx
// ❌ MALO: Estado derivado sincronizado con effect
const [fullName, setFullName] = useState('');
useEffect(() => setFullName(first + ' ' + last), [first, last]);

// ✅ BUENO: Calcular durante render
const fullName = first + ' ' + last;
```

### 2. Lógica de evento en effect

```tsx
// ❌ MALO: Lógica de evento disparada por estado
useEffect(() => {
  if (isOpen) doSomething();
}, [isOpen]);

// ✅ BUENO: En el handler
const handleOpen = () => {
  setIsOpen(true);
  doSomething();
};
```

### 3. Resetear estado cuando prop cambia

```tsx
// ❌ MALO: Resetear estado con effect
useEffect(() => {
  setComment('');
}, [userId]);

// ✅ BUENO: Usar key para resetear componente completo
<Profile userId={userId} key={userId} />

// ✅ ALTERNATIVA: Si solo necesitas resetear parte del estado
const [prevUserId, setPrevUserId] = useState(userId);
if (userId !== prevUserId) {
  setPrevUserId(userId);
  setComment('');
}
```

### 4. Fetch en effect sin cleanup

```tsx
// ❌ MALO: Sin manejar race conditions
useEffect(() => {
  fetchData(query).then(setData);
}, [query]);

// ✅ BUENO: Con flag ignore para evitar race conditions
useEffect(() => {
  let ignore = false;
  fetchData(query).then(result => {
    if (!ignore) setData(result);
  });
  return () => { ignore = true; };
}, [query]);

// ✅ MEJOR en Next.js: Usar Server Components o Server Actions
// El fetch ocurre en el servidor, sin necesidad de effect
```

### 5. Cálculos costosos

```tsx
// ❌ MALO: Recalcular en effect
const [filteredList, setFilteredList] = useState([]);
useEffect(() => {
  setFilteredList(items.filter(item => item.category === category));
}, [items, category]);

// ✅ BUENO: useMemo para cálculos costosos
const filteredList = useMemo(
  () => items.filter(item => item.category === category),
  [items, category]
);

// ✅ O cálculo directo si es simple
const filteredList = items.filter(item => item.category === category);
```

## Patrones específicos de Next.js

### Preferir Server Components

```tsx
// ✅ BUENO: Data fetching en Server Component (sin useEffect)
// src/app/(dashboard)/transactions/page.tsx
import { getTransactions } from '@/features/transactions';

export default async function TransactionsPage() {
  const transactions = await getTransactions();
  return <TransactionList data={transactions} />;
}
```

### Server Actions para mutaciones

```tsx
// ✅ BUENO: Usar Server Actions en lugar de fetch en effect
'use client';

import { createTransaction } from '@/features/transactions';

function TransactionForm() {
  const handleSubmit = async (formData: FormData) => {
    await createTransaction(formData);
    // No necesitas effect para refetch - usar revalidatePath en el action
  };

  return <form action={handleSubmit}>...</form>;
}
```

### Data fetching con señales de aborto (cuando es necesario en cliente)

```tsx
// ✅ BUENO: Fetch con AbortController
useEffect(() => {
  const controller = new AbortController();

  fetchData(id, { signal: controller.signal })
    .then(setData)
    .catch(err => {
      if (err.name !== 'AbortError') {
        setError(err);
      }
    });

  return () => controller.abort();
}, [id]);
```

### Inicialización única de la app

```tsx
// ✅ BUENO: Guardia a nivel de módulo
let didInit = false;

function App() {
  useEffect(() => {
    if (!didInit) {
      didInit = true;
      initializeAnalytics();
    }
  }, []);
}

// ✅ ALTERNATIVA: Inicializar antes del render
if (typeof window !== 'undefined') {
  initializeAnalytics();
}
```

## Checklist de revisión de useEffect

Para cada `useEffect` en un componente, verificar:

- [ ] ¿El valor puede calcularse durante render? (derivado)
- [ ] ¿Se puede mover la lógica al event handler?
- [ ] ¿Hay cleanup function cuando es necesario?
- [ ] ¿Las dependencias están correctas y completas?
- [ ] ¿Se maneja race condition en fetches?
- [ ] ¿Podría ser un Server Component en lugar de Client Component con effect?
- [ ] ¿Podría usar Server Actions en lugar de fetch en effect?

## Auditoría de componentes

### Comando para encontrar useEffect

```bash
# Buscar todos los useEffect en una feature
grep -rn "useEffect" src/features/transactions/

# Con contexto
grep -rn -A 5 "useEffect" src/features/transactions/
```

### Clasificación de effects

| Tipo | Legítimo | Acción |
|------|----------|--------|
| Fetch de datos en mount | ⚠️ | Preferir Server Component |
| Sincronizar con prop | ⚠️ | Evaluar si puede derivarse |
| Suscripción a evento | ✅ | Verificar cleanup |
| Actualizar estado derivado | ❌ | Refactorizar a cálculo |
| Disparar acción por estado | ❌ | Mover a handler |
| Reset de estado por prop | ⚠️ | Considerar usar `key` |
| Manipulación DOM | ✅ | Verificar cleanup |
| Widgets externos | ✅ | Verificar cleanup |

## Ejemplos de refactorización

### Antes: Effect para valor derivado

```tsx
// ❌ ANTES
const [total, setTotal] = useState(0);
useEffect(() => {
  const sum = transactions.reduce((acc, t) => acc + t.amount, 0);
  setTotal(sum);
}, [transactions]);
```

### Después: Valor calculado

```tsx
// ✅ DESPUÉS
const total = useMemo(
  () => transactions.reduce((acc, t) => acc + t.amount, 0),
  [transactions]
);

// O sin memo si es cálculo simple
const total = transactions.reduce((acc, t) => acc + t.amount, 0);
```

### Antes: Effect para responder a cambio

```tsx
// ❌ ANTES
useEffect(() => {
  if (selectedMonth) {
    fetchTransactions(selectedMonth);
  }
}, [selectedMonth]);
```

### Después: En el handler

```tsx
// ✅ DESPUÉS
const handleMonthSelect = async (month: string) => {
  setSelectedMonth(month);
  const data = await fetchTransactions(month);
  setTransactions(data);
};
```

### Mejor: Server Component

```tsx
// ✅ MEJOR: Server Component con param
// src/app/(dashboard)/transactions/[month]/page.tsx
export default async function TransactionsPage({
  params
}: {
  params: { month: string }
}) {
  const transactions = await getTransactionsByMonth(params.month);
  return <TransactionList data={transactions} />;
}
```

## Recursos

- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- [Lifecycle of Reactive Effects](https://react.dev/learn/lifecycle-of-reactive-effects)
- [Next.js Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
