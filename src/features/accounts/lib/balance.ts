import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

/** `db` o la `tx` de un `db.transaction(...)`, para escribir dentro de una transacción */
export type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Ajusta el saldo de una cuenta (uso interno de las actions de transacciones).
 * No es una server action: no debe quedar expuesta como endpoint.
 *
 * El ajuste se hace en una sola sentencia SQL para que dos operaciones
 * simultáneas no se pisen. En tarjetas de crédito el delta se invierte:
 * un gasto (delta negativo) aumenta la deuda; un pago (positivo) la disminuye.
 */
export async function updateAccountBalance(
  accountId: string,
  amountDelta: number, // Positivo para ingresos, negativo para gastos
  executor: DbExecutor = db
): Promise<void> {
  const delta = String(amountDelta);

  await executor
    .update(accounts)
    .set({
      currentBalance: sql`${accounts.currentBalance} + case when ${accounts.type} = 'credit_card' then -(${delta}::numeric) else ${delta}::numeric end`,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, accountId));

  // No invalidamos caché aquí: las actions que la llaman ya invalidan
}
