'use server';

import { db } from '@/lib/db';
import { accounts, transactions, projectMembers } from '@/lib/db/schema';
import { eq, and, sql, isNotNull } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import { createAccountSchema, updateAccountSchema } from './schemas';
import type { CreateAccountInput, UpdateAccountInput } from './schemas';

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Verifica que el usuario tenga membresía aceptada en el proyecto
 */
async function verifyProjectMembership(
  projectId: string,
  userId: string
): Promise<boolean> {
  const membership = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  return membership.length > 0;
}

/**
 * Create a new account
 */
export async function createAccount(
  userId: string,
  input: CreateAccountInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = createAccountSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar membresía al proyecto
  const hasAccess = await verifyProjectMembership(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
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
      isDefault: parsed.data.isDefault,
    })
    .returning({ id: accounts.id });

  invalidateRelatedCache('accounts');

  return { success: true, data: { id: newAccount.id } };
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
  const parsed = updateAccountSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar que la cuenta existe y el usuario tiene acceso al proyecto
  const existing = await db
    .select({ id: accounts.id, projectId: accounts.projectId })
    .from(accounts)
    .innerJoin(
      projectMembers,
      eq(accounts.projectId, projectMembers.projectId)
    )
    .where(
      and(
        eq(accounts.id, accountId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  // If setting as default, unset any existing default in the project
  if (parsed.data.isDefault) {
    await db
      .update(accounts)
      .set({ isDefault: false })
      .where(
        and(
          eq(accounts.projectId, existing[0].projectId),
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
  if (parsed.data.initialBalance !== undefined) {
    updateData.initialBalance = String(parsed.data.initialBalance);
  }
  if (parsed.data.creditLimit !== undefined) {
    updateData.creditLimit = parsed.data.creditLimit != null ? String(parsed.data.creditLimit) : null;
  }

  await db.update(accounts).set(updateData).where(eq(accounts.id, accountId));

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
  // Verificar acceso mediante membresía al proyecto
  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .innerJoin(
      projectMembers,
      eq(accounts.projectId, projectMembers.projectId)
    )
    .where(
      and(
        eq(accounts.id, accountId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  await db
    .update(accounts)
    .set({ isArchived: true, isDefault: false, updatedAt: new Date() })
    .where(eq(accounts.id, accountId));

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
  // Verificar acceso mediante membresía al proyecto
  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .innerJoin(
      projectMembers,
      eq(accounts.projectId, projectMembers.projectId)
    )
    .where(
      and(
        eq(accounts.id, accountId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  await db
    .update(accounts)
    .set({ isArchived: false, updatedAt: new Date() })
    .where(eq(accounts.id, accountId));

  invalidateRelatedCache('accounts');

  return { success: true, data: undefined };
}

/**
 * Delete an account permanently
 * Note: This should only be allowed if no transactions reference it
 * Verifica membresía del usuario al proyecto
 */
export async function deleteAccount(
  accountId: string,
  userId: string
): Promise<ActionResult> {
  // Verificar acceso mediante membresía al proyecto
  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .innerJoin(
      projectMembers,
      eq(accounts.projectId, projectMembers.projectId)
    )
    .where(
      and(
        eq(accounts.id, accountId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  // TODO: Check if any transactions reference this account
  // For now, we'll just delete it

  await db.delete(accounts).where(eq(accounts.id, accountId));

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
  // Verificar acceso y obtener tipo de cuenta
  const existing = await db
    .select({ id: accounts.id, type: accounts.type })
    .from(accounts)
    .innerJoin(
      projectMembers,
      eq(accounts.projectId, projectMembers.projectId)
    )
    .where(
      and(
        eq(accounts.id, accountId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  // Sumar transacciones pagadas para derivar el initialBalance correcto
  const [totals] = await db
    .select({
      totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' AND ${transactions.isPaid} = true THEN ${transactions.baseAmount}::numeric ELSE 0 END), 0)`,
      totalExpense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' AND ${transactions.isPaid} = true THEN ${transactions.baseAmount}::numeric ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.accountId, accountId));

  const totalIncome = parseFloat(totals?.totalIncome ?? '0');
  const totalExpense = parseFloat(totals?.totalExpense ?? '0');

  // Derivar initialBalance para que: recalculate(initialBalance + txns) = newBalance
  // Normal: newBalance = initial + income - expense → initial = newBalance - income + expense
  // TC:     newBalance = initial - income + expense → initial = newBalance + income - expense
  const isCreditCard = existing[0].type === 'credit_card';
  const newInitialBalance = isCreditCard
    ? newBalance + totalIncome - totalExpense
    : newBalance - totalIncome + totalExpense;

  await db
    .update(accounts)
    .set({
      initialBalance: String(newInitialBalance),
      currentBalance: String(newBalance),
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, accountId));

  invalidateRelatedCache('accounts');

  return { success: true, data: undefined };
}

/**
 * Update account balance (internal use for transactions)
 * Called when a transaction is created, updated, or deleted
 */
export async function updateAccountBalance(
  accountId: string,
  amountDelta: number // Positive for income, negative for expense
): Promise<void> {
  const account = await db
    .select({
      currentBalance: accounts.currentBalance,
      type: accounts.type,
    })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (!account[0]) return;

  const currentBalance = parseFloat(account[0].currentBalance);

  // Para tarjetas de crédito, invertir la lógica del delta:
  // - Un gasto (delta negativo) debe AUMENTAR la deuda (sumar al balance)
  // - Un pago/ingreso (delta positivo) debe DISMINUIR la deuda (restar del balance)
  const adjustedDelta = account[0].type === 'credit_card' ? -amountDelta : amountDelta;
  const newBalance = currentBalance + adjustedDelta;

  await db
    .update(accounts)
    .set({ currentBalance: String(newBalance), updatedAt: new Date() })
    .where(eq(accounts.id, accountId));

  // No invalidamos caché aquí porque esta función es interna
  // y se llama desde otras actions que ya invalidan
}

/**
 * Recalcula el balance de una cuenta basándose en:
 * - Saldo inicial
 * - Transacciones PAGADAS (isPaid = true)
 * - Transferencias completadas
 * Verifica membresía del usuario al proyecto
 */
export async function recalculateAccountBalance(
  accountId: string,
  userId: string
): Promise<ActionResult<{ newBalance: number }>> {
  // Verificar acceso y obtener tipo de cuenta
  const account = await db
    .select({
      id: accounts.id,
      initialBalance: accounts.initialBalance,
      type: accounts.type,
    })
    .from(accounts)
    .innerJoin(
      projectMembers,
      eq(accounts.projectId, projectMembers.projectId)
    )
    .where(
      and(
        eq(accounts.id, accountId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!account[0]) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  const initialBalance = parseFloat(account[0].initialBalance);
  const isCreditCard = account[0].type === 'credit_card';

  // Sumar todas las transacciones PAGADAS
  // - income: suma al balance (incluye transferencias entrantes)
  // - expense: resta del balance (incluye transferencias salientes)
  const [transactionTotals] = await db
    .select({
      totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' AND ${transactions.isPaid} = true THEN ${transactions.baseAmount}::numeric ELSE 0 END), 0)`,
      totalExpense: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' AND ${transactions.isPaid} = true THEN ${transactions.baseAmount}::numeric ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.accountId, accountId));

  const totalIncome = parseFloat(transactionTotals?.totalIncome ?? '0');
  const totalExpense = parseFloat(transactionTotals?.totalExpense ?? '0');

  // Calcular nuevo balance:
  // - Cuentas normales: inicial + ingresos - gastos
  // - Tarjetas de crédito: inicial - ingresos + gastos (invertido porque la deuda aumenta con gastos)
  const newBalance = isCreditCard
    ? initialBalance - totalIncome + totalExpense
    : initialBalance + totalIncome - totalExpense;

  // Actualizar el balance
  await db
    .update(accounts)
    .set({ currentBalance: String(newBalance), updatedAt: new Date() })
    .where(eq(accounts.id, accountId));

  invalidateRelatedCache('accounts');

  return { success: true, data: { newBalance } };
}

/**
 * Recalcula el balance de TODAS las cuentas del proyecto
 * Verifica membresía del usuario al proyecto
 */
export async function recalculateAllAccountBalances(
  projectId: string,
  userId: string
): Promise<ActionResult<{ updated: number }>> {
  // Verificar membresía
  const hasAccess = await verifyProjectMembership(projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  const projectAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.projectId, projectId));

  let updated = 0;
  for (const account of projectAccounts) {
    const result = await recalculateAccountBalance(account.id, userId);
    if (result.success) {
      updated++;
    }
  }

  // invalidateRelatedCache ya se llama en cada recalculateAccountBalance

  return { success: true, data: { updated } };
}
