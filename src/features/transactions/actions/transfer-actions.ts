'use server';

import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { transactions, projects, accounts, categories } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { invalidateRelatedCache } from '@/lib/cache';
import { createAccountTransferSchema } from '../schemas';
import type { CreateAccountTransferInput } from '../schemas';
import type { ActionResult } from '@/types/action-result';
import { updateAccountBalance } from '@/features/accounts/lib/balance';
import { NO_PROJECT_ACCESS, projectRefsError, verifyProjectWriteAccess } from '@/lib/auth/project-access';

/**
 * Crea una transferencia entre cuentas (genera 2 transacciones vinculadas)
 */
export async function createAccountTransfer(
  userId: string,
  input: CreateAccountTransferInput
): Promise<ActionResult<{ id: string }>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  const parsed = createAccountTransferSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar acceso de escritura al proyecto
  const hasAccess = await verifyProjectWriteAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: NO_PROJECT_ACCESS };
  }

  const projectId = parsed.data.projectId;

  // Moneda del proyecto, nombres y entityId de las cuentas (ambas del proyecto) y la meta
  const accountQuery = (accountId: string) =>
    db
      .select({ name: accounts.name, entityId: accounts.entityId })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.projectId, projectId)))
      .limit(1);

  const [project, fromAccount, toAccount, refsError] = await Promise.all([
    db.select({ currency: projects.currency }).from(projects).where(eq(projects.id, projectId)).limit(1),
    accountQuery(parsed.data.fromAccountId),
    accountQuery(parsed.data.toAccountId),
    projectRefsError(projectId, { savingsGoalIds: [parsed.data.savingsGoalId] }),
  ]);

  if (!project[0]) {
    return { success: false, error: 'Proyecto no encontrado' };
  }

  if (!fromAccount[0] || !toAccount[0]) {
    return { success: false, error: 'Cuenta no encontrada' };
  }

  if (refsError) {
    return { success: false, error: refsError };
  }

  // Buscar o crear categoría de transferencias (por nombre)
  const transferCategory = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.projectId, parsed.data.projectId),
        eq(categories.name, 'Transferencias')
      )
    )
    .limit(1);

  let transferCategoryId: string;
  if (!transferCategory[0]) {
    // Crear categoría de transferencias automáticamente
    const [newCategory] = await db
      .insert(categories)
      .values({
        projectId: parsed.data.projectId,
        name: 'Transferencias',
        color: '#6B7280', // Gray color
      })
      .returning({ id: categories.id });
    transferCategoryId = newCategory.id;
  } else {
    transferCategoryId = transferCategory[0].id;
  }

  const amount = String(parsed.data.amount);
  const description = parsed.data.description || 'Transferencia entre cuentas';

  const amountNum = parseFloat(amount);

  // Las dos patas del traspaso y los saldos se guardan juntos: si algo falla, no queda nada suelto
  const outTransactionId = await db.transaction(async (tx) => {
    // Crear transacción de salida (expense en cuenta origen)
    // Usa el entityId de la cuenta origen
    const [outTransaction] = await tx
      .insert(transactions)
      .values({
        userId,
        projectId: parsed.data.projectId,
        categoryId: transferCategoryId,
        accountId: parsed.data.fromAccountId,
        entityId: fromAccount[0].entityId,
        type: 'expense',
        nature: parsed.data.isThirdParty ? 'external' : 'own',
        description: `${description} → ${toAccount[0].name}`,
        notes: parsed.data.notes,
        date: parsed.data.date,
        isPaid: true,
        originalAmount: amount,
        originalCurrency: project[0].currency,
        baseAmount: amount,
        baseCurrency: project[0].currency,
        exchangeRate: '1',
      })
      .returning({ id: transactions.id });

    // Crear transacción de entrada (income en cuenta destino)
    // Usa el entityId de la cuenta destino
    const [inTransaction] = await tx
      .insert(transactions)
      .values({
        userId,
        projectId: parsed.data.projectId,
        categoryId: transferCategoryId,
        accountId: parsed.data.toAccountId,
        entityId: toAccount[0].entityId,
        type: 'income',
        nature: parsed.data.isThirdParty ? 'external' : 'own',
        description: `${description} ← ${fromAccount[0].name}`,
        notes: parsed.data.notes,
        date: parsed.data.date,
        isPaid: true,
        originalAmount: amount,
        originalCurrency: project[0].currency,
        baseAmount: amount,
        baseCurrency: project[0].currency,
        exchangeRate: '1',
        linkedTransactionId: outTransaction.id,
        savingsGoalId: parsed.data.savingsGoalId ?? null,
      })
      .returning({ id: transactions.id });

    // Actualizar la transacción de salida con el linkedTransactionId
    await tx
      .update(transactions)
      .set({ linkedTransactionId: inTransaction.id })
      .where(eq(transactions.id, outTransaction.id));

    // Actualizar balances (restar de origen, sumar a destino)
    await updateAccountBalance(parsed.data.fromAccountId, -amountNum, tx);
    await updateAccountBalance(parsed.data.toAccountId, amountNum, tx);

    return outTransaction.id;
  });

  invalidateRelatedCache('transactions');
  invalidateRelatedCache('savings');

  return { success: true, data: { id: outTransactionId } };
}
