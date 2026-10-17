import { db } from '@/lib/db';
import { transactions, projects, projectMembers, accounts } from '@/lib/db/schema';
import { eq, and, inArray, or } from 'drizzle-orm';
import type { RELATED_TAGS } from '@/lib/cache';
import { createTransactionSchema, type CreateTransactionInput } from '../schemas';
import type { ActionResult } from '@/types/action-result';
import { updateAccountBalance, type DbExecutor } from '@/features/accounts/lib/balance';
import {
  memberCondition,
  NO_PROJECT_ACCESS,
  projectRefsError,
  verifyProjectWriteAccess,
} from '@/lib/auth/project-access';
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

  // Verificar acceso de escritura al proyecto
  const hasAccess = await verifyProjectWriteAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: NO_PROJECT_ACCESS };
  }

  // Moneda base del proyecto, tipo/saldo de la cuenta (del mismo proyecto) y
  // que categoría, presupuesto y meta también sean del proyecto
  const [project, account, refsError] = await Promise.all([
    db
      .select({ currency: projects.currency })
      .from(projects)
      .where(eq(projects.id, parsed.data.projectId))
      .limit(1),
    db
      .select({ type: accounts.type, currentBalance: accounts.currentBalance })
      .from(accounts)
      .where(and(eq(accounts.id, parsed.data.accountId), eq(accounts.projectId, parsed.data.projectId)))
      .limit(1),
    projectRefsError(parsed.data.projectId, {
      categoryIds: [parsed.data.categoryId, parsed.data.profitabilityCategoryId],
      budgetIds: [parsed.data.budgetId],
      savingsGoalIds: [parsed.data.savingsGoalId],
    }),
  ]);

  if (refsError) {
    return { success: false, error: refsError };
  }

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

  // Modo previsional: el saldo queda en el del proveedor y la diferencia es rentabilidad
  const isProvisionAccount = account[0].type === 'pension' || account[0].type === 'unemployment' || account[0].type === 'savings';
  const providerBalance = parsed.data.providerBalance;
  const syncsProviderBalance = isProvisionAccount && providerBalance != null && isPaid;

  // La transacción, el ajuste de rentabilidad y el saldo se guardan juntos
  const newTransactionId = await db.transaction(async (tx) => {
    const [newTransaction] = await tx
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

    if (syncsProviderBalance) {
      const currentBalance = parseFloat(account[0].currentBalance);
      const amountNum = parseFloat(amount);
      const balanceAfterContribution = currentBalance + (parsed.data.type === 'income' ? amountNum : -amountNum);
      const adjustmentAmount = providerBalance - balanceAfterContribution;

      // Crear transacción de ajuste si hay diferencia significativa
      if (Math.abs(adjustmentAmount) >= 1 && parsed.data.profitabilityCategoryId) {
        const isGain = adjustmentAmount > 0;
        const typeLabel = account[0].type === 'pension' ? 'AFP' : account[0].type === 'unemployment' ? 'Cesantía' : 'Ahorro';
        await tx
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
      await tx
        .update(accounts)
        .set({
          currentBalance: String(providerBalance),
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, parsed.data.accountId));
    } else if (isPaid) {
      // Flujo normal: solo actualizar balance si la transacción está pagada
      const amountNum = parseFloat(amount);
      const balanceDelta = parsed.data.type === 'income' ? amountNum : -amountNum;
      await updateAccountBalance(parsed.data.accountId, balanceDelta, tx);
    }

    return newTransaction.id;
  });

  if (syncsProviderBalance) {
    invalidateRelatedCache('accounts');
  }
  invalidateRelatedCache('transactions');
  if (parsed.data.savingsGoalId) {
    invalidateRelatedCache('savings');
  }

  return { success: true, data: { id: newTransactionId } };
}

export async function removeTransaction(
  transactionId: string,
  userId: string,
  invalidateRelatedCache: Invalidate
): Promise<ActionResult> {
  // Verificar acceso de escritura y obtener el proyecto de la transacción
  const existing = await db
    .select({ projectId: transactions.projectId })
    .from(transactions)
    .innerJoin(projectMembers, eq(transactions.projectId, projectMembers.projectId))
    .where(and(eq(transactions.id, transactionId), memberCondition(userId, { write: true })))
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Transacción no encontrada' };
  }

  // Borra la transacción y su vinculada (si es una transferencia) y revierte los saldos
  await db.transaction((tx) => deleteTransactionsWithLinked(tx, existing[0].projectId, [transactionId]));

  invalidateRelatedCache('transactions');
  invalidateRelatedCache('savings');

  return { success: true, data: undefined };
}

/**
 * Borra transacciones del proyecto junto con sus vinculadas (las dos patas de una
 * transferencia, en ambos sentidos) y revierte el saldo de las que estaban pagadas,
 * agrupando los deltas por cuenta. Pensado para correr dentro de `db.transaction`.
 * Las compensaciones (settlements) se borran en cascada por FK.
 * Devuelve cuántas de las transacciones pedidas existían en el proyecto.
 */
export async function deleteTransactionsWithLinked(
  executor: DbExecutor,
  projectId: string,
  transactionIds: string[]
): Promise<number> {
  const selected = await executor
    .select({ id: transactions.id, linkedTransactionId: transactions.linkedTransactionId })
    .from(transactions)
    .where(and(eq(transactions.projectId, projectId), inArray(transactions.id, transactionIds)));

  if (selected.length === 0) return 0;

  const selectedIds = selected.map((t) => t.id);
  const linkedIds = selected.map((t) => t.linkedTransactionId).filter((id): id is string => Boolean(id));

  const toDelete = await executor
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      type: transactions.type,
      originalAmount: transactions.originalAmount,
      isPaid: transactions.isPaid,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.projectId, projectId),
        or(
          inArray(transactions.id, [...selectedIds, ...linkedIds]),
          inArray(transactions.linkedTransactionId, selectedIds)
        )
      )
    );

  await executor
    .delete(transactions)
    .where(and(eq(transactions.projectId, projectId), inArray(transactions.id, toDelete.map((t) => t.id))));

  // Revertir saldos de las pagadas, una actualización por cuenta
  const deltasByAccount = new Map<string, number>();
  for (const t of toDelete) {
    if (!t.isPaid || !t.accountId) continue;
    const amount = parseFloat(t.originalAmount);
    const reverseDelta = t.type === 'income' ? -amount : amount;
    deltasByAccount.set(t.accountId, (deltasByAccount.get(t.accountId) ?? 0) + reverseDelta);
  }
  for (const [accountId, delta] of deltasByAccount) {
    await updateAccountBalance(accountId, delta, executor);
  }

  return selected.length;
}
