'use server';

import { db } from '@/lib/db';
import { accounts, transactions } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createAccountSchema, updateAccountSchema } from './schemas';
import type { CreateAccountInput, UpdateAccountInput } from './schemas';

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

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

  // If this is set as default, unset any existing default
  if (parsed.data.isDefault) {
    await db
      .update(accounts)
      .set({ isDefault: false })
      .where(and(eq(accounts.userId, userId), eq(accounts.isDefault, true)));
  }

  const [newAccount] = await db
    .insert(accounts)
    .values({
      userId,
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

  revalidatePath('/dashboard');

  return { success: true, data: { id: newAccount.id } };
}

/**
 * Update an existing account
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

  // Verify ownership
  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  // If setting as default, unset any existing default
  if (parsed.data.isDefault) {
    await db
      .update(accounts)
      .set({ isDefault: false })
      .where(and(eq(accounts.userId, userId), eq(accounts.isDefault, true)));
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

  revalidatePath('/dashboard');

  return { success: true, data: undefined };
}

/**
 * Archive an account (soft delete)
 */
export async function archiveAccount(
  accountId: string,
  userId: string
): Promise<ActionResult> {
  // Verify ownership
  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  await db
    .update(accounts)
    .set({ isArchived: true, isDefault: false, updatedAt: new Date() })
    .where(eq(accounts.id, accountId));

  revalidatePath('/dashboard');

  return { success: true, data: undefined };
}

/**
 * Restore an archived account
 */
export async function restoreAccount(
  accountId: string,
  userId: string
): Promise<ActionResult> {
  // Verify ownership
  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  await db
    .update(accounts)
    .set({ isArchived: false, updatedAt: new Date() })
    .where(eq(accounts.id, accountId));

  revalidatePath('/dashboard');

  return { success: true, data: undefined };
}

/**
 * Delete an account permanently
 * Note: This should only be allowed if no transactions reference it
 */
export async function deleteAccount(
  accountId: string,
  userId: string
): Promise<ActionResult> {
  // Verify ownership
  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  // TODO: Check if any transactions reference this account
  // For now, we'll just delete it

  await db.delete(accounts).where(eq(accounts.id, accountId));

  revalidatePath('/dashboard');

  return { success: true, data: undefined };
}

/**
 * Adjust account balance manually
 * This is useful for reconciliation
 */
export async function adjustAccountBalance(
  accountId: string,
  userId: string,
  newBalance: number
): Promise<ActionResult> {
  // Verify ownership
  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  await db
    .update(accounts)
    .set({ currentBalance: String(newBalance), updatedAt: new Date() })
    .where(eq(accounts.id, accountId));

  revalidatePath('/dashboard');

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
}

/**
 * Recalcula el balance de una cuenta basándose en:
 * - Saldo inicial
 * - Transacciones PAGADAS (isPaid = true)
 * - Transferencias completadas
 */
export async function recalculateAccountBalance(
  accountId: string,
  userId: string
): Promise<ActionResult<{ newBalance: number }>> {
  // Verificar propiedad y obtener tipo de cuenta
  const account = await db
    .select({
      id: accounts.id,
      initialBalance: accounts.initialBalance,
      type: accounts.type,
    })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
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

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/accounts');

  return { success: true, data: { newBalance } };
}

/**
 * Recalcula el balance de TODAS las cuentas del usuario
 */
export async function recalculateAllAccountBalances(
  userId: string
): Promise<ActionResult<{ updated: number }>> {
  const userAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  let updated = 0;
  for (const account of userAccounts) {
    const result = await recalculateAccountBalance(account.id, userId);
    if (result.success) {
      updated++;
    }
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/accounts');

  return { success: true, data: { updated } };
}
