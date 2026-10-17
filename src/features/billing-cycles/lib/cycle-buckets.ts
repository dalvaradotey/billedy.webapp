import { sql, type SQL } from 'drizzle-orm';

/**
 * Clasificación única de transacciones para el saldo de caja de un ciclo.
 *
 * Cada transacción cae en UN bucket. Esta es la única definición: el saldo del
 * ciclo, el cierre, el dashboard y el resumen de transacciones la usan.
 * Ver docs/PLAN_SALDOS_CICLOS_Y_TECHO_TC.md §3.1 y Anexo A.
 */

export const BUCKETS = [
  'income', // ingreso en cuenta líquida
  'reimbursement', // abono / reembolso en cuenta líquida
  'debit_expense', // gasto directo en cuenta líquida
  'card_payment', // pago de TC (enlazado a la TC)
  'savings_in', // aporte a cuenta de ahorro (enlazado)
  'savings_out', // retiro desde cuenta de ahorro (enlazado)
  'provision_in', // apartar a una provisión (fondo para gastos que vienen)
  'provision_out', // liberar una provisión o pagar con ella
  'investment_in', // aporte a una inversión: sale de la caja, pero no es gasto
  'card_spend', // gasto en TC (informativo: se paga el próximo ciclo)
  'card_credit', // devolución / abono / ajuste en TC (informativo)
  'ignored', // contrapartes de enlaces y movimientos internos de ahorro
] as const;

export type Bucket = (typeof BUCKETS)[number];

/**
 * Las cuotas de TC quedan fechadas el día 5 del mes siguiente al estado de
 * cuenta que las cobra. Para armar la "vista estado de cuenta" de un ciclo se
 * suman las cuotas con fecha hasta 16 días después de su fin (validado contra
 * los pagos reales, Anexo B).
 */
export const INSTALLMENT_WINDOW_DAYS = 16;


export type DateRange = {
  key: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
};

export type Nature = 'own' | 'external' | 'reimbursable' | 'fund' | 'reimbursement';

export type BucketRow = {
  key: string;
  bucket: Bucket;
  nature: Nature;
  cardAccountId: string | null;
  inRange: boolean;
  isInstallment: boolean;
  isPaid: boolean;
  isReal: boolean;
  total: number;
  count: number;
};

/**
 * Agrega las transacciones del proyecto por rango, bucket y estado.
 * Una sola consulta para todos los rangos.
 *
 * - `inRange = false` solo aparece para filas en la ventana de cuotas
 *   (fin, fin + 16 días], usadas por la vista estado de cuenta.
 * - `isReal`: pagado y, en TC, con fecha <= hoy (las cuotas nacen pagadas
 *   aunque sean futuras).
 */
export function bucketAggregationQuery(
  projectId: string,
  ranges: DateRange[],
  today: string
): SQL {
  const rangeValues = sql.join(
    ranges.map((r) => sql`(${r.key}::text, ${r.start}::date, ${r.end}::date)`),
    sql`, `
  );

  return sql`
    with ranges(key, start_date, end_date) as (values ${rangeValues}),
    tx as (
      select
        r.key,
        r.end_date,
        t.type,
        t.base_amount,
        t.date,
        t.is_paid,
        t.nature::text as nature,
        t.investment_role,
        t.is_historically_paid,
        t.linked_transaction_id,
        t.card_purchase_id,
        t.account_id,
        a.type::text as acc,
        x.account_id as contra_account_id,
        xa.type::text as contra
      from ranges r
      join n1n4_transactions t
        on t.project_id = ${projectId}
       and t.date between r.start_date and r.end_date + ${INSTALLMENT_WINDOW_DAYS}::int
      join n1n4_accounts a on a.id = t.account_id
      left join n1n4_transactions x on x.id = t.linked_transaction_id
      left join n1n4_accounts xa on xa.id = x.account_id
    ),
    b as (
      select
        key,
        (date <= end_date) as in_range,
        (card_purchase_id is not null) as is_installment,
        is_paid,
        nature,
        (is_paid and not coalesce(is_historically_paid, false) and (acc <> 'credit_card' or date <= ${today}::date)) as is_real,
        base_amount,
        case
          when acc in ('checking', 'cash') and type = 'income' and linked_transaction_id is null
               and nature = 'reimbursement'
            then 'reimbursement'
          -- Plata de otra persona que entra (o un traspaso de esa plata): no es tuya ni es ahorro
          when acc in ('checking', 'cash') and nature = 'external' and (type = 'income' or linked_transaction_id is not null)
            then 'ignored'
          when acc in ('checking', 'cash') and type = 'income' and linked_transaction_id is null
            then 'income'
          when acc in ('checking', 'cash') and type = 'expense' and linked_transaction_id is null
               and investment_role = 'aporte'
            then 'investment_in'
          when acc in ('checking', 'cash') and type = 'expense' and linked_transaction_id is null
            then 'debit_expense'
          when acc in ('checking', 'cash') and type = 'expense' and contra = 'credit_card'
            then 'card_payment'
          when acc in ('checking', 'cash') and type = 'expense'
               and contra in ('savings', 'pension', 'unemployment')
            then 'savings_in'
          when acc in ('checking', 'cash') and type = 'income'
               and contra in ('savings', 'pension', 'unemployment')
            then 'savings_out'
          when acc = 'credit_card' and type = 'expense'
            then 'card_spend'
          when acc = 'credit_card' and type = 'income' and linked_transaction_id is null
            then 'card_credit'
          else 'ignored'
        end as bucket,
        case
          when acc = 'credit_card' then account_id
          when contra = 'credit_card' then contra_account_id
        end as card_account_id
      from tx
    )
    select
      key,
      bucket,
      nature,
      card_account_id,
      in_range,
      is_installment,
      is_paid,
      is_real,
      sum(base_amount)::text as total,
      count(*)::int as n
    from b
    where in_range or (bucket = 'card_spend' and is_installment)
    group by key, bucket, nature, card_account_id, in_range, is_installment, is_paid, is_real

    -- Fondos dentro de cuentas corrientes: apartar = aporte de ahorro, liberar = retiro.
    -- Las provisiones van aparte: bajan lo libre igual, pero no son ahorro.
    -- Los fondos de terceros no son tu ahorro; en cuentas de ahorro el fondo es solo una etiqueta.
    union all
    select
      r.key,
      case
        when f.is_provision then case when m.kind = 'allocate' then 'provision_in' else 'provision_out' end
        else case when m.kind = 'allocate' then 'savings_in' else 'savings_out' end
      end as bucket,
      'own' as nature,
      null as card_account_id,
      true as in_range,
      false as is_installment,
      true as is_paid,
      true as is_real,
      sum(m.amount)::text as total,
      count(*)::int as n
    from n1n4_account_funds f
    join n1n4_accounts a on a.id = f.account_id
    join ranges r on true
    join n1n4_fund_movements m on m.fund_id = f.id and m.date between r.start_date and r.end_date
    where f.project_id = ${projectId}
      and not f.is_third_party
      and a.type in ('checking', 'cash')
      and m.kind in ('allocate', 'release')
    group by r.key, m.kind, f.is_provision

    -- Gasto pagado con un fondo: se compensa (la plata se apartó antes, o no es tuya)
    union all
    select
      r.key,
      case when f.is_provision then 'provision_out' else 'savings_out' end as bucket,
      'own' as nature,
      null as card_account_id,
      true as in_range,
      false as is_installment,
      t.is_paid,
      t.is_paid as is_real,
      sum(t.base_amount)::text as total,
      count(*)::int as n
    from ranges r
    join n1n4_transactions t
      on t.project_id = ${projectId}
     and t.date between r.start_date and r.end_date
     and t.account_fund_id is not null
     and t.type = 'expense'
    join n1n4_account_funds f on f.id = t.account_fund_id
    join n1n4_accounts a on a.id = t.account_id
    where a.type in ('checking', 'cash')
    group by r.key, t.is_paid, f.is_provision
  `;
}

type RawBucketRow = {
  key: string;
  bucket: Bucket;
  nature: Nature;
  card_account_id: string | null;
  in_range: boolean;
  is_installment: boolean;
  is_paid: boolean;
  is_real: boolean;
  total: string;
  n: number;
};

export function parseBucketRows(rows: RawBucketRow[]): BucketRow[] {
  return rows.map((r) => ({
    key: r.key,
    bucket: r.bucket,
    nature: r.nature,
    cardAccountId: r.card_account_id,
    inRange: r.in_range,
    isInstallment: r.is_installment,
    isPaid: r.is_paid,
    isReal: r.is_real,
    total: Math.round(Number(r.total)),
    count: Number(r.n),
  }));
}
