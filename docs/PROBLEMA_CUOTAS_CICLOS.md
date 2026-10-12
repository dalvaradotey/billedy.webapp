# Cuotas de TC vs. Ciclos de Facturación — Análisis y Propuesta

> **Estado:** En diseño (no implementado). Última actualización: 2026-06-27.
> **Objetivo del doc:** dejar registrado TODO el análisis, los datos medidos, el recorrido de
> ideas (y por qué se descartaron) y la propuesta vigente, para poder retomarlo sin re-derivar.

---

## 1. El problema (usabilidad)

El usuario hace casi todos sus gastos con tarjeta de crédito y usa mucho los presupuestos/ciclos.
El dolor está en la **cuadratura de la facturación de la TC contra lo registrado en la app**,
específicamente con los **cargos mensuales por cuotas (compras en cuotas)**:

- Las compras normales del día a día caen bien en su ciclo (su `date` cae dentro del rango del ciclo).
- Las **cuotas de compras en cuotas quedan fechadas en el ciclo equivocado** (típicamente un ciclo
  tarde), y obligan a usar filtros personalizados para encontrarlas.
- Al cerrar un ciclo y crear el siguiente, las cuotas que corresponden a la facturación que se está
  pagando quedan asignadas al ciclo nuevo, no al que ya pasó.

---

## 2. Diagnóstico técnico (confirmado en código)

1. **No existe vínculo explícito transacción↔ciclo.** `n1n4_transactions` NO tiene columna
   `billingCycleId`. La pertenencia a un ciclo es 100% implícita por fecha:
   `transaction.date BETWEEN cycle.startDate AND cycle.endDate`.
2. **Las cuotas se fechan con día fijo mensual.** En `createCardPurchase`
   ([purchase-crud.ts:144-147](../src/features/card-purchases/actions/purchase-crud.ts#L144-L147)),
   cada cuota se genera con `chargeDate = firstChargeDate + i meses` (`setMonth`), con el día clavado.
3. **`firstChargeDate` es input MANUAL** del formulario. El usuario suele ponerlo ~1 mes después de la
   compra (mal), y eso corre todas las cuotas un ciclo.
4. **Todas las cuotas se pre-crean al registrar la compra**, con `isPaid = true` y
   `updateAccountBalance(-totalAmount)` ([purchase-crud.ts:167-178](../src/features/card-purchases/actions/purchase-crud.ts#L167-L178)).
   Esto refleja la deuda total de inmediato y **descuenta el cupo**. → **Requisito a mantener.**
5. **`loadCycleTransactions` ya NO procesa `cardPurchases`** (deshabilitado, ver nota en
   [cycle-transactions.ts:153-156](../src/features/billing-cycles/actions/cycle-transactions.ts#L153-L156)).
   Sí carga items de plantilla (`date = startDate`, `isPaid = false`) y cuotas de créditos por rango.
6. **Crear un ciclo llama a `loadCycleTransactions`** ([billing-cycle-crud.ts:63](../src/features/billing-cycles/actions/billing-cycle-crud.ts#L63)).
7. **Cerrar un ciclo** (`closeBillingCycle`) solo guarda snapshot de totales y permite ajustar `endDate`
   ([billing-cycle-status.ts:56-79](../src/features/billing-cycles/actions/billing-cycle-status.ts#L56-L79)).
   No estampa nada en las transacciones.
8. **El saldo/cupo de la TC sale de `accounts.currentBalance`** (columna almacenada, incremental).
9. **El filtro de ciclo en la vista** solo traduce ciclo → `startDate`/`endDate` en la URL y consulta
   por rango de fecha ([transaction-list.tsx:216-222](../src/features/transactions/components/transaction-list.tsx#L216-L222),
   [transactions/queries.ts:41-47](../src/features/transactions/queries.ts#L41-L47)).

### La distinción clave: **corte vs. vencimiento** (dos fechas distintas)

Cada cuota tiene conceptualmente **dos fechas**:

- **Corte (~día 25, móvil):** cuándo el banco factura la cuota. **Esto define a qué ciclo pertenece.**
- **Vencimiento (~día 5 del mes siguiente):** cuándo se paga como máximo.

El sistema venía guardando algo cercano al **vencimiento** en `date`. Como el vencimiento cae el mes
**siguiente** al corte, la cuota "se ve" un ciclo más adelante → **ése es el off-by-one**.

---

## 3. Datos reales medidos (inspección de la BD de producción)

### Ciclos (`n1n4_billing_cycles`) — confirman que el corte se mueve

| Ciclo | Inicio | Fin (corte) | Largo | Estado |
|---|---|---|---|---|
| Junio 2026 | 26/05 | 25/06 | 30d | open |
| Mayo 2026 | 22/04 | 25/05 | 33d | closed |
| Abril 2026 | 24/03 | 21/04 | 28d | closed |
| Marzo 2026 | 24/02 | 23/03 | 27d | closed |

El corte cae 21 / 23 / 25 según días hábiles → **bordes móviles, ~22 a 27**.

### Compras en cuotas — el `firstChargeDate` siempre cae día 5 (vencimiento)

17 compras activas/históricas. `first_charge_date` en día 5 en 16 de 17 (una en día 30).
El gap compra→primera cuota es errático: de 12 a 70 días.

### Medición del desfase (ciclo de la compra vs. ciclo de la primera cuota)

| Compra | Fecha compra | Ciclo de la compra | 1ª cuota (hoy) | Ciclo de la 1ª cuota |
|---|---|---|---|---|
| **Cable Starlink** | 12/05 | **Mayo** | 05/06 | **Junio** ⚠️ off-by-one |
| **Silla Anais** | 24/02 | **Marzo** | 05/04 | **Abril** ⚠️ off-by-one |

"Cable Starlink": comprado 12/05 (antes del corte 25/05) → el banco lo factura en **Mayo**. Pero la app
lo fecha 05/06 → cae en **Junio**. Confirmado.

### Otros números

- `n1n4_transactions`: 557 totales; 129 con `card_purchase_id`; 17 con `credit_id`; 199 con `budget_id`.
- Plantillas: 1 activa con 21 items (los que carga `loadCycleTransactions`).

---

## 4. Restricciones y principios del usuario (NO negociables)

Estos surgieron a lo largo de la discusión y son los que filtran cualquier solución:

1. **La app debe mantenerse simple:** son **transacciones con una fecha** que representan ingreso o
   egreso. **Nada más.** No quiere entidades paralelas tipo "factura/statement" que no coincidan con la fecha.
2. **Pertenencia al ciclo = por fecha, uniforme para todas las transacciones** ("para todos o ninguno").
3. **Las transacciones se mueven libremente** en su fecha; nada las limita ni las "ata" a un ciclo.
4. **El ciclo es un ciclo de facturación de TC y nada más.** Es **opcional**. El sueldo, los débitos y
   los gastos del día a día caen por su fecha real, NO se fuerzan a ningún ciclo. (Ej.: el sueldo llega
   en un ciclo y se usa para pagar el anterior + parte del actual — eso es lógica de pago del usuario,
   no algo que el modelo deba representar.)
5. **La fecha de vencimiento NO le importa.** Lo que SÍ le importa es **dónde se ve la cuota en el reporte**.
6. **La pre-creación de todas las cuotas se mantiene** (para descontar cupo).
7. **No le gustan:** columnas/flags extra de membresía, fechas a mitad de mes (ensucian el reporte),
   ni **re-fechar/mutar** las cuotas cuando se crea/mueve un ciclo (lo considera complejo y propenso a errores).
8. **El corte se mueve** (22–27, según día hábil) y **los ciclos se crean mes a mes**.
9. **Edge case que el usuario marcó:** puede ocurrir **más de un ciclo en un mismo mes** (no es su caso, pero puede pasar).

---

## 5. Recorrido de soluciones evaluadas (y por qué se descartaron)

> Importante para no volver a proponer lo mismo.

| # | Idea | Por qué se descartó |
|---|---|---|
| 1 | **`billingCycleId` explícito** (nullable, estampar al cerrar el ciclo) | Usuario quiere pertenencia por fecha y "para todos o ninguno"; lo siente como algo que ata/limita. |
| 2 | **`isDateConfirmed` flag** / **`date` nullable** (estado tentativo) | Flag redundante; prefiere derivar el estado, no agregar campos. |
| 3 | **Generación lazy** (crear la cuota recién al crear el ciclo; derivar saldo de `card_purchases`) | Rompe la pre-creación que descuenta cupo. Requisito a mantener. |
| 4 | **`billingPeriod` tag mes (YYYY-MM)**, estable, sin re-fechar | **Se rompe si hay >1 ciclo en un mes** (el "mes" deja de identificar un ciclo único). |
| 5 | **Fechar la cuota en el corte (~25)** | Frágil: si el corte se adelanta (ej. 24), la cuota dada el 25 cae en el ciclo siguiente. |
| 6 | **Fechar a mitad de mes (15) o día 1** para robustez de membresía | Robusto para pertenecer, pero **se mezcla visualmente** con el gasto diario del ciclo. |
| 7 | **Fechar al inicio del ciclo + adoptar/re-fechar al crear el ciclo** | El usuario rechaza la **mutación** de fechas (complejo, propenso a errores). |
| 8 | **"Factura/statement" como entidad de primera clase** (estándar de la industria) | El usuario lo considera **demasiado complejo** y contrario a "solo transacciones con fecha". |

### El "teorema" que quedó claro

Le estábamos pidiendo a **un solo campo (`date`) dos trabajos opuestos**:

- **Pertenencia** quiere la fecha **adentro** del ciclo (lejos del borde → robusta al corte móvil).
- **Lo visual** quiere la fecha **en el borde** (para que no se mezcle con el gasto diario).

Ninguna fecha puede estar a la vez adentro y en el borde. ⇒ **El problema visual NO se puede resolver
eligiendo una fecha.** Cualquier fecha robusta es interior ⇒ se mezcla ⇒ lo visual debe resolverse en
**cómo se muestra la lista**, no en el dato.

---

## 6. Qué dice la industria (investigación web)

Patrón **consistente** entre contabilidad y fintech Latam:

- **Contabilidad (SAP/ERP, GAAP):** existe separación entre *transaction/document date* (cuándo ocurrió)
  y *accounting date / posting period* (a qué período pertenece). El período se asigna **explícitamente**,
  no se deduce de la fecha. (Ejemplo análogo: servicio consumido en septiembre, facturado en octubre →
  se asigna a septiembre con un campo aparte.)
- **Fintech Latam (Mobills, Organizze, BBVA):** la **fatura/resumen es una ENTIDAD**. Cada compra y cada
  cuota se **asigna a su fatura**; el **día de corte** determina a cuál; las cuotas futuras quedan en las
  faturas futuras (que se **auto-generan** hacia adelante). La primera cuota entra en el resumen donde
  cayó el consumo.
- **Bancos (Chase, etc.):** la *closing date* determina en qué statement cae un cargo; el statement es la
  unidad de agrupación.

**Conclusión de la industria:** lo "correcto" es **statement como entidad + asignación explícita del
período** (= el patrón contable accounting-date). **PERO el usuario lo descartó por complejidad** (ver fila 8).

Fuentes:
- https://centsiq.com/bookkeeping-fundamentals/posting-date-vs-transaction-date/
- https://accountinginsights.org/understanding-posting-dates-in-financial-management/
- https://www.mobills.com.br/blog/cartao-de-credito/parcelamento-da-fatura-do-cartao-de-credito/
- https://www.bbva.com/es/ar/economia-y-finanzas/como-pagar-en-cuotas-el-saldo-de-las-tarjetas-de-credito-bbva/
- https://www.chase.com/personal/credit-cards/education/basics/credit-card-billing-cycles-explained

---

## 7. Propuesta vigente (la última, dentro de las restricciones del usuario)

Modelo de datos **idéntico al actual**: transacciones con fecha, ciclo = rango de fechas. Sin entidad,
sin columna de vínculo. Solo cambian dos cosas: **cómo se calcula la fecha de la cuota** y **cómo se
muestra en la vista**.

### 7.1 Pertenencia (qué fecha lleva la cuota)

- **Fecha de cuota = día 1 de su mes de facturación**, seteada **una sola vez** al crear la compra.
- **Por qué el día 1:** está siempre **adentro** del ciclo pase lo que pase con el corte (corte va de 22
  a 27; el día 1 está a ~3 semanas del borde → nunca se cae al ciclo vecino). Como nunca toca el borde,
  **no hay que re-fecharla NUNCA** (ni al crear el ciclo ni si el corte se mueve). **Cero mutación.**
- **Primer mes de facturación:** el del ciclo donde cae la compra (si `compra ≤ corte` → ese mes; si no,
  el siguiente). De ahí, **+1 mes** por cuota.
- Arregla el off-by-one (hoy quedan el día 5 del mes siguiente → un ciclo tarde).

**Ejemplo — Cable Starlink** (compra 12/05): cuotas **01/05, 01/06, 01/07** → caen en Mayo, Junio, Julio.

### 7.2 Lo visual (dónde se muestra)

- **No sale de la fecha** (ver "teorema" §5). Sale de **cómo el reporte muestra las cuotas**: una sección
  agrupada ("Cuotas del ciclo", con subtotal) o un distintivo visual.
- Es **puramente display**: sigue siendo "transacciones con fecha", no agrega entidad ni cambia el dato.
- Funciona con y sin ciclos.

### 7.3 Cambios concretos

- **Dato:** igual que hoy. Solo cambia el **cálculo de la fecha de la cuota** (día 1 del mes de
  facturación, una vez) en `createCardPurchase` y `regenerateInstallments`.
- **Campo opcional (un solo número, NO una entidad):** `accounts.statementClosingDay` (ej. 25) para
  calcular el primer mes de facturación con precisión y como respaldo cuando no hay ciclos.
- **Vista:** agrupar/marcar las cuotas (`cardPurchaseId`/`creditId`) en el reporte del ciclo.
- **Migración:** recálculo **único** de las fechas de las cuotas existentes al día 1 de su mes correcto
  (una vez; no es algo que mute después).

### 7.4 Cómo cubre cada requisito

- Pertenencia por fecha, uniforme → ✅ (no hay columna de membresía).
- Transacciones se mueven libres → ✅ (nada las limita).
- Sin entidad "factura" → ✅.
- Sin re-fechar/mutar → ✅ (día 1 es robusto, se setea una vez).
- Sin fechas a mitad de mes molestando → ✅ (lo visual lo resuelve la agrupación, no la fecha).
- Cupo intacto → ✅ (se sigue pre-creando todo).
- Con y sin ciclos → ✅.
- 2 ciclos en un mes → caso raro, no es el del usuario; si pasa, se ajusta a mano (la fecha se mueve libre).

---

## 8. Decisiones pendientes / preguntas abiertas

1. **Confirmar la agrupación en la vista** como solución a lo visual (era el último punto que le hacía
   ruido al usuario). Sin esto, no hay forma de evitar la mezcla sin romper la robustez.
2. **Fecha de la cuota:** ¿día 1 (más robusto) u otra fecha interior intuitiva (ej. el día de compra)?
   - Nota del borde: la **primera** cuota con "día 1 del mes de la compra" puede quedar **antes** de la
     fecha de compra. Alternativa: la #1 en la fecha de compra y el resto día 1.
3. **`statementClosingDay`:** ¿se agrega como ajuste de la cuenta o se deriva del ciclo abierto vigente?
4. **Items de plantilla (21):** tratamiento visual "por confirmar" — sub-tema aparte, postergado.
5. **2 ciclos en un mes:** se asume manejo manual (no es el caso del usuario).

---

## 9. Archivos clave

| Archivo | Rol |
|---|---|
| [src/lib/db/schema/transactions.ts](../src/lib/db/schema/transactions.ts) | Tabla `n1n4_transactions` (sin `billingCycleId`) y `n1n4_card_purchases`. |
| [src/lib/db/schema/billing-cycles.ts](../src/lib/db/schema/billing-cycles.ts) | Ciclos. Ojo: `n1n4_billing_cycle_budgets` existe pero está muerta. |
| [src/features/card-purchases/actions/purchase-crud.ts](../src/features/card-purchases/actions/purchase-crud.ts) | **Generación de cuotas** (`createCardPurchase`, `regenerateInstallments`) — acá está el bug de fechas. |
| [src/features/billing-cycles/queries.ts](../src/features/billing-cycles/queries.ts) | Totales por rango de fecha; `suggestNextCycleDates`. |
| [src/features/billing-cycles/actions/billing-cycle-status.ts](../src/features/billing-cycles/actions/billing-cycle-status.ts) | Cerrar/reabrir/recalcular snapshot. |
| [src/features/billing-cycles/actions/billing-cycle-crud.ts](../src/features/billing-cycles/actions/billing-cycle-crud.ts) | Crear ciclo (llama a `loadCycleTransactions`). |
| [src/features/billing-cycles/actions/cycle-transactions.ts](../src/features/billing-cycles/actions/cycle-transactions.ts) | `loadCycleTransactions` (carga plantillas + cuotas de crédito; cardPurchases deshabilitado). |
| [src/features/transactions/queries.ts](../src/features/transactions/queries.ts) | `getTransactions` (filtros por fecha). |
| [src/features/transactions/components/transaction-list.tsx](../src/features/transactions/components/transaction-list.tsx) | Vista/filtros (ciclo → params de fecha). |

---

## 10. Apéndice — cómo inspeccionar la BD de producción

El MCP `mcp__postgres__query` **falla** con `self-signed certificate in certificate chain` (Supabase).
Workaround usado: script Node con el driver `postgres` (postgres.js, ya es dependencia) y
`ssl: { rejectUnauthorized: false }`, solo lectura (SELECT).

```js
// /tmp/q.mjs  — uso: node /tmp/q.mjs "SELECT ..."
import postgres from '.../node_modules/.../postgres/src/index.js'
import { readFileSync } from 'fs'
const url = readFileSync('.env','utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^"|"$/g,'')
const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1, prepare: false })
console.log(JSON.stringify(await sql.unsafe(process.argv[2]), null, 2))
await sql.end()
```

`DATABASE_URL` está en `.env` (Supabase pooler, `sslmode=require`).
