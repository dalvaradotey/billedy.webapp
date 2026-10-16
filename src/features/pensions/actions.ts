'use server';

import { and, desc, eq, lte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { accounts, quotaValues } from '@/lib/db/schema';
import { invalidateRelatedCache } from '@/lib/cache';
import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import { verifyProjectAccess } from '@/features/transactions/lib/access';
import { AFC_FUND, AFC_PROVIDER, AFP_FUNDS, AFP_PROVIDERS } from './lib/quota-values';
import { latestQuotaValue, revaluePensionAccounts, syncQuotaValues } from './lib/sync';

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

export type PensionStatus = {
  provider: string | null;
  fund: string | null;
  quotaCount: number | null;
  quotaCountDate: string | null;
  quote: { date: string; value: number } | null;
};

async function accountForUser(accountId: string, userId: string) {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!account || !(await verifyProjectAccess(account.projectId, userId))) return null;
  if (account.type !== 'pension' && account.type !== 'unemployment') return null;
  return account;
}

/** Institución, fondo, cuotas y último valor cuota de una cuenta previsional */
export async function fetchPensionStatus(userId: string, accountId: string): Promise<ActionResult<PensionStatus>> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  const account = await accountForUser(accountId, userId);
  if (!account) return { success: false, error: 'Cuenta no encontrada' };
  const quote = account.pensionProvider && account.pensionFund ? await latestQuotaValue(account.pensionProvider, account.pensionFund) : null;
  return {
    success: true,
    data: {
      provider: account.pensionProvider,
      fund: account.pensionFund,
      quotaCount: account.quotaCount != null ? Number(account.quotaCount) : null,
      quotaCountDate: account.quotaCountDate,
      quote,
    },
  };
}

const configSchema = z
  .object({
    provider: z.string(),
    fund: z.string(),
    /** Cuotas que muestra la cartola o la página de la AFP */
    quotaCount: z.number().positive().nullable(),
    /** Si no se saben las cuotas: saldo en pesos de una fecha, y se calculan */
    balance: z.number().positive().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((d) => d.quotaCount != null || d.balance != null, { message: 'Ingresa tus cuotas o tu saldo' })
  .refine(
    (d) =>
      (d.provider === AFC_PROVIDER && d.fund === AFC_FUND) ||
      ((AFP_PROVIDERS as readonly string[]).includes(d.provider) && (AFP_FUNDS as readonly string[]).includes(d.fund)),
    { message: 'Institución o fondo inválido' }
  );

export type PensionConfigInput = z.infer<typeof configSchema>;

/**
 * Configura la cuenta para seguir su saldo por cuotas y la pone al día:
 * el saldo pasa a cuotas × último valor cuota sin crear un movimiento (la
 * diferencia acumulada no es rentabilidad de este mes).
 */
export async function configurePensionQuotas(
  userId: string,
  accountId: string,
  input: PensionConfigInput
): Promise<ActionResult<{ quotaCount: number; balance: number }>> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  const account = await accountForUser(accountId, userId);
  if (!account) return { success: false, error: 'Cuenta no encontrada' };
  const { provider, fund, date } = parsed.data;

  // Guardar institución y fondo primero: la sincronización descarga los fondos en uso
  await db.update(accounts).set({ pensionProvider: provider, pensionFund: fund, updatedAt: new Date() }).where(eq(accounts.id, accountId));

  let quotaCount = parsed.data.quotaCount;
  try {
    if (quotaCount == null) {
      await db.update(accounts).set({ quotaCount: '1' }).where(eq(accounts.id, accountId)); // para que la sincronización incluya el fondo
    }
    await syncQuotaValues();
  } catch {
    return { success: false, error: 'No pude leer el valor cuota público. Intenta de nuevo en un rato.' };
  }

  if (quotaCount == null) {
    // Valor cuota de esa fecha (o el último anterior)
    const [row] = await db
      .select({ value: quotaValues.value })
      .from(quotaValues)
      .where(and(eq(quotaValues.provider, provider), eq(quotaValues.fund, fund), lte(quotaValues.date, date)))
      .orderBy(desc(quotaValues.date))
      .limit(1);
    if (!row) return { success: false, error: 'No hay valor cuota para esa fecha' };
    quotaCount = Math.round((parsed.data.balance! / Number(row.value)) * 10000) / 10000;
  }

  const quote = await latestQuotaValue(provider, fund);
  if (!quote) return { success: false, error: 'No hay valor cuota disponible' };
  const balance = Math.round(quotaCount * quote.value);

  // Puesta al día: el saldo inicial absorbe la diferencia para que recalcular siga cuadrando
  const current = Number(account.currentBalance);
  await db
    .update(accounts)
    .set({
      quotaCount: String(quotaCount),
      quotaCountDate: date,
      initialBalance: String(Number(account.initialBalance) + (balance - current)),
      currentBalance: String(balance),
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, accountId));

  invalidateRelatedCache('accounts');
  return { success: true, data: { quotaCount, balance } };
}

/** Sincroniza ahora (además de la tarea diaria) */
export async function refreshPensionValues(userId: string, accountId: string): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  if (!(await accountForUser(accountId, userId))) return { success: false, error: 'Cuenta no encontrada' };
  try {
    await syncQuotaValues();
    await revaluePensionAccounts();
  } catch {
    return { success: false, error: 'No pude leer el valor cuota público' };
  }
  invalidateRelatedCache('accounts');
  return { success: true, data: undefined };
}
