'use server';

import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { accounts, transactions, projectMembers, categories } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import { adjustBalanceSchema, createAccountSchema, updateAccountSchema } from './schemas';
import type { CreateAccountInput, UpdateAccountInput } from './schemas';
import type { ActionResult } from '@/types/action-result';
import {
  memberCondition,
  NO_PROJECT_ACCESS,
  verifyProjectWriteAccess,
} from '@/lib/auth/project-access';

/**
 * Create a new account
 */
export async function createAccount(
  userId: string,
  input: CreateAccountInput
): Promise<ActionResult<{ id: string }>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = createAccountSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar membresía al proyecto
  const hasAccess = await verifyProjectWriteAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: NO_PROJECT_ACCESS };
  }

  // If this is set as default, unset any existing default in the project
  if (parsed.data.isDefault) {
    await db
      .update(accounts)
      .set({ isDefault: false })
      .where(
        and(
          eq(accounts.projectId, parsed.data.projectId),
          eq(accounts.isDefault, true)
        )
      );
  }

  const [newAccount] = await db
    .insert(accounts)
    .values({
      userId,
      projectId: parsed.data.projectId,
      name: parsed.data.name,
      type: parsed.data.type,
      bankName: parsed.data.bankName,
      entityId: parsed.data.entityId,
      currency: parsed.data.currency,
      initialBalance: String(parsed.data.initialBalance),
      currentBalance: String(parsed.data.initialBalance), // Start with initial balance
      creditLimit: parsed.data.creditLimit != null ? String(parsed.data.creditLimit) : null,
      cardDesign: parsed.data.cardDesign ?? null,
      isDefault: parsed.data.isDefault,
    })
    .returning({ id: accounts.id });

  // Auto-crear categorías para cuentas previsionales y de ahorro
  if (parsed.data.type === 'pension' || parsed.data.type === 'unemployment' || parsed.data.type === 'savings') {
    const colorMap: Record<string, string> = { pension: '#8b5cf6', unemployment: '#06b6d4', savings: '#10b981' };
    const color = colorMap[parsed.data.type] ?? '#8b5cf6';
    await db.insert(categories).values([
      { projectId: parsed.data.projectId, name: `Aporte ${parsed.data.name}`, color },
      { projectId: parsed.data.projectId, name: `Rentabilidad ${parsed.data.name}`, color },
    ]);
    invalidateRelatedCache('categories');
  }

  invalidateRelatedCache('accounts');

  return { success: true, data: { id: newAccount.id } };
}

/**
 * Cuenta con acceso de escritura del usuario a su proyecto (null si no existe o no tiene acceso)
 */
async function findAccountForWrite(
  accountId: string,
  userId: string
): Promise<{ id: string; projectId: string; type: string } | null> {
  const [account] = await db
    .select({ id: accounts.id, projectId: accounts.projectId, type: accounts.type })
    .from(accounts)
    .innerJoin(projectMembers, eq(accounts.projectId, projectMembers.projectId))
    .where(and(eq(accounts.id, accountId), memberCondition(userId, { write: true })))
    .limit(1);
  return account ?? null;
}

/**
 * Update an existing account
 * Verifica membresía del usuario al proyecto
 */
export async function updateAccount(
  accountId: string,
  userId: string,
  input: UpdateAccountInput
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = updateAccountSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar que la cuenta existe y el usuario tiene acceso al proyecto
  const existing = await findAccountForWrite(accountId, userId);

  if (!existing) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  // If setting as default, unset any existing default in the project
  if (parsed.data.isDefault) {
    await db
      .update(accounts)
      .set({ isDefault: false })
      .where(
        and(
          eq(accounts.projectId, existing.projectId),
          eq(accounts.isDefault, true)
        )
      );
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
  if (parsed.data.bankName !== undefined) updateData.bankName = parsed.data.bankName;
  if (parsed.data.entityId !== undefined) updateData.entityId = parsed.data.entityId;
  if (parsed.data.currency !== undefined) updateData.currency = parsed.data.currency;
  if (parsed.data.isDefault !== undefined) updateData.isDefault = parsed.data.isDefault;
  if (parsed.data.cardDesign !== undefined) updateData.cardDesign = parsed.data.cardDesign;
  if (parsed.data.initialBalance !== undefined) {
    updateData.initialBalance = String(parsed.data.initialBalance);
  }
  if (parsed.data.creditLimit !== undefined) {
    updateData.creditLimit = parsed.data.creditLimit != null ? String(parsed.data.creditLimit) : null;
  }

  await db
    .update(accounts)
    .set(updateData)
    .where(and(eq(accounts.id, accountId), eq(accounts.projectId, existing.projectId)));

  invalidateRelatedCache('accounts');

  return { success: true, data: undefined };
}

/**
 * Archive an account (soft delete)
 * Verifica membresía del usuario al proyecto
 */
export async function archiveAccount(
  accountId: string,
  userId: string
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  // Verificar acceso mediante membresía al proyecto
  const existing = await findAccountForWrite(accountId, userId);

  if (!existing) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  await db
    .update(accounts)
    .set({ isArchived: true, isDefault: false, updatedAt: new Date() })
    .where(and(eq(accounts.id, accountId), eq(accounts.projectId, existing.projectId)));

  invalidateRelatedCache('accounts');

  return { success: true, data: undefined };
}

/**
 * Restore an archived account
 * Verifica membresía del usuario al proyecto
 */
export async function restoreAccount(
  accountId: string,
  userId: string
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  // Verificar acceso mediante membresía al proyecto
  const existing = await findAccountForWrite(accountId, userId);

  if (!existing) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  await db
    .update(accounts)
    .set({ isArchived: false, updatedAt: new Date() })
    .where(and(eq(accounts.id, accountId), eq(accounts.projectId, existing.projectId)));

  invalidateRelatedCache('accounts');

  return { success: true, data: undefined };
}

/**
 * Delete an account permanently
 * Solo si ninguna transacción la referencia: con movimientos se archiva
 * Verifica membresía del usuario al proyecto
 */
export async function deleteAccount(
  accountId: string,
  userId: string
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  // Verificar acceso mediante membresía al proyecto
  const existing = await findAccountForWrite(accountId, userId);

  if (!existing) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  // Con movimientos no se borra: se perdería el historial (la UI ofrece "Archivar")
  const [movement] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.accountId, accountId))
    .limit(1);

  if (movement) {
    return { success: false, error: 'La cuenta tiene movimientos; archívala en vez de borrarla (opción "Archivar")' };
  }

  await db
    .delete(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.projectId, existing.projectId)));

  invalidateRelatedCache('accounts');

  return { success: true, data: undefined };
}

/**
 * Adjust account balance manually
 * Recalcula initialBalance para que sea consistente con las transacciones existentes.
 * Así, futuros recálculos o deltas sobre el balance darán resultados correctos.
 * Verifica membresía del usuario al proyecto
 */
export async function adjustAccountBalance(
  accountId: string,
  userId: string,
  newBalance: number
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = adjustBalanceSchema.safeParse({ newBalance });
  if (!parsed.success) {
    return { success: false, error: 'Saldo inválido' };
  }

  // Verificar acceso y obtener tipo de cuenta
  const existing = await findAccountForWrite(accountId, userId);

  if (!existing) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  // Sumar transacciones pagadas para derivar el initialBalance correcto
  const [totals] = await db
    .select({
      totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' AND ${transactions.isPaid} = true THEN ${transactions.baseAmount}::numeric ELSE 0 END), 0)`,
      totalExpense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' AND ${transactions.isPaid} = true THEN ${transactions.baseAmount}::numeric ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.accountId, accountId), eq(transactions.projectId, existing.projectId)));

  const totalIncome = parseFloat(totals?.totalIncome ?? '0');
  const totalExpense = parseFloat(totals?.totalExpense ?? '0');
  const balance = parsed.data.newBalance;

  // Derivar initialBalance para que: recalculate(initialBalance + txns) = newBalance
  // Normal: newBalance = initial + income - expense → initial = newBalance - income + expense
  // TC:     newBalance = initial - income + expense → initial = newBalance + income - expense
  const isCreditCard = existing.type === 'credit_card';
  const newInitialBalance = isCreditCard
    ? balance + totalIncome - totalExpense
    : balance - totalIncome + totalExpense;

  await db
    .update(accounts)
    .set({
      initialBalance: String(newInitialBalance),
      currentBalance: String(balance),
      updatedAt: new Date(),
    })
    .where(and(eq(accounts.id, accountId), eq(accounts.projectId, existing.projectId)));

  invalidateRelatedCache('accounts');

  return { success: true, data: undefined };
}

/**
 * Recalcula el balance de TODAS las cuentas del proyecto en una sola sentencia:
 * - Saldo inicial
 * - Transacciones PAGADAS (isPaid = true): income suma, expense resta
 *   (incluye las transferencias entrantes y salientes)
 * - Tarjetas de crédito: invertido (la deuda aumenta con gastos)
 * Verifica membresía del usuario al proyecto
 */
export async function recalculateAllAccountBalances(
  projectId: string,
  userId: string
): Promise<ActionResult<{ updated: number }>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  // Verificar membresía con permiso de escritura
  const hasAccess = await verifyProjectWriteAccess(projectId, userId);
  if (!hasAccess) {
    return { success: false, error: NO_PROJECT_ACCESS };
  }

  const updatedRows = (await db.execute(sql`
    update n1n4_accounts a
    set current_balance = s.new_balance, updated_at = now()
    from (
      select
        acc.id,
        case when acc.type = 'credit_card'
          then acc.initial_balance - coalesce(t.income, 0) + coalesce(t.expense, 0)
          else acc.initial_balance + coalesce(t.income, 0) - coalesce(t.expense, 0)
        end as new_balance
      from n1n4_accounts acc
      left join (
        select
          account_id,
          sum(case when type = 'income' then base_amount::numeric else 0 end) as income,
          sum(case when type = 'expense' then base_amount::numeric else 0 end) as expense
        from n1n4_transactions
        where project_id = ${projectId} and is_paid = true and account_id is not null
        group by account_id
      ) t on t.account_id = acc.id
      where acc.project_id = ${projectId}
    ) s
    where a.id = s.id and a.project_id = ${projectId}
    returning a.id
  `)) as unknown as { id: string }[];

  invalidateRelatedCache('accounts');

  return { success: true, data: { updated: updatedRows.length } };
}
