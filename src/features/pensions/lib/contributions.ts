import { and, desc, eq, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts, categories, pensionContributions, quotaValues, transactions } from '@/lib/db/schema';
import { updateAccountBalance } from '@/features/accounts/lib/balance';
import { AFC_PROVIDER } from './quota-values';
import type { ParsedContribution } from './afc-documents';
import { MONTHS_LONG as MONTHS } from '@/lib/dates';

/**
 * Cotizaciones de AFP / AFC.
 *
 * - Lo pagado hasta la fecha de las cuotas configuradas ya está dentro de esas
 *   cuotas: se guarda solo como historial (imponible, fechas).
 * - Lo posterior suma cuotas y un movimiento de aporte a la cuenta, para que el
 *   ajuste diario por valor cuota no lo cuente como rentabilidad.
 */

/** Cuándo llega y cuánto es cada mes, según lo observado en las cartolas */
export const CONTRIBUTION_RULES = {
  afp: { windowStartDay: 12, windowEndDay: 20 },
  afc: { windowStartDay: 6, windowEndDay: 12 },
} as const;

export const periodLabel = (period: string) => `${MONTHS[parseInt(period.slice(5, 7), 10) - 1]} ${period.slice(0, 4)}`;

const addMonths = (period: string, n: number) => {
  const d = new Date(`${period}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};
const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;

type PensionAccountRow = typeof accounts.$inferSelect;

export type ExpectedContribution = {
  period: string;
  windowStart: string;
  windowEnd: string;
  /** Monto estimado: el de la última cotización conocida */
  amount: number | null;
  status: 'upcoming' | 'due' | 'late';
};

/**
 * Cotizaciones que deberían haber llegado (o están por llegar) y aún no están:
 * desde la fecha de las cuotas configuradas, una por mes cotizado.
 */
export function expectedContributions(
  account: Pick<PensionAccountRow, 'pensionProvider' | 'quotaCountDate'>,
  history: { period: string; amount: number }[],
  todayIso: string
): ExpectedContribution[] {
  if (!account.pensionProvider || !account.quotaCountDate) return [];
  const rule = account.pensionProvider === AFC_PROVIDER ? CONTRIBUTION_RULES.afc : CONTRIBUTION_RULES.afp;
  const known = new Set(history.map((h) => h.period));
  const lastAmount = history.length ? history[history.length - 1].amount : null;
  const window = (period: string) => {
    const next = addMonths(period, 1);
    return { start: `${next.slice(0, 8)}${String(rule.windowStartDay).padStart(2, '0')}`, end: `${next.slice(0, 8)}${String(rule.windowEndDay).padStart(2, '0')}` };
  };

  // El primer mes esperado es el primero cuya ventana empieza después de las cuotas configuradas
  let period = addMonths(monthStart(account.quotaCountDate), -1);
  while (window(period).start <= account.quotaCountDate) period = addMonths(period, 1);

  const result: ExpectedContribution[] = [];
  // Hasta el mes cuya ventana es la próxima (para mostrar lo que viene)
  for (let i = 0; i < 24; i++, period = addMonths(period, 1)) {
    const w = window(period);
    if (w.start > addMonths(todayIso, 1)) break;
    if (known.has(period)) continue;
    result.push({
      period,
      windowStart: w.start,
      windowEnd: w.end,
      amount: lastAmount,
      status: todayIso < w.start ? 'upcoming' : todayIso <= addDays(w.end, 5) ? 'due' : 'late',
    });
  }
  return result;
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function quotaValueAt(provider: string, fund: string, date: string): Promise<number | null> {
  const [row] = await db
    .select({ value: quotaValues.value })
    .from(quotaValues)
    .where(and(eq(quotaValues.provider, provider), eq(quotaValues.fund, fund), lte(quotaValues.date, date)))
    .orderBy(desc(quotaValues.date))
    .limit(1);
  return row ? Number(row.value) : null;
}

/**
 * Guarda una cotización. Si es posterior a las cuotas configuradas y no se había
 * aplicado, suma sus cuotas (las informadas o monto ÷ valor cuota del día) y un
 * movimiento de aporte en la cuenta.
 */
export async function saveContribution(
  account: PensionAccountRow,
  c: ParsedContribution,
  source: string
): Promise<'applied' | 'history' | 'skipped'> {
  const [existing] = await db
    .select()
    .from(pensionContributions)
    .where(and(eq(pensionContributions.accountId, account.id), eq(pensionContributions.period, c.period)))
    .limit(1);

  const afterQuotas = account.quotaCountDate != null && c.paidDate > account.quotaCountDate;

  if (existing) {
    // Completar datos que faltaban (p. ej. cuotas de la cartola sobre un registro del certificado)
    await db
      .update(pensionContributions)
      .set({
        taxableIncome: existing.taxableIncome ?? (c.taxableIncome != null ? String(c.taxableIncome) : null),
        quotas: existing.quotas ?? (c.quotas != null ? String(c.quotas) : null),
        paidDate: existing.paidDate ?? c.paidDate,
        employerRut: existing.employerRut ?? c.employerRut,
      })
      .where(eq(pensionContributions.id, existing.id));
    if (existing.applied || !afterQuotas) return 'skipped';
  }

  if (!afterQuotas) {
    if (!existing) {
      await db.insert(pensionContributions).values({
        projectId: account.projectId,
        accountId: account.id,
        period: c.period,
        paidDate: c.paidDate,
        taxableIncome: c.taxableIncome != null ? String(c.taxableIncome) : null,
        amount: String(c.amount),
        quotas: c.quotas != null ? String(c.quotas) : null,
        employerRut: c.employerRut,
        source,
      });
    }
    return 'history';
  }

  // Aplicar: cuotas + movimiento de aporte
  const value = account.pensionProvider && account.pensionFund ? await quotaValueAt(account.pensionProvider, account.pensionFund, c.paidDate) : null;
  const quotas = c.quotas ?? (value ? Math.round((c.amount / value) * 10000) / 10000 : null);
  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.projectId, account.projectId), sql`lower(${categories.name}) = lower(${`Aporte ${account.name}`})`))
    .limit(1);
  const [tx] = await db
    .insert(transactions)
    .values({
      userId: account.userId,
      projectId: account.projectId,
      accountId: account.id,
      categoryId: category?.id ?? null,
      type: 'income',
      nature: 'own',
      description: `Cotización ${periodLabel(c.period)}`,
      date: new Date(`${c.paidDate}T00:00:00Z`),
      isPaid: true,
      originalAmount: String(c.amount),
      originalCurrency: 'CLP',
      baseAmount: String(c.amount),
      baseCurrency: 'CLP',
      exchangeRate: '1',
    })
    .returning({ id: transactions.id });
  await updateAccountBalance(account.id, c.amount);
  if (quotas) {
    await db
      .update(accounts)
      .set({ quotaCount: sql`${accounts.quotaCount} + ${String(quotas)}::numeric`, updatedAt: new Date() })
      .where(eq(accounts.id, account.id));
  }

  const values = {
    paidDate: c.paidDate,
    taxableIncome: c.taxableIncome != null ? String(c.taxableIncome) : null,
    amount: String(c.amount),
    quotas: quotas != null ? String(quotas) : null,
    employerRut: c.employerRut,
    applied: true,
    transactionId: tx.id,
  };
  if (existing) {
    await db.update(pensionContributions).set(values).where(eq(pensionContributions.id, existing.id));
  } else {
    await db.insert(pensionContributions).values({ projectId: account.projectId, accountId: account.id, period: c.period, source, ...values });
  }
  return 'applied';
}
