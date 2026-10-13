import { db } from '@/lib/db';
import { transactions, projects, projectMembers, accounts } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import type { RELATED_TAGS } from '@/lib/cache';
import { createTransactionSchema, type CreateTransactionInput } from '../schemas';
import type { ActionResult } from '../types';
import { updateAccountBalance } from '@/features/accounts/lib/balance';
import { verifyProjectAccess } from './access';
import { normalizeNature } from '../nature';
import { validateFundPayment } from './fund-validation';

/**
 * Crear y borrar transacciones sin pasar por la sesión web. Lo usan las server
 * actions (después de validar la sesión) y el bot de Telegram (después de validar
 * el chat vinculado). No es una server action: no debe quedar expuesta como endpoint.
 */

/** Invalida el caché de una feature: updateTag en server actions, revalidateTag en route handlers */
export type Invalidate = (feature: keyof typeof RELATED_TAGS) => void;

export async function insertTransaction(
  userId: string,
  input: CreateTransactionInput,
  invalidateRelatedCache: Invalidate
): Promise<ActionResult<{ id: string }>> {
  const parsed = createTransactionSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar acceso al proyecto
  const hasAccess = await verifyProjectAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  // Obtener la moneda base del proyecto y el tipo/saldo de cuenta
  const [project, account] = await Promise.all([
    db
      .select({ currency: projects.currency })
      .from(projects)
      .where(eq(projects.id, parsed.data.projectId))
      .limit(1),
    db
      .select({ type: accounts.type, currentBalance: accounts.currentBalance })
      .from(accounts)
      .where(eq(accounts.id, parsed.data.accountId))
      .limit(1),
  ]);

  if (!project[0]) {
    return { success: false, error: 'Proyecto no encontrado' };
  }

  if (!account[0]) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  const amount = typeof parsed.data.originalAmount === 'string'
    ? parsed.data.originalAmount
    : String(parsed.data.originalAmount);

  const isPaid = parsed.data.isPaid ?? false;

  // Pago con un fondo de la cuenta (solo gastos)
  const accountFundId = parsed.data.type === 'expense' ? (parsed.data.accountFundId ?? null) : null;
  if (accountFundId) {
    const fundError = await validateFundPayment({
      projectId: parsed.data.projectId,
      accountId: parsed.data.accountId,
      fundId: accountFundId,
      amount: parsed.data.originalAmount,
    });
    if (fundError) return { success: false, error: fundError };
  }

  const [newTransaction] = await db
    .insert(transactions)
    .values({
      userId,
      projectId: parsed.data.projectId,
      categoryId: parsed.data.categoryId || null,
      accountId: parsed.data.accountId,
      entityId: parsed.data.entityId ?? null,
      budgetId: parsed.data.budgetId ?? null,
      savingsGoalId: parsed.data.savingsGoalId ?? null,
      type: parsed.data.type,
      nature: normalizeNature(parsed.data.nature, parsed.data.type),
      accountFundId,
      description: parsed.data.description,
      notes: parsed.data.notes,
      date: parsed.data.date,
      isPaid,
      originalAmount: amount,
      originalCurrency: project[0].currency,
      baseAmount: amount,
      baseCurrency: project[0].currency,
      exchangeRate: '1',
    })
    .returning({ id: transactions.id });

  // Modo previsional: crear ajuste de rentabilidad automático
  const isProvisionAccount = account[0].type === 'pension' || account[0].type === 'unemployment' || account[0].type === 'savings';
  const providerBalance = parsed.data.providerBalance;

  if (isProvisionAccount && providerBalance != null && isPaid) {
    const currentBalance = parseFloat(account[0].currentBalance);
    const amountNum = parseFloat(amount);
    const balanceAfterContribution = currentBalance + (parsed.data.type === 'income' ? amountNum : -amountNum);
    const adjustmentAmount = providerBalance - balanceAfterContribution;

    // Crear transacción de ajuste si hay diferencia significativa
    if (Math.abs(adjustmentAmount) >= 1 && parsed.data.profitabilityCategoryId) {
      const isGain = adjustmentAmount > 0;
      const typeLabel = account[0].type === 'pension' ? 'AFP' : account[0].type === 'unemployment' ? 'Cesantía' : 'Ahorro';
      await db
        .insert(transactions)
        .values({
          userId,
          projectId: parsed.data.projectId,
          accountId: parsed.data.accountId,
          categoryId: parsed.data.profitabilityCategoryId,
          savingsGoalId: null, // Rentabilidad nunca se vincula a metas de ahorro
          type: isGain ? 'income' : 'expense',
          originalAmount: String(Math.abs(adjustmentAmount)),
          originalCurrency: project[0].currency,
          baseAmount: String(Math.abs(adjustmentAmount)),
          baseCurrency: project[0].currency,
          exchangeRate: '1',
          date: parsed.data.date,
          description: `Rentabilidad ${typeLabel}`,
          isPaid: true,
          paidAt: parsed.data.date,
        });
    }

    // Actualizar saldo directo al saldo del proveedor
    await db
      .update(accounts)
      .set({
        currentBalance: String(providerBalance),
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, parsed.data.accountId));

    invalidateRelatedCache('accounts');
  } else if (isPaid) {
    // Flujo normal: solo actualizar balance si la transacción está pagada
    const amountNum = parseFloat(amount);
    const balanceDelta = parsed.data.type === 'income' ? amountNum : -amountNum;
    await updateAccountBalance(parsed.data.accountId, balanceDelta);
  }

  invalidateRelatedCache('transactions');
  if (parsed.data.savingsGoalId) {
    invalidateRelatedCache('savings');
  }

  return { success: true, data: { id: newTransaction.id } };
}

export async function removeTransaction(
  transactionId: string,
  userId: string,
  invalidateRelatedCache: Invalidate
): Promise<ActionResult> {
  // Verificar acceso y obtener datos para revertir el balance
  const existing = await db
    .select({
      projectId: transactions.projectId,
      accountId: transactions.accountId,
      type: transactions.type,
      originalAmount: transactions.originalAmount,
      isPaid: transactions.isPaid,
      linkedTransactionId: transactions.linkedTransactionId,
    })
    .from(transactions)
    .innerJoin(projectMembers, eq(transactions.projectId, projectMembers.projectId))
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Transacción no encontrada' };
  }

  const transaction = existing[0];

  // Si tiene transacción vinculada, obtenerla y eliminarla también
  let linkedTransaction: { accountId: string | null; type: string; originalAmount: string; isPaid: boolean } | null = null;
  if (transaction.linkedTransactionId) {
    const linked = await db
      .select({
        accountId: transactions.accountId,
        type: transactions.type,
        originalAmount: transactions.originalAmount,
        isPaid: transactions.isPaid,
      })
      .from(transactions)
      .where(eq(transactions.id, transaction.linkedTransactionId))
      .limit(1);
    linkedTransaction = linked[0] ?? null;

    // Eliminar la transacción vinculada
    if (linkedTransaction) {
      await db.delete(transactions).where(eq(transactions.id, transaction.linkedTransactionId));
    }
  }

  // Eliminar la transacción principal
  await db.delete(transactions).where(eq(transactions.id, transactionId));

  // Revertir balance de la transacción principal
  if (transaction.isPaid && transaction.accountId) {
    const amount = parseFloat(transaction.originalAmount);
    const reverseDelta = transaction.type === 'income' ? -amount : amount;
    await updateAccountBalance(transaction.accountId, reverseDelta);
  }

  // Revertir balance de la transacción vinculada
  if (linkedTransaction?.isPaid && linkedTransaction.accountId) {
    const linkedAmount = parseFloat(linkedTransaction.originalAmount);
    const linkedReverseDelta = linkedTransaction.type === 'income' ? -linkedAmount : linkedAmount;
    await updateAccountBalance(linkedTransaction.accountId, linkedReverseDelta);
  }

  invalidateRelatedCache('transactions');
  invalidateRelatedCache('savings');

  return { success: true, data: undefined };
}
