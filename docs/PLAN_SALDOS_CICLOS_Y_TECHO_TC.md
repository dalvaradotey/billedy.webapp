# Plan: Saldos correctos de ciclos + Techo de gasto TC

> Estado: **v10 — Fases 1, 2 y 3 implementadas** · Fecha: 2026-10-10
> Reemplaza a: `docs/PROBLEMA_CUOTAS_CICLOS.md` (la vista estado de cuenta de §3.3 lo resuelve; el re-fechado queda opcional en la Fase 4)

## Resumen

1. **Una sola fórmula de caja** para todos los ciclos (abiertos y cerrados) y todas las vistas: ingresos − débito − pago TC − ahorro.
2. **Cada gasto tiene una naturaleza:** propio, de otra persona, reembolsable o del fondo. Así se separa lo que es tuyo de lo que se compensa.
3. **El techo de TC** mide solo el gasto propio y se deriva del plan de ahorro.
4. **El fondo de imprevistos "paga"** sus gastos con un retiro al pagar la TC.
5. **Tres fases:** la 1 no toca el schema; la 2 ordena la base y agrega la naturaleza; la 3 agrega el techo y las compensaciones. Re-fechar las cuotas queda como opcional.

---

## 1. Diagnóstico

| # | Problema | Evidencia |
|---|---|---|
| D1 | Dos fórmulas distintas para los totales del ciclo (`queries.ts:11` en vivo, `actions/utils.ts:40` al cerrar) | Al cerrar, ingresos y gastos se inflan ~$1,3–2M: el pago de TC se cuenta dos veces |
| D2 | Ninguna fórmula calcula el saldo de caja | Septiembre: real $504.670 / $284.670 · vista en vivo $900.229 · snapshot $680.229 |
| D3 | Snapshots obsoletos | 4 de 7 ciclos cerrados no cuadran con la data |
| D4 | El total TC mezcla lo propio con lo ajeno | Junio: total $2,37M, propio $1,12M |
| D5 | Cuotas TC fechadas un ciclo tarde | El pago del 30-09 cubre cuotas con fecha 05-10 |
| D6 | Pendientes vencidos | "Internet" $47.000 pendiente desde 26-05; "Diferencia TC Marzo" duplicada |
| D7 | Base técnica frágil | Migraciones desincronizadas (journal hasta 0008, columnas sin migración); actions sin `auth()`; sin tests |

## 2. Supuestos verificados contra la BD

| Supuesto | Resultado | Implicancia |
|---|---|---|
| Cada pago TC registra qué compras cubre (`paid_by_transfer_id`) | ✅ 13/13 pagos | El pago se puede desglosar por naturaleza |
| Los ciclos calzan con el estado de cuenta | ✅ Sin contar cuotas, cada pago cubre exactamente **un** ciclo (el anterior) | "Factura TC que viene" = vista estado de cuenta del ciclo (§3.3) |
| Día 1 del mes de cierre cae dentro de su ciclo | ✅ En los 8 ciclos existentes | Regla para re-fechar las cuotas (Fase 4, opcional) |
| Pago = Σ compras cubiertas | ⚠️ Julio: $2.229.886 cubierto vs $1.701.077 pagado. La diferencia ($528.809) son devoluciones en la TC. Agosto: diferencia de $1 | El desglose resta los abonos en la TC y tolera ±$10 |
| `is_paid` sirve en la TC | ❌ Las cuotas nacen pagadas aunque sean futuras (hasta 2029) | Real en TC = `is_paid` **y** fecha ≤ hoy |
| Todo gasto TC con fecha pasada es un cargo real | ❌ Los ítems de plantilla TC nacen pendientes con fecha = inicio del ciclo (Netflix, HBO Max, ZappingTV, AppleTV el 25-09) | Misma regla: exigir `is_paid` |
| La fecha de la BD coincide con la de Chile | ⚠️ La BD corre en UTC: entre las 21:00 y las 24:00 de Chile ya es "mañana" | "Hoy" = `(now() at time zone 'America/Santiago')::date` |
| ZappingTV se cobró dos veces en septiembre | ❌ El registro del 25-09 es el ítem de plantilla (pendiente) del ciclo de Octubre | Sin acción |
| La consulta de buckets reproduce el análisis manual | ✅ Julio, Agosto y Septiembre cuadran al peso. Junio difería en $80.000 por un pendiente duplicado ("Aporte Mensual Yoha"), ya eliminado | La regla "real" excluye correctamente los pendientes vencidos |
| La regla temporal de abonos (`Reembolsos` / `Abono%`) basta | ⚠️ Deja fuera "Pago de deudas pendientes" ($250k, categoría Externo, mar) | Agregar: ingreso en la categoría Externo → abono |
| Se puede predecir el pago TC sin re-fechar las cuotas | ✅ Con la "vista estado de cuenta" (§3.3), el error es de $0 a $6.688 en 7 ciclos (≤ 0,3%). Por fecha, el error llega a $234.000 | El re-fechado pasa a ser opcional (Fase 4) |
| Las transacciones guardan de qué ítem de plantilla vienen | ❌ No hay vínculo | El comprometido se toma de `template_items`, no de las transacciones |
| La naturaleza se puede inferir por categoría y descripción | ❌ "Airbnb Santiago (reeembolsable)" (con typo) cae como fondo | El techo espera la columna `nature` (Fase 2) |
| Todos los retiros de ahorro están enlazados | ⚠️ "Dinero en depósito a plazo" ($51.440, 26-03) entra como ingreso suelto | Limpieza (§8) |
| Lo que la TC no tiene cubierto es solo el ciclo en curso | ⚠️ +15 registros antiguos (ajustes "Diferencia TC" y D6) | Limpieza (§8) + validación "pendientes vencidos" |
| Re-fechar las cuotas cambia saldos históricos | ❌ No: el saldo usa el **pago** TC, que es real y no se mueve | Solo cambian el gasto TC por ciclo y el techo |

---

## 3. Modelo de saldo

### 3.1 Buckets (clasificación única)

`src/features/billing-cycles/lib/cycle-buckets.ts` define **una** expresión SQL `CASE`, que usan todas las vistas.

Cuentas líquidas: `checking`, `cash`. Cuentas de ahorro: `savings`, `pension`, `unemployment`.

| Bucket | Regla | ¿Suma a la caja? |
|---|---|:-:|
| `income` | income líquida, sin enlace, `nature ≠ reimbursement` | ✅ |
| `reimbursement` | income líquida, sin enlace, `nature = reimbursement` | ✅ |
| `debit_expense` | expense líquida, sin enlace | ✅ |
| `card_payment` | expense líquida enlazada a TC | ✅ |
| `savings_in` | expense líquida enlazada a cuenta de ahorro | ✅ |
| `savings_out` | income líquida enlazada desde cuenta de ahorro | ✅ |
| `card_spend` | expense en TC | — (informativo) |
| `card_credit` | income en TC sin enlace (devoluciones, abonos, ajustes) | — (informativo) |
| `ignored` | contrapartes de enlaces; movimientos internos de cuentas de ahorro | — |

### 3.2 Cascada

```
  Ingresos                 income
+ Abonos y reembolsos      reimbursement
− Gastos débito            debit_expense
− Pago TC                  card_payment
= SALDO ANTES DE AHORRO
− Aportes a ahorro         savings_in
+ Retiros de ahorro        savings_out   (incluye liquidaciones del fondo, §5)
= SALDO FINAL
```

**Desglose del pago TC:**
```
Pago TC = Σ compras cubiertas (propio · de otros · fondo · reembolsable)
        − card_credit del ciclo cubierto
        ± ajuste (|dif| ≤ $10; si es mayor → aviso)
```

### 3.3 Real, comprometido y proyectado

| | Cuentas líquidas | TC |
|---|---|---|
| **Real** | `is_paid = true` | `is_paid = true` y fecha ≤ hoy (Chile) |
| **Comprometido** | Real + pendientes del ciclo (plantilla, cuotas de crédito) | Vista estado de cuenta del ciclo, incluidos los ítems de plantilla pendientes |
| **Proyectado** | Comprometido + pago TC pendiente | — |

- **Ciclo cerrado:** solo Real. Si quedan pendientes con fecha dentro de un ciclo cerrado, se muestran como "pendientes vencidos" y no suman.
- **Vista estado de cuenta de un ciclo K** (lo que se paga en el ciclo K+1):
  ```
  compras TC reales sin cuota con fecha en K
  + cuotas TC con fecha en (fin_K, fin_K + 16 días]     ← las cuotas quedan fechadas el día 5 del mes siguiente (D5)
  − card_credit con fecha en K
  ```
  Validada contra los 7 pagos reales (Anexo B). Excluye `is_historically_paid` y los ítems de plantilla no confirmados.
- **Pago TC pendiente** (si en el ciclo aún no hay `card_payment` de esa tarjeta) = vista estado de cuenta del ciclo anterior − lo ya cubierto.
- **Factura TC que viene** = vista estado de cuenta del ciclo actual + presupuestos TC no gastados.

### 3.4 Validaciones visibles
- Tarjeta con 0 o más de 1 pago en el ciclo.
- Pago que no cuadra con lo cubierto (> $10).
- Pendientes vencidos.

### 3.5 Ciclos cerrados
- Se calculan en vivo con la misma cascada.
- Al cerrar se guarda `closing_snapshot jsonb`. Si el cálculo en vivo difiere, la UI muestra "Cambió $X desde el cierre".
- Se elimina "Recalcular snapshot". Las columnas `snapshot_*` quedan deprecadas.

---

## 4. Naturaleza de las transacciones

`n1n4_transactions.nature`, con CHECK de coherencia contra `type`:

| Valor | Aplica a | ¿Techo? | UI | Ejemplos |
|---|---|:-:|---|---|
| `own` (default) | expense, income | ✅ | Propio | Supermercado, sueldo |
| `external` | expense | ❌ | De otra persona | Teléfono Mamá, TV Tía Consuelo |
| `reimbursable` | expense | ❌ | Reembolsable | Airbnb Santiago |
| `fund` | expense | ❌ | Del fondo | Tratamiento dental, comidas de viaje laboral |
| `reimbursement` | income (líquida o TC) | — | Abono | "Abono mes Mamá", "Devolución Airbnb Mamá" |

- `card_purchases.nature`: las cuotas la heredan. Migración `is_external_debt = true → external`.
- `categories.default_nature`: Externo → `external`; Inesperado y Trabajo → `fund`; Reembolsos → `reimbursement`.
- **Fase 1 (sin columna):** se considera abono un ingreso líquido en la categoría Reembolsos o Externo, o con descripción `Abono%` (ignorando espacios iniciales). La regla vive solo en `cycle-buckets.ts`.

## 5. Compensaciones

Tabla `n1n4_settlements (id, expense_id, settling_transaction_id null, amount, kind, created_at)`. Cada fila registra cuánto de un gasto queda compensado y con qué.

Una columna `settled_by` no alcanza: los datos reales tienen compensaciones **parciales y de muchos a muchos**.
- Un abono cubre varios gastos: "Abono mes Mamá" $196.000 cubre pasajes y la cuota del teléfono.
- Un gasto se cubre con varias transacciones: los pasajes de Mamá se cubrieron con devoluciones en la TC más abonos.
- Hay montos que no calzan exacto: la cuota de la TV es $51.632 y el abono de la Tía, $51.700.

| Naturaleza | Se compensa con | Indicador si falta |
|---|---|---|
| `fund` | Retiro desde la cuenta del fondo (`savings_out`) | Fondo por liquidar |
| `external` / `reimbursable` | `reimbursement` (líquido o en TC) | Por cobrar |

- `kind`: `transaction` (compensado con un movimiento) o `waived` (diferencia cerrada sin movimiento, por ejemplo "lo asumió Mamá" o un redondeo).
- Pendiente de un gasto = monto − Σ settlements. Con una diferencia ≤ $500 se sugiere cerrarla como `waived`.

- **Liquidación del fondo en "Pagar tarjeta"** (`payCreditCardTransactions`):
  - El diálogo muestra: "Esta factura incluye $Z del fondo. ¿Retirar desde Fondo Backup?".
  - Al confirmar, se crea el traspaso enlazado y un settlement por cada gasto del fondo cubierto.
  - El retiro cae en el mismo ciclo que el pago, así que no hay desfase.
- **Gastos del fondo pagados con débito:** se liquidan en el diálogo de cierre del ciclo.
- **Abonos:** al registrar un `reimbursement`, la app sugiere a qué gastos pendientes vincularlo, por monto y entidad. Es opcional: sin vínculo, el saldo igual cuadra.

## 6. Techo de gasto propio en TC

**Plan del proyecto** (`n1n4_projects`):

| Columna | Valor inicial |
|---|---|
| `savings_target` | $400.000 (APV 100k + 200k + fondo 100k) |
| `card_spending_cap` | $1.317.000 (null = usar el máximo) |
| `contingency_account_id` | Fondo Backup |

**Techo máximo** (calculado):
```
  último sueldo registrado            3.868.679   (sin el aporte de Anais, por prudencia)
− cuotas de créditos + plantilla débito  2.035.887
− savings_target                        400.000
= TECHO MÁXIMO                         1.432.792
```
Sube solo cuando terminan créditos (ene-2028 y abr-2028). Con el techo elegido quedan ~$116k libres.

**Estado en el ciclo:**
```
Gasto propio = vista estado de cuenta del ciclo, solo nature = 'own'
  Comprometido = Σ template_items TC activos + cuotas propias del ciclo   (conocido desde el día 1)
  Variable     = gasto propio − comprometido (mínimo 0)
Disponible   = techo − gasto propio
Ritmo diario = disponible / días restantes
Proyección   = comprometido + variable × días totales / días transcurridos
```

**Las dos cifras principales** (arriba del dashboard; responden a las dos preguntas del objetivo):
```
LIBRE DEL CICLO    = saldo final proyectado − (savings_target − aportes ya hechos en el ciclo)
                     → "cuánto me queda" después de cumplir el ahorro
DISPONIBLE TC      = techo − gasto propio
```
Además, **meta de ahorro del ciclo**: "Ahorrado $220.000 de $400.000". El tramo mínimo de $300.000 (APV + 200k) se distingue del tramo del fondo (100k).

**UI (mobile-first):**
- **Barra en el dashboard y el banner:** verde < 75%, ámbar 75–100%, rojo > 100%.
- **Formulario de gasto TC propio:** "Te quedan $X". Si se excede, pide confirmación.
- **Compra en cuotas:** "Suma $175.000 por ciclo durante 24 ciclos. Tu disponible quedaría en $X".
- **Presupuestos:** "Presupuestado $X de $techo", con aviso si superan el techo máximo.

---

## 7. Fases

### Fase 1 — Saldo correcto (sin cambios de schema)

| # | Tarea | Archivos |
|---|---|---|
| 1.1 | Buckets, cascada, real/comprometido/proyectado, vista estado de cuenta, desglose del pago, validaciones. "Hoy" en zona America/Santiago; fechas como `YYYY-MM-DD` comparadas en SQL | `billing-cycles/lib/cycle-buckets.ts`, `lib/cycle-balance.ts` |
| 1.2 | Reemplazar las dos `calculateTotalsForRange`. **Una sola query agrupada por ciclo y bucket** para la lista completa (hoy `enrichCycleWithTotals` hace N consultas, y con los cerrados en vivo serían ~16) | `billing-cycles/queries.ts`, `actions/utils.ts`, `actions/billing-cycle-status.ts` |
| 1.3 | Alinear resúmenes. La actualización optimista del dashboard (`hooks.tsx:101`) solo mueve el saldo con movimientos en cuentas líquidas; los gastos TC mueven el gasto TC | `transactions/queries.ts`, `dashboard/queries.ts`, `dashboard/hooks.tsx` |
| 1.4 | UI de la cascada y las validaciones; ciclos cerrados en vivo; quitar "Recalcular" | `components/billing-cycle-card.tsx`, `cycle-summary-banner.tsx`, `types.ts` |
| 1.5 | `auth()` en el servidor para las actions de ciclos. Se quita el parámetro `userId` y se actualizan sus llamadas desde los componentes | `billing-cycles/actions/*.ts`, componentes que las llaman |
| 1.6 | Invalidación de caché del ciclo también con card-purchases y accounts | `lib/cache` |
| 1.6b | Fechas de ciclos: validar solapes y huecos con los ciclos vecinos al crear, editar o cerrar con otra fecha de fin (hoy solo se valida que no haya otro ciclo abierto) | `actions/billing-cycle-crud.ts`, `billing-cycle-status.ts` |
| 1.7 | Script read-only `scripts/verify-cycle-balances.ts`: cascada contra §9 y backtest del pago TC contra el Anexo B (alerta si la diferencia es > $10.000) | nuevo |

**Listo cuando:** el script cuadra §9, las 3 vistas muestran el mismo saldo, y la UI se revisó en 375px.

**Estado (2026-10-10): implementada** en la rama `feat/fase1-saldo-ciclos`. El script cuadra los 4 ciclos y el backtest de los 7 pagos. Quedan para la Fase 2, porque necesitan columnas nuevas:
- **Aviso "Cambió $X desde el cierre":** requiere `closing_snapshot`. Las columnas `snapshot_*` de los 7 ciclos cerrados tienen la fórmula antigua, así que compararlas daría falsos avisos. Desde la Fase 1, los cierres nuevos guardan `snapshot_*` con la fórmula nueva.
- **Desglose del pago TC por naturaleza:** requiere `nature`.
- **Avisos de pago TC:** se comparan contra el total pagado por tarjeta en el ciclo, porque un pago puede venir en partes, y solo sobre $10.000.

### Fase 2 — Base técnica y naturaleza

| # | Tarea |
|---|---|
| 2.0 | **Autenticación en todas las server actions** (adelantada desde la Fase 4): helpers `requireUser()` y `requireProjectAccess(projectId)` en `src/lib/auth/guards.ts`; las actions dejan de recibir `userId` y se reemplazan las ~91 verificaciones copiadas. Es prerrequisito de la Fase 3, que agrega actions nuevas |
| 2.1 | Respaldo de la BD (`pg_dump` de las tablas `n1n4_*`) + baseline de migraciones desde el estado real |
| 2.2 | Migración con los cambios de §10 marcados "F2" |
| 2.3 | Selector de naturaleza (chips) en los formularios de transacción y compra en cuotas; filtro en la lista |
| 2.4 | Limpieza de datos (§8) y backfill de naturaleza, con confirmación |
| 2.5 | `cycle-buckets.ts` usa `nature` en lugar de la heurística |
**Listo cuando:** todo gasto tiene naturaleza y §9 sigue cuadrando (con los ajustes aprobados en la limpieza).

### Fase 3 — Techo y compensaciones

| # | Tarea |
|---|---|
| 3.1 | Columnas del plan + pantalla de configuración |
| 3.2 | `getCardSpendingStatus` + techo máximo + **Libre del ciclo** y meta de ahorro (las dos cifras principales del dashboard) |
| 3.3 | Barra, aviso en el formulario e impacto en la compra en cuotas |
| 3.4 | Liquidación del fondo en "Pagar tarjeta" y en el cierre |
| 3.5 | Tabla `settlements`: vinculación parcial de abonos y devoluciones, cierre de diferencias (`waived`), "Por cobrar" y "Fondo por liquidar" |

**Listo cuando:** el gasto propio de Septiembre coincide con el análisis manual (§9), después de aplicar el backfill.

### Estado de las Fases 2 y 3 (2026-10-12): implementadas
Rama `feat/fase2-3-naturaleza-techo`, un commit por paso. Migración 0015 y limpieza de datos aplicadas en producción con aprobación del usuario, con respaldo previo. Diferencias respecto a lo planeado:
- **Seguridad (2.0):** en vez de quitar `userId` de las 77 actions, cada una verifica que coincida con la sesión (`isSessionUser`). El efecto de seguridad es el mismo y no hubo que tocar los componentes. `updateAccountBalance` y `verifyProjectAccess` dejaron de ser endpoints, y el saldo se ajusta en una sola sentencia SQL.
- **Migraciones (2.1):** en vez de un baseline de drizzle, SQL manual versionado en `src/lib/db/manual-migrations/` con `scripts/db-migrate.ts`, que registra lo aplicado en `n1n4_schema_migrations`.
- **Historial:** los gastos no propios anteriores al ciclo actual (25-09-2026) se dieron por compensados (`waived`), para que "Por cobrar" y "Fondo por liquidar" partan desde cero.
- **Liquidación del fondo (3.4):** se hace desde la tarjeta "Plan del ciclo" ("Fondo por liquidar"), no dentro del diálogo de pago de TC. Liquida los gastos del fondo cuya plata ya salió (débito, o TC ya pagada); los de TC sin pagar se muestran como "cuando pagues la TC".
- **Ingreso esperado:** se toma de los ítems de ingreso de la plantilla, usando el último monto real registrado con la misma descripción.

### Fase 4 — Posterior
- **Re-fechar las cuotas** (opcional, para que se vean en el ciclo de su estado de cuenta):
  - Las cubiertas → día 1 del mes de cierre del ciclo que las pagó.
  - Las futuras → la misma serie mensual.
  - Compras nuevas → según `accounts.statement_closing_day`, con `Date.UTC`.
  - Después de re-fechar, la ventana "+16 días" de §3.3 se reemplaza por la fecha del ciclo.
- Eliminar `is_external_debt` y `snapshot_*`.
- Notificación al 80% del techo.

### Reglas de integridad (todas las fases)
- **Toda operación con más de una escritura va en `db.transaction`**: liquidación del fondo, pago de TC con settlements, compra en cuotas, backfills. Hoy el proyecto no usa transacciones de BD.
- **Montos:** las sumas se hacen en SQL (`numeric`) y se convierten una sola vez a entero CLP (`Math.round`). En los módulos nuevos no se acumula con `parseFloat`.
- **`settlements`:**
  - `amount > 0`.
  - Σ por gasto ≤ monto del gasto, validado en la action.
  - FKs con `on delete cascade`: si se borra el abono, el gasto vuelve a "Por cobrar".
- **`nature`:** CHECK contra `type`. Default `own`, así que un insert antiguo nunca falla.

### Despliegue y rollback
| Fase | Tipo de cambio | Antes de desplegar | Rollback |
|---|---|---|---|
| F1 | Solo código; las columnas `snapshot_*` no se tocan | Correr `verify-cycle-balances.ts` y comparar con la UI de preview | Revertir el commit |
| F2 | Migración **solo aditiva** (columnas con default, tablas nuevas; los `drop` pasan a la F4) | `pg_dump` de `n1n4_*` | Revertir el código; las columnas nuevas quedan sin uso |
| F2 | Limpieza y backfill | Script idempotente con **dry-run** que lista cada cambio para aprobarlo; luego se aplica en una sola transacción | Restaurar desde el dump, o el script inverso que genera el dry-run |
| F3 | Código + tabla `settlements` | Probar el flujo de pago de TC con la liquidación en preview | Revertir el código; la tabla queda sin uso |
| F4 | Destructivo (`drop`) | `pg_dump` + una semana sin uso de lo eliminado | Restaurar desde el dump |

## 8. Limpieza de datos (requiere confirmación)

| Registro | Acción |
|---|---|
| "Dinero en depósito a plazo" $51.440 (26-03) | Enlazar como retiro de ahorro o recategorizar |
| "Internet" $47.000 TC pendiente desde 26-05 | Eliminar si es un ítem de plantilla sin usar |
| "Diferencia TC Marzo" $2.302 pendiente (26-03) | Eliminar si es duplicado |
| Ajustes "Diferencia TC" sin cubrir (~$13k) | Asociarlos al pago de su ciclo o marcarlos `is_historically_paid` |
| Devoluciones en TC de julio ($529k) | `reimbursement` + compensar los gastos de Mamá |
| Saesa 27-08 | → Gastos básicos |
| Pasaje a Santiago Octubre | → Trabajo, `fund` |
| Runpod ×3 | → nueva categoría Proyectos personales |
| Prueba Nomades ×3 | → Trabajo |
| Inversión Ostras | → categoría Inversión |
| Aporte Fondo Huevito 28-08 | → meta Fondo Huevito |
| 37 transacciones sin categoría | Revisión en bloque |
| Luz bimestral | Presupuesto mensual ~$53.000 |

## 9. Criterios de aceptación

**Saldo** (no cambia con el re-fechado de cuotas):

Valores **reales** que entrega la consulta del Anexo A:

| Ciclo | Ingresos | Abonos | Débito | Pago TC | Saldo antes de ahorro | Aportes | Saldo final |
|---|---:|---:|---:|---:|---:|---:|---:|
| Junio 2026 | 4.678.022 | 485.779 | 2.503.976 | 2.007.738 | 652.087 | 470.000 | 182.087 |
| Julio 2026 | 5.326.137 | 1.008.231 | 2.684.735 | 2.186.801 | 1.462.832 | 270.000 | 1.192.832 |
| Agosto 2026 | 4.021.467 | 420.848 | 2.185.678 | 1.701.077 | 555.560 | 170.000 | 385.560 |
| Septiembre 2026 | 4.286.043 | 247.700 | 2.131.723 | 1.897.350 | 504.670 | 220.000 | 284.670 |

Junio: el usuario eliminó el pendiente duplicado "Aporte Mensual Yoha" ($80.000, 26-05). El aporte del ciclo ya estaba registrado el 30-05. Verificado el 2026-10-10.

Los dos "Abono mes Mamá" de $250.000 (28-06) son abonos distintos (confirmado por el usuario).

Ingresos + Abonos de Septiembre = 4.533.743, igual al análisis manual: separar los abonos cambia el desglose, no el saldo.

**Gasto TC de Septiembre** (clasificación por categoría, antes del backfill): total $1.481.793 · externo $246.802 · imprevisto $30.000 · **propio $1.204.992**.

## 10. Cambios de base de datos

| Tabla | Cambio | Fase |
|---|---|:-:|
| `transactions` | `nature` enum NOT NULL default `own` + CHECK | F2 |
| `settlements` (nueva) | `expense_id`, `settling_transaction_id` null, `amount`, `kind` (`transaction` / `waived`) | F3 |
| `card_purchases` | `nature` | F2 |
| `categories` | `default_nature` | F2 |
| `accounts` | `statement_closing_day smallint` (solo TC) | F4 |
| `billing_cycles` | `closing_snapshot jsonb` | F2 |
| `billing_cycle_budgets` | Eliminar (vacía y sin uso) | F4 |
| `projects` | `savings_target`, `card_spending_cap`, `contingency_account_id` | F3 |
| `card_purchases` / `billing_cycles` | Eliminar `is_external_debt` / `snapshot_*` | F4 |

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| Migrar sobre un schema desincronizado | La Fase 1 no toca el schema; respaldo + baseline antes de la Fase 2 |
| Un pago TC queda en el ciclo vecino | Validación de pagos por tarjeta |
| Cuotas mal fechadas | Vista estado de cuenta (§3.3), validada al ≤ 0,3%; re-fechado opcional en la Fase 4 |
| Una cuota fechada fuera de la ventana de +16 días (fecha manual atípica) | El verify script compara la predicción con el pago real y avisa si la diferencia es > $10.000 |
| La heurística de abonos se equivoca | Vive solo en la Fase 1, en un único archivo |
| Cifras de ciclos cerrados cambian al editar | Aviso contra `closing_snapshot` |
| Server actions llamables sin sesión, con un `userId` ajeno (no hay RLS: la action es la única barrera) | `auth()` en las actions de ciclos (F1) y en todas (F2.0), antes de agregar las nuevas de la F3 |
| Escritura a medias en operaciones múltiples | `db.transaction` obligatorio (reglas de integridad) |
| Desfase de un día por la zona horaria (BD en UTC) | "Hoy" calculado en America/Santiago; fechas como `date`, no como `Date` de JS |
| Ítems de plantilla nunca confirmados inflan lo real o el pago pendiente | Lo real en TC exige `is_paid`; lo no confirmado aparece como "pendientes vencidos" |

## 12. Decisiones (asumidas; se pueden cambiar antes de la fase indicada)

Entrega del código: rama + PR (confirmado).


| # | Decisión | Asumido | Antes de |
|---|---|---|:-:|
| 1 | Ciclos cerrados | ✅ **Confirmado:** en vivo con aviso | F1 |
| 2 | Nombres en la UI | Propio · De otra persona · Reembolsable · Del fondo · Abono | F2 |
| 3 | Migraciones | Baseline nuevo | F2 |
| 4 | Techo excedido | Confirmación, sin bloqueo | F3 |
| 5 | Liquidación del fondo | Al pagar la TC; débito al cerrar | F3 |
| 6 | Cuenta del fondo | Fondo Backup | F3 |
| 7 | Ingreso esperado | Último sueldo, sin el aporte de Anais | F3 |

## Anexo A — Consulta prototipo (validada el 2026-10-10)

Esta es la base de `cycle-buckets.ts`. Se ejecutó en modo read-only sobre los 8 ciclos y reproduce §9.

```sql
with hoy as (select (now() at time zone 'America/Santiago')::date d),
tx as (
  select c.id cycle_id, t.*, a.type::text acc, xa.type::text contra, cat.name cat
  from n1n4_billing_cycles c
  join n1n4_transactions t on t.project_id = c.project_id
                          and t.date between c.start_date and c.end_date
  join n1n4_accounts a on a.id = t.account_id
  left join n1n4_transactions x  on x.id  = t.linked_transaction_id
  left join n1n4_accounts     xa on xa.id = x.account_id
  left join n1n4_categories   cat on cat.id = t.category_id
),
b as (
  select *,
    case
      when acc in ('checking','cash') and type = 'income' and linked_transaction_id is null
           and (cat in ('Reembolsos','Externo') or ltrim(description) ilike 'abono%')   -- F2: nature = 'reimbursement'
                                                                     then 'reimbursement'
      when acc in ('checking','cash') and type = 'income'  and linked_transaction_id is null then 'income'
      when acc in ('checking','cash') and type = 'expense' and linked_transaction_id is null then 'debit_expense'
      when acc in ('checking','cash') and type = 'expense' and contra = 'credit_card'        then 'card_payment'
      when acc in ('checking','cash') and type = 'expense'
           and contra in ('savings','pension','unemployment')                              then 'savings_in'
      when acc in ('checking','cash') and type = 'income'
           and contra in ('savings','pension','unemployment')                              then 'savings_out'
      when acc = 'credit_card' and type = 'expense'                                        then 'card_spend'
      when acc = 'credit_card' and type = 'income' and linked_transaction_id is null       then 'card_credit'
      else 'ignored'
    end as bucket,
    (is_paid and (acc <> 'credit_card' or date <= (select d from hoy))) as es_real
  from tx
)
select cycle_id, bucket, es_real, is_paid, sum(base_amount) total, count(*) n
from b
group by cycle_id, bucket, es_real, is_paid;
```

La cascada, lo real / comprometido y los indicadores se arman en TypeScript a partir de esta agregación: una sola consulta para todos los ciclos.

## Anexo B — Backtest del pago TC (2026-10-10)

Para cada ciclo, se compara el pago real con lo que predice la "vista estado de cuenta" del ciclo anterior (§3.3):

| Ciclo del pago | Pago real | Predicción (vista estado de cuenta) | Diferencia | Predicción solo por fecha | Diferencia |
|---|---:|---:|---:|---:|---:|
| Abril | 1.802.005 | 1.804.307 | 2.302 | 1.785.287 | −16.718 |
| Mayo | 2.264.792 | 2.264.792 | 0 | 2.264.793 | 1 |
| Junio | 2.007.738 | 2.007.892 | 154 | 2.203.563 | 195.825 |
| Julio | 2.186.801 | 2.193.489 | 6.688 | 2.322.883 | 136.082 |
| Agosto | 1.701.077 | 1.702.333 | 1.256 | 1.702.333 | 1.256 |
| Septiembre | 1.897.350 | 1.897.349 | −1 | 2.012.867 | 115.517 |
| Octubre | 1.247.795 | 1.247.793 | −2 | 1.481.791 | 233.996 |

Las diferencias pequeñas vienen de ajustes "Diferencia TC" e intereses. El verify script de la Fase 1 repite este backtest.

**Estado de Octubre con esta vista (al 10-10, día 16 de 31), con naturaleza inferida por categoría:**
- Propio: compras $764.699 + cuotas $41.093 + plantilla pendiente $32.593 = **$838.385**.
- Fondo: $331.875 (incluye el Airbnb reembolsable de $259.500, mal clasificado por el typo).
- Externo: $51.632.

Proyección: comprometido $266.162 + variable $572.223 × 31/16 ≈ **$1.375.000**.
