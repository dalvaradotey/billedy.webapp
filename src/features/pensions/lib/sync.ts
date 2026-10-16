import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts, categories, quotaValues, transactions } from '@/lib/db/schema';
import { getToday } from '@/lib/formatting';
import { AFC_PROVIDER, fetchAfcQuotaValues, fetchAfpQuotaValues, type QuotaValue } from './quota-values';

/**
 * Previsión por cuotas: guarda el valor cuota del día y lleva el saldo de cada
 * cuenta de AFP / AFC a cuotas × valor cuota.
 *
 * El cambio de valor se registra como un único movimiento de rentabilidad por mes
 * y cuenta (se actualiza cada día), así el saldo sigue cuadrando con la suma de
 * movimientos cuando se recalcula la cuenta.
 */

/** Marca del movimiento automático de rentabilidad del mes */
export const QUOTA_REVALUE_NOTE = 'auto:rentabilidad-valor-cuota';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

type PensionAccount = {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  provider: string;
  fund: string;
  quotaCount: number;
  currentBalance: number;
};

async function pensionAccounts(): Promise<PensionAccount[]> {
  const rows = await db
    .select({
      id: accounts.id,
      userId: accounts.userId,
      projectId: accounts.projectId,
      name: accounts.name,
      provider: accounts.pensionProvider,
      fund: accounts.pensionFund,
      quotaCount: accounts.quotaCount,
      currentBalance: accounts.currentBalance,
    })
    .from(accounts)
    .where(and(isNotNull(accounts.pensionProvider), isNotNull(accounts.pensionFund), isNotNull(accounts.quotaCount), eq(accounts.isArchived, false)));
  return rows.map((r) => ({
    ...r,
    provider: r.provider!,
    fund: r.fund!,
    quotaCount: Number(r.quotaCount),
    currentBalance: Number(r.currentBalance),
  }));
}

/** Descarga el año en curso de los fondos que usan las cuentas y lo guarda. */
export async function syncQuotaValues(): Promise<{ saved: number; funds: string[] }> {
  const year = getToday().getUTCFullYear();
  const needed = new Map<string, { provider: string; fund: string }>();
  for (const a of await pensionAccounts()) needed.set(`${a.provider}:${a.fund}`, { provider: a.provider, fund: a.fund });

  const values: QuotaValue[] = [];
  const afpFunds = new Set([...needed.values()].filter((n) => n.provider !== AFC_PROVIDER).map((n) => n.fund));
  for (const fund of afpFunds) {
    const rows = await fetchAfpQuotaValues(year, fund);
    values.push(...rows.filter((r) => needed.has(`${r.provider}:${r.fund}`)));
  }
  if ([...needed.values()].some((n) => n.provider === AFC_PROVIDER)) {
    values.push(...(await fetchAfcQuotaValues(year)));
  }

  for (let i = 0; i < values.length; i += 200) {
    const chunk = values.slice(i, i + 200);
    await db
      .insert(quotaValues)
      .values(chunk.map((v) => ({ provider: v.provider, fund: v.fund, date: v.date, value: String(v.value) })))
      .onConflictDoUpdate({
        target: [quotaValues.provider, quotaValues.fund, quotaValues.date],
        set: { value: sql`excluded.value` },
      });
  }
  return { saved: values.length, funds: [...needed.keys()] };
}

export async function latestQuotaValue(provider: string, fund: string): Promise<{ date: string; value: number } | null> {
  const [row] = await db
    .select({ date: quotaValues.date, value: quotaValues.value })
    .from(quotaValues)
    .where(and(eq(quotaValues.provider, provider), eq(quotaValues.fund, fund)))
    .orderBy(desc(quotaValues.date))
    .limit(1);
  return row ? { date: row.date, value: Number(row.value) } : null;
}

/**
 * Lleva el saldo de cada cuenta previsional a cuotas × último valor cuota,
 * ajustando el movimiento de rentabilidad del mes.
 */
export async function revaluePensionAccounts(): Promise<{ account: string; balance: number; delta: number }[]> {
  const today = getToday();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const results: { account: string; balance: number; delta: number }[] = [];

  for (const account of await pensionAccounts()) {
    const quote = await latestQuotaValue(account.provider, account.fund);
    if (!quote) continue;
    const target = Math.round(account.quotaCount * quote.value);

    const [existing] = await db
      .select({ id: transactions.id, type: transactions.type, amount: transactions.baseAmount })
      .from(transactions)
      .where(and(eq(transactions.accountId, account.id), eq(transactions.notes, QUOTA_REVALUE_NOTE), gte(transactions.date, monthStart)))
      .limit(1);
    const existingEffect = existing ? (existing.type === 'income' ? 1 : -1) * Number(existing.amount) : 0;
    // Saldo sin la rentabilidad automática del mes
    const base = account.currentBalance - existingEffect;
    const delta = target - base;

    if (Math.abs(delta) < 1) {
      if (existing) await db.delete(transactions).where(eq(transactions.id, existing.id));
    } else {
      const [category] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.projectId, account.projectId), sql`lower(${categories.name}) = lower(${`Rentabilidad ${account.name}`})`))
        .limit(1);
      const values = {
        type: (delta > 0 ? 'income' : 'expense') as 'income' | 'expense',
        originalAmount: String(Math.abs(delta)),
        baseAmount: String(Math.abs(delta)),
        // Hoy (no la fecha del valor): así el movimiento siempre cae en el mes en curso
        date: today,
        description: `Rentabilidad ${MONTHS[today.getUTCMonth()]} (valor cuota)`,
        categoryId: category?.id ?? null,
        updatedAt: new Date(),
      };
      if (existing) {
        await db.update(transactions).set(values).where(eq(transactions.id, existing.id));
      } else {
        await db.insert(transactions).values({
          ...values,
          userId: account.userId,
          projectId: account.projectId,
          accountId: account.id,
          originalCurrency: 'CLP',
          baseCurrency: 'CLP',
          exchangeRate: '1',
          isPaid: true,
          nature: 'own',
          notes: QUOTA_REVALUE_NOTE,
        });
      }
    }

    await db.update(accounts).set({ currentBalance: String(target), updatedAt: new Date() }).where(eq(accounts.id, account.id));
    results.push({ account: account.name, balance: target, delta: Math.round(delta) });
  }
  return results;
}
