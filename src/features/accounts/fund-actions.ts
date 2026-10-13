'use server';

import { z } from 'zod';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accountFunds, accounts, fundMovements, projectMembers } from '@/lib/db/schema';
import { invalidateRelatedCache } from '@/lib/cache';
import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import { getToday } from '@/lib/formatting';
import { getAccountFree, getAccountFunds, type AccountFund } from './lib/funds';

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

const amount = z.number().int().positive('El monto debe ser mayor a 0');

const createFundSchema = z.object({
  projectId: z.string().uuid(),
  accountId: z.string().uuid(),
  name: z.string().trim().min(1, 'El nombre es requerido').max(255),
  initialAmount: z.number().int().nonnegative().optional(),
  targetAmount: z.number().int().positive().nullable().optional(),
  isThirdParty: z.boolean().optional(),
  isProvision: z.boolean().optional(),
});

export type CreateFundInput = z.infer<typeof createFundSchema>;

async function isMember(projectId: string, userId: string): Promise<boolean> {
  const [member] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId), isNotNull(projectMembers.acceptedAt)))
    .limit(1);
  return !!member;
}

/** Fondo con verificación de acceso; incluye su saldo actual */
async function getFundForUser(fundId: string, userId: string): Promise<AccountFund & { projectId: string } | null> {
  const [fund] = await db
    .select({ id: accountFunds.id, projectId: accountFunds.projectId })
    .from(accountFunds)
    .where(eq(accountFunds.id, fundId))
    .limit(1);
  if (!fund || !(await isMember(fund.projectId, userId))) return null;
  const all = await getAccountFunds(fund.projectId, true);
  const detail = all.find((f) => f.id === fundId);
  return detail ? { ...detail, projectId: fund.projectId } : null;
}

function invalidate() {
  invalidateRelatedCache('accounts');
  invalidateRelatedCache('billingCycles');
}

/**
 * Fondos del proyecto (para el formulario de gasto y la página de cuentas).
 */
export async function fetchAccountFunds(
  projectId: string,
  userId: string
): Promise<ActionResult<AccountFund[]>> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  if (!(await isMember(projectId, userId))) return { success: false, error: 'No tienes acceso a este proyecto' };
  return { success: true, data: await getAccountFunds(projectId) };
}

/**
 * Crea un fondo en una cuenta (no TC). El saldo inicial sale del libre de la
 * cuenta y no cuenta como ahorro del ciclo (registra plata ya apartada).
 */
export async function createFund(userId: string, input: CreateFundInput): Promise<ActionResult<{ id: string }>> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };

  const parsed = createFundSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  const data = parsed.data;

  if (!(await isMember(data.projectId, userId))) return { success: false, error: 'No tienes acceso a este proyecto' };

  const [account] = await db
    .select({ id: accounts.id, type: accounts.type })
    .from(accounts)
    .where(and(eq(accounts.id, data.accountId), eq(accounts.projectId, data.projectId)))
    .limit(1);
  if (!account) return { success: false, error: 'Cuenta no encontrada' };
  if (account.type === 'credit_card') return { success: false, error: 'Los fondos no aplican a tarjetas de crédito' };

  const initial = data.initialAmount ?? 0;
  if (initial > 0) {
    const free = (await getAccountFree(data.projectId, data.accountId)) ?? 0;
    if (initial > free) {
      return { success: false, error: `El saldo inicial supera lo libre de la cuenta ($${free.toLocaleString('es-CL')})` };
    }
  }

  const id = await db.transaction(async (tx) => {
    const [fund] = await tx
      .insert(accountFunds)
      .values({
        projectId: data.projectId,
        accountId: data.accountId,
        name: data.name,
        targetAmount: data.targetAmount != null ? String(data.targetAmount) : null,
        isThirdParty: data.isThirdParty ?? false,
        // Una provisión es tuya: no puede ser de terceros a la vez
        isProvision: !data.isThirdParty && (data.isProvision ?? false),
      })
      .returning({ id: accountFunds.id });
    if (initial > 0) {
      await tx.insert(fundMovements).values({ fundId: fund.id, kind: 'initial', amount: String(initial), date: getToday() });
    }
    return fund.id;
  });

  invalidate();
  return { success: true, data: { id } };
}

/**
 * Aparta plata del libre de la cuenta hacia el fondo.
 * En cuentas corrientes cuenta como ahorro del ciclo (salvo fondos de terceros).
 */
export async function allocateToFund(
  userId: string,
  fundId: string,
  value: number,
  notes?: string
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  const parsedAmount = amount.safeParse(value);
  if (!parsedAmount.success) return { success: false, error: parsedAmount.error.issues[0].message };

  const fund = await getFundForUser(fundId, userId);
  if (!fund || fund.isArchived) return { success: false, error: 'Fondo no encontrado' };

  const free = (await getAccountFree(fund.projectId, fund.accountId)) ?? 0;
  if (value > free) {
    return { success: false, error: `No alcanza: lo libre de la cuenta es $${free.toLocaleString('es-CL')}` };
  }

  await db.insert(fundMovements).values({
    fundId,
    kind: 'allocate',
    amount: String(value),
    date: getToday(),
    notes: notes?.slice(0, 500) || null,
  });

  invalidate();
  return { success: true, data: undefined };
}

/**
 * Devuelve plata del fondo al libre de la cuenta.
 */
export async function releaseFromFund(
  userId: string,
  fundId: string,
  value: number,
  notes?: string
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  const parsedAmount = amount.safeParse(value);
  if (!parsedAmount.success) return { success: false, error: parsedAmount.error.issues[0].message };

  const fund = await getFundForUser(fundId, userId);
  if (!fund) return { success: false, error: 'Fondo no encontrado' };
  if (value > fund.balance) {
    return { success: false, error: `El fondo solo tiene $${fund.balance.toLocaleString('es-CL')}` };
  }

  await db.insert(fundMovements).values({
    fundId,
    kind: 'release',
    amount: String(value),
    date: getToday(),
    notes: notes?.slice(0, 500) || null,
  });

  invalidate();
  return { success: true, data: undefined };
}

/**
 * Cambia nombre, meta o si es provisión. Pasar a provisión (o volver) reclasifica
 * sus movimientos en los ciclos: se calculan en vivo.
 */
export async function updateFund(
  userId: string,
  fundId: string,
  input: { name?: string; targetAmount?: number | null; isProvision?: boolean }
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  const parsed = z
    .object({
      name: z.string().trim().min(1, 'El nombre es requerido').max(255).optional(),
      targetAmount: z.number().int().positive().nullable().optional(),
      isProvision: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };

  const fund = await getFundForUser(fundId, userId);
  if (!fund) return { success: false, error: 'Fondo no encontrado' };

  await db
    .update(accountFunds)
    .set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.targetAmount !== undefined
        ? { targetAmount: parsed.data.targetAmount != null ? String(parsed.data.targetAmount) : null }
        : {}),
      ...(parsed.data.isProvision !== undefined && !fund.isThirdParty ? { isProvision: parsed.data.isProvision } : {}),
      updatedAt: new Date(),
    })
    .where(eq(accountFunds.id, fundId));

  invalidate();
  return { success: true, data: undefined };
}

/**
 * Mueve el fondo a otra cuenta (cuando trasladas esa plata en el banco).
 * Registra la transferencia entre cuentas por separado; esto solo reasigna el fondo.
 */
export async function moveFund(userId: string, fundId: string, targetAccountId: string): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };

  const fund = await getFundForUser(fundId, userId);
  if (!fund) return { success: false, error: 'Fondo no encontrado' };
  if (fund.accountId === targetAccountId) return { success: false, error: 'El fondo ya está en esa cuenta' };

  const [target] = await db
    .select({ id: accounts.id, type: accounts.type })
    .from(accounts)
    .where(and(eq(accounts.id, targetAccountId), eq(accounts.projectId, fund.projectId)))
    .limit(1);
  if (!target || target.type === 'credit_card') return { success: false, error: 'Cuenta de destino inválida' };

  await db.update(accountFunds).set({ accountId: targetAccountId, updatedAt: new Date() }).where(eq(accountFunds.id, fundId));

  invalidate();
  return { success: true, data: undefined };
}

/**
 * Archiva un fondo vacío (o lo restaura).
 */
export async function archiveFund(userId: string, fundId: string, isArchived: boolean): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };

  const fund = await getFundForUser(fundId, userId);
  if (!fund) return { success: false, error: 'Fondo no encontrado' };
  if (isArchived && fund.balance !== 0) {
    return { success: false, error: 'Libera o usa el saldo del fondo antes de archivarlo' };
  }

  await db
    .update(accountFunds)
    .set({ isArchived, updatedAt: sql`now()` })
    .where(eq(accountFunds.id, fundId));

  invalidate();
  return { success: true, data: undefined };
}
