'use server';

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { investments, transactions } from '@/lib/db/schema';
import { invalidateRelatedCache } from '@/lib/cache';
import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import { NO_PROJECT_ACCESS, verifyProjectAccess, verifyProjectWriteAccess } from '@/lib/auth/project-access';
import type { ActionResult } from '@/types/action-result';

export type InvestmentRole = 'aporte' | 'costo' | 'retorno';

export type InvestmentMovement = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  role: InvestmentRole;
};

export type InvestmentSummary = {
  id: string;
  name: string;
  notes: string | null;
  startedAt: string | null;
  closedAt: string | null;
  invested: number;
  income: number;
  costs: number;
  /** Retorno neto = ingresos − costos */
  netReturn: number;
  /** Resultado = retorno neto − invertido */
  result: number;
  movements: InvestmentMovement[];
};

const iso = (d: Date | string) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/** Inversiones del proyecto con sus movimientos y totales */
export async function fetchInvestments(userId: string, projectId: string): Promise<ActionResult<InvestmentSummary[]>> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  if (!(await verifyProjectAccess(projectId, userId))) return { success: false, error: NO_PROJECT_ACCESS };

  const [list, moves] = await Promise.all([
    db.select().from(investments).where(eq(investments.projectId, projectId)).orderBy(desc(investments.createdAt)),
    db
      .select({
        id: transactions.id,
        investmentId: transactions.investmentId,
        role: transactions.investmentRole,
        date: transactions.date,
        description: transactions.description,
        amount: transactions.baseAmount,
        type: transactions.type,
      })
      .from(transactions)
      .where(and(eq(transactions.projectId, projectId), sql`${transactions.investmentId} is not null`))
      .orderBy(transactions.date),
  ]);

  return {
    success: true,
    data: list.map((inv) => {
      const movements: InvestmentMovement[] = moves
        .filter((m) => m.investmentId === inv.id)
        .map((m) => ({
          id: m.id,
          date: iso(m.date),
          description: m.description,
          amount: Number(m.amount),
          type: m.type,
          role: (m.role ?? (m.type === 'income' ? 'retorno' : 'aporte')) as InvestmentRole,
        }));
      const sum = (role: InvestmentRole) => movements.filter((m) => m.role === role).reduce((acc, m) => acc + m.amount, 0);
      const invested = sum('aporte');
      const income = sum('retorno');
      const costs = sum('costo');
      return {
        id: inv.id,
        name: inv.name,
        notes: inv.notes,
        startedAt: inv.startedAt,
        closedAt: inv.closedAt,
        invested,
        income,
        costs,
        netReturn: income - costs,
        result: income - costs - invested,
        movements,
      };
    }),
  };
}

const investmentSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(255),
  notes: z.string().trim().max(1000).nullable().optional(),
  startedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function createInvestment(
  userId: string,
  projectId: string,
  input: z.infer<typeof investmentSchema>
): Promise<ActionResult<{ id: string }>> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  if (!(await verifyProjectWriteAccess(projectId, userId))) return { success: false, error: NO_PROJECT_ACCESS };
  const parsed = investmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  const [row] = await db
    .insert(investments)
    .values({ projectId, name: parsed.data.name, notes: parsed.data.notes ?? null, startedAt: parsed.data.startedAt ?? null })
    .returning({ id: investments.id });
  return { success: true, data: { id: row.id } };
}

/** Inversión del usuario con acceso de escritura a su proyecto (para mutaciones) */
async function investmentForWrite(investmentId: string, userId: string) {
  const [inv] = await db.select().from(investments).where(eq(investments.id, investmentId)).limit(1);
  if (!inv || !(await verifyProjectWriteAccess(inv.projectId, userId))) return null;
  return inv;
}

const updateInvestmentSchema = investmentSchema.extend({ closed: z.boolean().optional() });

const linksSchema = z.array(
  z.object({
    transactionId: z.string().uuid(),
    role: z.enum(['aporte', 'costo', 'retorno']),
  })
);

export async function updateInvestment(
  userId: string,
  investmentId: string,
  input: z.infer<typeof investmentSchema> & { closed?: boolean }
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  const inv = await investmentForWrite(investmentId, userId);
  if (!inv) return { success: false, error: 'Inversión no encontrada' };
  const parsed = updateInvestmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  const { closed } = parsed.data;
  await db
    .update(investments)
    .set({
      name: parsed.data.name,
      notes: parsed.data.notes ?? null,
      startedAt: parsed.data.startedAt ?? null,
      ...(closed !== undefined ? { closedAt: closed ? new Date().toISOString().slice(0, 10) : null } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(investments.id, investmentId), eq(investments.projectId, inv.projectId)));
  return { success: true, data: undefined };
}

/** Borra la inversión; sus movimientos quedan, pero sin asociar */
export async function deleteInvestment(userId: string, investmentId: string): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  const inv = await investmentForWrite(investmentId, userId);
  if (!inv) return { success: false, error: 'Inversión no encontrada' };
  await db.transaction(async (tx) => {
    await tx
      .update(transactions)
      .set({ investmentId: null, investmentRole: null })
      .where(and(eq(transactions.investmentId, investmentId), eq(transactions.projectId, inv.projectId)));
    await tx.delete(investments).where(and(eq(investments.id, investmentId), eq(investments.projectId, inv.projectId)));
  });
  invalidateRelatedCache('transactions');
  return { success: true, data: undefined };
}

export type LinkCandidate = { id: string; date: string; description: string; amount: number; type: 'income' | 'expense'; account: string | null };

/** Movimientos del proyecto que aún no están en una inversión (para asociarlos) */
export async function searchLinkCandidates(
  userId: string,
  projectId: string,
  query: string
): Promise<ActionResult<LinkCandidate[]>> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  if (!(await verifyProjectAccess(projectId, userId))) return { success: false, error: NO_PROJECT_ACCESS };
  const q = query.trim();
  const rows = (await db.execute(sql`
    select t.id, t.date::text as date, t.description, t.base_amount as amount, t.type::text as type, a.name as account
    from n1n4_transactions t
    left join n1n4_accounts a on a.id = t.account_id
    where t.project_id = ${projectId}
      and t.investment_id is null
      and t.linked_transaction_id is null
      and t.card_purchase_id is null
      ${q ? sql`and t.description ilike ${`%${q}%`}` : sql``}
    order by t.date desc
    limit 40`)) as unknown as Record<string, string>[];
  return {
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      date: String(r.date).slice(0, 10),
      description: r.description,
      amount: Number(r.amount),
      type: r.type === 'income' ? 'income' : 'expense',
      account: r.account,
    })),
  };
}

/**
 * Asocia movimientos a una inversión con su rol. Los ingresos siempre son
 * retorno; los gastos, aporte o costo.
 */
export async function linkMovements(
  userId: string,
  investmentId: string,
  links: { transactionId: string; role: InvestmentRole }[]
): Promise<ActionResult<{ linked: number }>> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  const inv = await investmentForWrite(investmentId, userId);
  if (!inv) return { success: false, error: 'Inversión no encontrada' };
  const parsed = linksSchema.safeParse(links);
  if (!parsed.success) return { success: false, error: 'Datos inválidos' };
  const ids = parsed.data.map((l) => l.transactionId);
  if (!ids.length) return { success: true, data: { linked: 0 } };
  const rows = await db
    .select({ id: transactions.id, type: transactions.type })
    .from(transactions)
    .where(and(inArray(transactions.id, ids), eq(transactions.projectId, inv.projectId)));
  const types = new Map(rows.map((r) => [r.id, r.type]));

  // Agrupar por rol final: a lo más 3 UPDATE en vez de uno por movimiento
  const idsByRole = new Map<InvestmentRole, Set<string>>();
  for (const l of parsed.data) {
    const type = types.get(l.transactionId);
    if (!type) continue;
    const role: InvestmentRole = type === 'income' ? 'retorno' : l.role === 'costo' ? 'costo' : 'aporte';
    const group = idsByRole.get(role) ?? new Set<string>();
    group.add(l.transactionId);
    idsByRole.set(role, group);
  }
  const linked = [...idsByRole.values()].reduce((acc, group) => acc + group.size, 0);
  if (linked > 0) {
    const now = new Date();
    await db.transaction(async (tx) => {
      for (const [role, group] of idsByRole) {
        await tx
          .update(transactions)
          .set({ investmentId, investmentRole: role, updatedAt: now })
          .where(and(inArray(transactions.id, [...group]), eq(transactions.projectId, inv.projectId)));
      }
    });
  }
  invalidateRelatedCache('transactions');
  return { success: true, data: { linked } };
}

export async function unlinkMovement(userId: string, transactionId: string): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  const [tx] = await db.select({ projectId: transactions.projectId }).from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (!tx || !(await verifyProjectWriteAccess(tx.projectId, userId))) return { success: false, error: 'Movimiento no encontrado' };
  await db
    .update(transactions)
    .set({ investmentId: null, investmentRole: null, updatedAt: new Date() })
    .where(and(eq(transactions.id, transactionId), eq(transactions.projectId, tx.projectId)));
  invalidateRelatedCache('transactions');
  return { success: true, data: undefined };
}
