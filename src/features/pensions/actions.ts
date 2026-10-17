'use server';

import { and, asc, desc, eq, lte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { accounts, pensionContributions, quotaValues } from '@/lib/db/schema';
import { invalidateRelatedCache } from '@/lib/cache';
import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import { verifyProjectAccess, verifyProjectWriteAccess } from '@/lib/auth/project-access';
import type { ActionResult } from '@/types/action-result';
import { AFC_FUND, AFC_PROVIDER, AFP_FUNDS, AFP_PROVIDERS } from './lib/quota-values';
import { latestQuotaValue, revaluePensionAccounts, syncQuotaValues } from './lib/sync';
import { expectedContributions, saveContribution, type ExpectedContribution } from './lib/contributions';
import { parseAfcDocument } from './lib/afc-documents';
import { pdfToLines } from '@/features/statements/lib/pdf-lines';
import { getToday } from '@/lib/formatting';

export type PensionStatus = {
  provider: string | null;
  fund: string | null;
  quotaCount: number | null;
  quotaCountDate: string | null;
  quote: { date: string; value: number } | null;
  /** Últimas cotizaciones registradas (más reciente primero) */
  recent: { period: string; paidDate: string | null; amount: number; taxableIncome: number | null; applied: boolean }[];
  expected: ExpectedContribution[];
};

/** Cuenta previsional del usuario; con `write`, exige rol que pueda modificar */
async function accountForUser(accountId: string, userId: string, options: { write?: boolean } = {}) {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  const verify = options.write ? verifyProjectWriteAccess : verifyProjectAccess;
  if (!account || !(await verify(account.projectId, userId))) return null;
  if (account.type !== 'pension' && account.type !== 'unemployment') return null;
  return account;
}

/** Institución, fondo, cuotas y último valor cuota de una cuenta previsional */
export async function fetchPensionStatus(userId: string, accountId: string): Promise<ActionResult<PensionStatus>> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  const account = await accountForUser(accountId, userId);
  if (!account) return { success: false, error: 'Cuenta no encontrada' };
  const [quote, history] = await Promise.all([
    account.pensionProvider && account.pensionFund ? latestQuotaValue(account.pensionProvider, account.pensionFund) : null,
    db
      .select()
      .from(pensionContributions)
      .where(eq(pensionContributions.accountId, accountId))
      .orderBy(asc(pensionContributions.period)),
  ]);
  const expected = expectedContributions(
    account,
    history.map((h) => ({ period: h.period, amount: Number(h.amount) })),
    getToday().toISOString().slice(0, 10)
  );
  return {
    success: true,
    data: {
      provider: account.pensionProvider,
      fund: account.pensionFund,
      quotaCount: account.quotaCount != null ? Number(account.quotaCount) : null,
      quotaCountDate: account.quotaCountDate,
      quote,
      recent: history
        .slice(-6)
        .reverse()
        .map((h) => ({
          period: h.period,
          paidDate: h.paidDate,
          amount: Number(h.amount),
          taxableIncome: h.taxableIncome != null ? Number(h.taxableIncome) : null,
          applied: h.applied,
        })),
      expected,
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
  const account = await accountForUser(accountId, userId, { write: true });
  if (!account) return { success: false, error: 'Cuenta no encontrada' };
  const { provider, fund, date } = parsed.data;

  // Guardar institución y fondo primero: la sincronización descarga los fondos en uso
  await db
    .update(accounts)
    .set({ pensionProvider: provider, pensionFund: fund, updatedAt: new Date() })
    .where(and(eq(accounts.id, accountId), eq(accounts.projectId, account.projectId)));

  let quotaCount = parsed.data.quotaCount;
  try {
    // El fondo que se está configurando se descarga aunque la cuenta aún no tenga cuotas
    const synced = await syncQuotaValues([{ provider, fund }]);
    if (synced.saved === 0) throw new Error('sin valores');
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

  // Resguardo en la primera configuración: un saldo 10 veces mayor o menor al
  // actual casi seguro es un error al escribir las cuotas (al corregir se omite)
  const current0 = Number(account.currentBalance);
  if (account.quotaCount == null && current0 > 0 && (balance > current0 * 10 || balance < current0 / 10)) {
    return {
      success: false,
      error: `Con ${quotaCount.toLocaleString('es-CL')} cuotas el saldo quedaría en $${balance.toLocaleString('es-CL')}. Revisa el número de cuotas (usa coma para los decimales).`,
    };
  }

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
    .where(and(eq(accounts.id, accountId), eq(accounts.projectId, account.projectId)));

  invalidateRelatedCache('accounts');
  return { success: true, data: { quotaCount, balance } };
}

/** Sincroniza ahora (además de la tarea diaria) */
export async function refreshPensionValues(userId: string, accountId: string): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  if (!(await accountForUser(accountId, userId, { write: true }))) return { success: false, error: 'Cuenta no encontrada' };
  try {
    await syncQuotaValues();
    await revaluePensionAccounts();
  } catch {
    return { success: false, error: 'No pude leer el valor cuota público' };
  }
  invalidateRelatedCache('accounts');
  return { success: true, data: undefined };
}

const confirmSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}-01$/),
  amount: z.number().int().positive(),
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Confirma a mano una cotización acreditada: suma sus cuotas y el aporte */
export async function confirmContribution(
  userId: string,
  accountId: string,
  input: z.infer<typeof confirmSchema>
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Datos inválidos' };
  const account = await accountForUser(accountId, userId, { write: true });
  if (!account) return { success: false, error: 'Cuenta no encontrada' };
  if (!account.quotaCountDate) return { success: false, error: 'Configura primero las cuotas de la cuenta' };
  const { period, amount, paidDate } = parsed.data;
  await saveContribution(account, { period, amount, paidDate, quotas: null, taxableIncome: null, employerRut: null }, 'manual');
  invalidateRelatedCache('accounts');
  return { success: true, data: undefined };
}

export type ImportSummary = {
  kind: 'certificado' | 'cartola';
  periods: number;
  applied: number;
  history: number;
  /** La cartola era más nueva que las cuotas configuradas y las corrigió */
  quotasUpdated: { from: number; to: number; date: string } | null;
};

/**
 * Importa un documento de AFC (cartola de movimientos o certificado de
 * cotizaciones). Lo anterior a las cuotas configuradas queda como historial.
 */
export async function importPensionDocument(
  userId: string,
  accountId: string,
  formData: FormData
): Promise<ActionResult<ImportSummary>> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  let account = await accountForUser(accountId, userId, { write: true });
  if (!account) return { success: false, error: 'Cuenta no encontrada' };
  const file = formData.get('file');
  if (!(file instanceof File) || file.size > 5 * 1024 * 1024) return { success: false, error: 'Sube el PDF (máximo 5 MB)' };

  let doc;
  try {
    doc = parseAfcDocument(await pdfToLines(new Uint8Array(await file.arrayBuffer())));
  } catch {
    return { success: false, error: 'No pude leer el PDF' };
  }
  if (!doc) return { success: false, error: 'No reconozco este documento. Sube la cartola de movimientos o el certificado de cotizaciones de AFC.' };
  if (account.pensionProvider !== AFC_PROVIDER) return { success: false, error: 'Este documento es de AFC; súbelo en la cuenta de cesantía.' };

  // Cartola más nueva que las cuotas configuradas: sus cuotas al cierre son las exactas
  let quotasUpdated: ImportSummary['quotasUpdated'] = null;
  if (doc.kind === 'cartola' && doc.closing && (!account.quotaCountDate || doc.closing.date > account.quotaCountDate)) {
    // Lo ya aplicado después del cierre de la cartola no está en ese saldo: se vuelve a sumar
    const later = await db
      .select({ quotas: pensionContributions.quotas, paidDate: pensionContributions.paidDate })
      .from(pensionContributions)
      .where(and(eq(pensionContributions.accountId, accountId), eq(pensionContributions.applied, true)));
    const laterQuotas = later
      .filter((c) => c.paidDate && c.paidDate > doc.closing!.date)
      .reduce((acc, c) => acc + Number(c.quotas ?? 0), 0);
    const total = Math.round((doc.closing.quotas + laterQuotas) * 10000) / 10000;
    quotasUpdated = { from: Number(account.quotaCount ?? 0), to: total, date: doc.closing.date };
    await db
      .update(accounts)
      .set({ quotaCount: String(total), quotaCountDate: doc.closing.date, updatedAt: new Date() })
      .where(and(eq(accounts.id, accountId), eq(accounts.projectId, account.projectId)));
    account = (await accountForUser(accountId, userId))!;
  }

  let applied = 0;
  let history = 0;
  for (const c of doc.contributions) {
    const result = await saveContribution(account, c, doc.kind === 'cartola' ? 'afc_cartola' : 'afc_certificado');
    if (result === 'applied') applied++;
    if (result === 'history') history++;
    if (result === 'applied') account = (await accountForUser(accountId, userId))!;
  }

  if (quotasUpdated) await revaluePensionAccounts();
  invalidateRelatedCache('accounts');
  return { success: true, data: { kind: doc.kind, periods: doc.contributions.length, applied, history, quotasUpdated } };
}
