import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts, categories, projects, settlements, transactions } from '@/lib/db/schema';
import { getToday } from '@/lib/formatting';

/**
 * Compensaciones de gastos que no son propios (tabla n1n4_settlements).
 * Ver docs/PLAN_SALDOS_CICLOS_Y_TECHO_TC.md §5.
 */

export type PendingExpense = {
  id: string;
  date: string;
  description: string;
  nature: 'external' | 'reimbursable' | 'fund';
  amount: number;
  remaining: number;
  /** La plata ya salió (débito, o TC ya pagada): se puede liquidar desde el fondo */
  cashOut: boolean;
};

export type AvailableAbono = {
  id: string;
  date: string;
  description: string;
  amount: number;
  remaining: number;
};

const num = (v: unknown) => Math.round(Number(v ?? 0));
const isoDate = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

export async function getPendingExpenses(projectId: string): Promise<PendingExpense[]> {
  const today = isoDate(getToday());
  const result = (await db.execute(sql`
    select * from (
      select
        t.id, t.date, t.description, t.nature::text as nature, t.base_amount as amount,
        (a.type <> 'credit_card' or t.paid_by_transfer_id is not null) as cash_out,
        t.base_amount - coalesce((select sum(s.amount) from n1n4_settlements s where s.expense_id = t.id), 0) as remaining
      from n1n4_transactions t
      join n1n4_accounts a on a.id = t.account_id
      where t.project_id = ${projectId} and t.type = 'expense' and t.is_paid
        and t.nature in ('external', 'reimbursable', 'fund')
        and t.date <= ${today}::date
    ) p
    where remaining > 0.5
    order by date desc`)) as unknown as Record<string, unknown>[];

  return result.map((r) => ({
    id: String(r.id),
    date: isoDate(r.date),
    description: String(r.description).trim(),
    nature: r.nature as PendingExpense['nature'],
    amount: num(r.amount),
    remaining: num(r.remaining),
    cashOut: Boolean(r.cash_out),
  }));
}

/** Abonos (ingresos 'reimbursement') que todavía tienen saldo sin asignar */
export async function getAvailableAbonos(projectId: string): Promise<AvailableAbono[]> {
  const result = (await db.execute(sql`
    select * from (
      select
        t.id, t.date, t.description, t.base_amount as amount,
        t.base_amount - coalesce((select sum(s.amount) from n1n4_settlements s where s.settling_transaction_id = t.id), 0) as remaining
      from n1n4_transactions t
      where t.project_id = ${projectId} and t.type = 'income' and t.nature = 'reimbursement'
    ) p
    where remaining > 0.5
    order by date desc
    limit 50`)) as unknown as Record<string, unknown>[];

  return result.map((r) => ({
    id: String(r.id),
    date: isoDate(r.date),
    description: String(r.description).trim(),
    amount: num(r.amount),
    remaining: num(r.remaining),
  }));
}

/**
 * Registra una compensación. Valida en el servidor que no se compense más que
 * lo pendiente del gasto ni más que lo disponible del abono.
 */
export async function createSettlement(input: {
  projectId: string;
  expenseId: string;
  settlingTransactionId: string | null;
  amount?: number;
}): Promise<{ success: true } | { success: false; error: string }> {
  const expenses = await getPendingExpenses(input.projectId);
  const expense = expenses.find((e) => e.id === input.expenseId);
  if (!expense) return { success: false, error: 'El gasto no tiene saldo pendiente' };

  let amount = input.amount ?? expense.remaining;

  if (input.settlingTransactionId) {
    if (expense.nature === 'fund') {
      return { success: false, error: 'Los gastos del fondo se compensan liquidando el fondo' };
    }
    const abonos = await getAvailableAbonos(input.projectId);
    const abono = abonos.find((a) => a.id === input.settlingTransactionId);
    if (!abono) return { success: false, error: 'El abono no tiene saldo disponible' };
    amount = Math.min(amount, abono.remaining);
  }

  amount = Math.min(amount, expense.remaining);
  if (amount <= 0) return { success: false, error: 'Monto inválido' };

  await db.insert(settlements).values({
    expenseId: input.expenseId,
    settlingTransactionId: input.settlingTransactionId,
    amount: String(amount),
    kind: input.settlingTransactionId ? 'transaction' : 'waived',
  });

  return { success: true };
}

/**
 * Liquida el fondo: retira desde la cuenta del fondo a la cuenta líquida por
 * defecto el total de los gastos del fondo cuya plata ya salió, y los marca
 * como compensados. Todo en una transacción de BD.
 */
export async function liquidateFund(
  projectId: string,
  userId: string
): Promise<{ success: true; data: { amount: number; count: number } } | { success: false; error: string }> {
  const [project] = await db
    .select({ contingencyAccountId: projects.contingencyAccountId, currency: projects.currency })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project?.contingencyAccountId) {
    return { success: false, error: 'Configura la cuenta del fondo en el plan del ciclo' };
  }

  const eligible = (await getPendingExpenses(projectId)).filter((e) => e.nature === 'fund' && e.cashOut);
  const amount = eligible.reduce((acc, e) => acc + e.remaining, 0);
  if (amount <= 0) return { success: false, error: 'No hay gastos del fondo por liquidar' };

  const projectAccounts = await db
    .select({ id: accounts.id, name: accounts.name, type: accounts.type, isDefault: accounts.isDefault, entityId: accounts.entityId, isArchived: accounts.isArchived })
    .from(accounts)
    .where(eq(accounts.projectId, projectId));
  const fund = projectAccounts.find((a) => a.id === project.contingencyAccountId);
  const liquid = projectAccounts.filter((a) => (a.type === 'checking' || a.type === 'cash') && !a.isArchived);
  const target = liquid.find((a) => a.isDefault) ?? liquid[0];
  if (!fund || !target) return { success: false, error: 'No se encontró la cuenta del fondo o la cuenta de destino' };

  const [transferCategory] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.projectId, projectId), eq(categories.name, 'Transferencias')))
    .limit(1);

  const today = getToday();
  const value = String(amount);
  const description = 'Liquidación fondo de imprevistos';

  await db.transaction(async (tx) => {
    const common = {
      userId,
      projectId,
      categoryId: transferCategory?.id ?? null,
      date: today,
      isPaid: true,
      originalAmount: value,
      originalCurrency: project.currency,
      baseAmount: value,
      baseCurrency: project.currency,
      exchangeRate: '1',
    };
    const [out] = await tx
      .insert(transactions)
      .values({ ...common, accountId: fund.id, entityId: fund.entityId, type: 'expense', description: `${description} → ${target.name}` })
      .returning({ id: transactions.id });
    const [incoming] = await tx
      .insert(transactions)
      .values({ ...common, accountId: target.id, entityId: target.entityId, type: 'income', description: `${description} ← ${fund.name}`, linkedTransactionId: out.id })
      .returning({ id: transactions.id });
    await tx.update(transactions).set({ linkedTransactionId: incoming.id }).where(eq(transactions.id, out.id));

    await tx.insert(settlements).values(
      eligible.map((e) => ({
        expenseId: e.id,
        settlingTransactionId: incoming.id,
        amount: String(e.remaining),
        kind: 'transaction' as const,
      }))
    );

    // Saldos de las cuentas (ninguna es TC)
    await tx
      .update(accounts)
      .set({ currentBalance: sql`${accounts.currentBalance} - ${value}::numeric`, updatedAt: new Date() })
      .where(eq(accounts.id, fund.id));
    await tx
      .update(accounts)
      .set({ currentBalance: sql`${accounts.currentBalance} + ${value}::numeric`, updatedAt: new Date() })
      .where(eq(accounts.id, target.id));
  });

  return { success: true, data: { amount, count: eligible.length } };
}
