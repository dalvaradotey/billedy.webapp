import { sql, type SQL } from 'drizzle-orm';

/**
 * Abonos reservados: un abono que llegó a una cuenta líquida por un gasto que
 * aún no sale de la caja (típicamente un gasto en TC que se paga el próximo
 * ciclo). Sin esto, el ciclo del abono se ve inflado y el del pago, castigado.
 *
 * Se usan los vínculos de "Por cobrar" (n1n4_settlements):
 * - Se reserva en la fecha del abono.
 * - Se libera cuando la plata sale: el pago de la tarjeta que cubrió el gasto
 *   (paid_by_transfer_id) o, si fue con débito, la fecha del gasto.
 * Si el abono llega después de que la plata salió, no hay nada que reservar.
 */

export type ReserveRow = {
  reservedOn: string; // YYYY-MM-DD
  /** null = el gasto aún no se paga */
  releasedOn: string | null;
  amount: number;
};

export function reserveRowsQuery(projectId: string, today: string): SQL {
  return sql`
    select * from (
      select
        r.date::date::text as reserved_on,
        coalesce(p.date, case when ea.type <> 'credit_card' then e.date end)::date::text as released_on,
        s.amount
      from n1n4_settlements s
      join n1n4_transactions r on r.id = s.settling_transaction_id
      join n1n4_accounts ra on ra.id = r.account_id
      join n1n4_transactions e on e.id = s.expense_id
      join n1n4_accounts ea on ea.id = e.account_id
      left join n1n4_transactions p on p.id = e.paid_by_transfer_id
      where e.project_id = ${projectId}
        and s.kind = 'transaction'
        and r.type = 'income'
        and r.is_paid
        and r.date <= ${today}::date
        and ra.type in ('checking', 'cash')
    ) x
    where released_on is null or released_on > reserved_on`;
}

export function parseReserveRows(rows: Record<string, unknown>[]): ReserveRow[] {
  return rows.map((r) => ({
    reservedOn: String(r.reserved_on),
    releasedOn: r.released_on == null ? null : String(r.released_on),
    amount: Math.round(Number(r.amount ?? 0)),
  }));
}

/**
 * Reservado y liberado en un rango: se reserva lo que llegó en el rango y no se
 * pagó dentro de él; se libera lo pagado en el rango que se había reservado antes.
 */
export function reservesForRange(reserves: ReserveRow[], start: string, end: string): { reserved: number; released: number } {
  let reserved = 0;
  let released = 0;
  for (const r of reserves) {
    const paidInside = r.releasedOn != null && r.releasedOn <= end;
    if (r.reservedOn >= start && r.reservedOn <= end && !paidInside) reserved += r.amount;
    if (r.releasedOn != null && r.releasedOn >= start && r.releasedOn <= end && r.reservedOn < start) released += r.amount;
  }
  return { reserved, released };
}
