'use server';

import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import {
  memberCondition,
  NO_PROJECT_ACCESS,
  projectRefsError,
  verifyProjectWriteAccess,
} from '@/lib/auth/project-access';
import { invalidateRelatedCache } from '@/lib/cache';
import { db } from '@/lib/db';
import {
  cardPurchases,
  transactions,
  projectMembers,
  accounts,
  projects,
  currencies,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { ActionResult } from '@/types/action-result';
import { createCardPurchaseSchema, updateCardPurchaseSchema } from '../schemas';
import type { CardPurchase } from '../types';
import { updateAccountBalance } from '@/features/accounts/lib/balance';

/**
 * Busca la compra si el usuario puede modificarla (miembro con rol de escritura).
 */
async function findWritablePurchase(purchaseId: string, userId: string) {
  const [row] = await db
    .select({ purchase: cardPurchases })
    .from(cardPurchases)
    .innerJoin(projectMembers, eq(cardPurchases.projectId, projectMembers.projectId))
    .where(and(eq(cardPurchases.id, purchaseId), memberCondition(userId, { write: true })))
    .limit(1);
  return row?.purchase ?? null;
}

/**
 * Crea una nueva compra en cuotas
 */
export async function createCardPurchase(data: {
  userId: string;
  projectId: string;
  accountId: string;
  categoryId: string;
  entityId?: string | null;
  description: string;
  storeName?: string | null;
  purchaseDate: Date;
  originalAmount: number;
  interestRate?: number | null;
  installments: number;
  firstChargeDate: Date;
  chargedInstallments?: number;
  isExternalDebt?: boolean;
  nature?: 'own' | 'external' | 'reimbursable' | 'fund';
  notes?: string | null;
}): Promise<ActionResult<CardPurchase>> {
  if (!(await isSessionUser(data.userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  try {
    // Validar datos
    const validated = createCardPurchaseSchema.parse(data);
    // La naturaleza manda; is_external_debt se mantiene sincronizado por compatibilidad
    const nature = validated.nature ?? (validated.isExternalDebt ? 'external' : 'own');

    // Verificar acceso de escritura al proyecto
    if (!(await verifyProjectWriteAccess(validated.projectId, validated.userId))) {
      return { success: false, error: NO_PROJECT_ACCESS };
    }

    // La tarjeta y la categoría deben ser del proyecto
    const refsError = await projectRefsError(validated.projectId, {
      accountIds: [validated.accountId],
      categoryIds: [validated.categoryId],
    });
    if (refsError) return { success: false, error: refsError };

    // Verificar que la cuenta existe y es una tarjeta de crédito
    const account = await db
      .select({ id: accounts.id, type: accounts.type })
      .from(accounts)
      .where(and(eq(accounts.id, validated.accountId), eq(accounts.projectId, validated.projectId)))
      .limit(1);

    if (account.length === 0) {
      return { success: false, error: 'Cuenta no encontrada' };
    }

    if (account[0].type !== 'credit_card') {
      return { success: false, error: 'La cuenta debe ser una tarjeta de crédito' };
    }

    // Obtener moneda del proyecto
    const [projectInfo] = await db
      .select({
        currencyCode: currencies.code,
      })
      .from(projects)
      .innerJoin(currencies, eq(projects.baseCurrencyId, currencies.id))
      .where(eq(projects.id, validated.projectId))
      .limit(1);

    if (!projectInfo) {
      return { success: false, error: 'Proyecto no encontrado' };
    }

    // Calcular montos
    const interestRate = validated.interestRate || 0;
    const interestMultiplier = 1 + interestRate / 100;
    const totalAmount = validated.originalAmount * interestMultiplier;
    const interestAmount = totalAmount - validated.originalAmount;
    const installmentAmount = totalAmount / validated.installments;

    // Calcular cuotas ya pagadas (vencidas antes de hoy) - NO crear transacciones
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let initialPaidInstallments = 0;

    for (let i = 0; i < validated.installments; i++) {
      const chargeDate = new Date(validated.firstChargeDate);
      chargeDate.setMonth(chargeDate.getMonth() + i);

      if (chargeDate < today) {
        initialPaidInstallments++;
      } else {
        break;
      }
    }

    // Crear la compra y sus cuotas en una sola transacción
    const { purchase, insertedInstallments } = await db.transaction(async (tx) => {
      const [purchase] = await tx
        .insert(cardPurchases)
        .values({
          userId: validated.userId,
          projectId: validated.projectId,
          accountId: validated.accountId,
          categoryId: validated.categoryId || null,
          entityId: validated.entityId || null,
          description: validated.description,
          storeName: validated.storeName || null,
          purchaseDate: validated.purchaseDate,
          originalAmount: validated.originalAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          interestAmount: interestAmount.toFixed(2),
          interestRate: interestRate.toFixed(2),
          installments: validated.installments,
          installmentAmount: installmentAmount.toFixed(2),
          firstChargeDate: validated.firstChargeDate,
          chargedInstallments: validated.installments, // Todas las cuotas se crean de inmediato
          initialPaidInstallments,
          isExternalDebt: nature === 'external',
          nature,
          notes: validated.notes || null,
          isActive: true, // Activa mientras tenga cuotas pendientes de pago
        })
        .returning();

      // Crear TODAS las transacciones de cuotas inmediatamente
      // isPaid = true para que afecten el balance de la TC
      // paidByTransferId = null hasta que el usuario pague la TC
      if (validated.categoryId) {
        const installmentTransactions = [];

        for (let i = 0; i < validated.installments; i++) {
          const chargeDate = new Date(validated.firstChargeDate);
          chargeDate.setMonth(chargeDate.getMonth() + i);

          const installmentNumber = i + 1;
          // Las primeras initialPaidInstallments cuotas se marcan como históricamente pagadas
          const isHistorical = i < initialPaidInstallments;

          installmentTransactions.push({
            userId: validated.userId,
            projectId: validated.projectId,
            accountId: validated.accountId,
            categoryId: validated.categoryId,
            entityId: validated.entityId || null,
            cardPurchaseId: purchase.id,
            type: 'expense' as const,
            nature,
            description: `${validated.description} - Cuota ${installmentNumber}/${validated.installments}`,
            originalAmount: installmentAmount.toFixed(2),
            originalCurrency: projectInfo.currencyCode,
            baseAmount: installmentAmount.toFixed(2),
            baseCurrency: projectInfo.currencyCode,
            exchangeRate: '1',
            date: chargeDate,
            isPaid: true, // Siempre true para TC - afecta balance inmediatamente
            paidAt: null, // Se establece cuando se paga la TC
            isHistoricallyPaid: isHistorical, // Cuotas pagadas antes de usar la app
          });
        }

        if (installmentTransactions.length > 0) {
          await tx.insert(transactions).values(installmentTransactions);
        }
        return { purchase, insertedInstallments: installmentTransactions.length };
      }
      return { purchase, insertedInstallments: 0 };
    });

    // Actualizar el balance de la tarjeta de crédito
    // Para TC, un gasto aumenta la deuda (updateAccountBalance ya maneja esto)
    if (insertedInstallments > 0) {
      await updateAccountBalance(validated.accountId, -totalAmount);
    }

    invalidateRelatedCache('cardPurchases');

    return { success: true, data: purchase };
  } catch (error) {
    console.error('Error creating card purchase:', error);
    return { success: false, error: 'Error al crear la compra' };
  }
}

/**
 * Actualiza una compra en cuotas
 */
export async function updateCardPurchase(
  purchaseId: string,
  userId: string,
  data: {
    categoryId?: string | null;
    entityId?: string | null;
    description?: string;
    storeName?: string | null;
    notes?: string | null;
    nature?: 'own' | 'external' | 'reimbursable' | 'fund';
  }
): Promise<ActionResult<CardPurchase>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  try {
    const validated = updateCardPurchaseSchema.parse(data);

    // Verificar acceso de escritura
    const existing = await findWritablePurchase(purchaseId, userId);
    if (!existing) {
      return { success: false, error: 'Compra no encontrada' };
    }

    // La categoría nueva debe ser del proyecto de la compra
    const refsError = await projectRefsError(existing.projectId, {
      categoryIds: [validated.categoryId],
    });
    if (refsError) return { success: false, error: refsError };

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(cardPurchases)
        .set({
          ...validated,
          ...(validated.nature ? { isExternalDebt: validated.nature === 'external' } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(cardPurchases.id, purchaseId), eq(cardPurchases.projectId, existing.projectId)))
        .returning();

      // Las cuotas heredan la naturaleza de la compra
      if (validated.nature) {
        await tx
          .update(transactions)
          .set({ nature: validated.nature, updatedAt: new Date() })
          .where(eq(transactions.cardPurchaseId, purchaseId));
      }
      return row;
    });

    if (validated.nature) invalidateRelatedCache('transactions');

    invalidateRelatedCache('cardPurchases');

    return { success: true, data: updated };
  } catch (error) {
    console.error('Error updating card purchase:', error);
    return { success: false, error: 'Error al actualizar' };
  }
}

/**
 * Archiva (desactiva) una compra en cuotas
 */
export async function archiveCardPurchase(
  purchaseId: string,
  userId: string
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  try {
    // Verificar acceso de escritura
    const existing = await findWritablePurchase(purchaseId, userId);
    if (!existing) {
      return { success: false, error: 'Compra no encontrada' };
    }

    await db
      .update(cardPurchases)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(eq(cardPurchases.id, purchaseId), eq(cardPurchases.projectId, existing.projectId)));

    invalidateRelatedCache('cardPurchases');

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error archiving card purchase:', error);
    return { success: false, error: 'Error al archivar' };
  }
}

/**
 * Elimina una compra en cuotas junto con todas sus transacciones asociadas
 */
export async function deleteCardPurchase(
  purchaseId: string,
  userId: string
): Promise<ActionResult<{ deletedTransactions: number }>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  try {
    // Verificar acceso de escritura
    const existing = await findWritablePurchase(purchaseId, userId);
    if (!existing) {
      return { success: false, error: 'Compra no encontrada' };
    }

    const deletedTransactions = await db.transaction(async (tx) => {
      // Primero eliminar todas las transacciones asociadas a esta compra
      const deleted = await tx
        .delete(transactions)
        .where(
          and(eq(transactions.cardPurchaseId, purchaseId), eq(transactions.projectId, existing.projectId))
        )
        .returning({ id: transactions.id });

      // Luego eliminar la compra
      await tx
        .delete(cardPurchases)
        .where(and(eq(cardPurchases.id, purchaseId), eq(cardPurchases.projectId, existing.projectId)));
      return deleted.length;
    });

    invalidateRelatedCache('cardPurchases');

    return { success: true, data: { deletedTransactions } };
  } catch (error) {
    console.error('Error deleting card purchase:', error);
    return { success: false, error: 'Error al eliminar' };
  }
}

/**
 * Regenera todas las transacciones de cuotas de una compra.
 * Elimina las transacciones existentes y las vuelve a crear con la lógica original.
 */
export async function regenerateInstallments(
  purchaseId: string,
  userId: string
): Promise<ActionResult<{ regenerated: number }>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  try {
    // Obtener la compra con verificación de acceso de escritura
    const p = await findWritablePurchase(purchaseId, userId);
    if (!p) {
      return { success: false, error: 'Compra no encontrada' };
    }

    if (!p.categoryId) {
      return { success: false, error: 'La compra no tiene categoría asignada' };
    }

    // Obtener moneda del proyecto
    const [projectInfo] = await db
      .select({ currencyCode: currencies.code })
      .from(projects)
      .innerJoin(currencies, eq(projects.baseCurrencyId, currencies.id))
      .where(eq(projects.id, p.projectId))
      .limit(1);

    if (!projectInfo) {
      return { success: false, error: 'Proyecto no encontrado' };
    }

    // Calcular el total actual de las transacciones existentes para ajustar balance
    const [currentTotal] = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${transactions.baseAmount} AS numeric)), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.cardPurchaseId, purchaseId));

    const oldTransactionsTotal = parseFloat(currentTotal?.total ?? '0');

    // Recalcular cuotas históricamente pagadas
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let initialPaidInstallments = 0;
    const installmentAmount = parseFloat(p.installmentAmount);
    const totalAmount = parseFloat(p.totalAmount);

    for (let i = 0; i < p.installments; i++) {
      const chargeDate = new Date(p.firstChargeDate);
      chargeDate.setMonth(chargeDate.getMonth() + i);
      if (chargeDate < today) {
        initialPaidInstallments++;
      } else {
        break;
      }
    }

    // Crear TODAS las transacciones de cuotas
    const installmentTransactions: (typeof transactions.$inferInsert)[] = [];

    for (let i = 0; i < p.installments; i++) {
      const chargeDate = new Date(p.firstChargeDate);
      chargeDate.setMonth(chargeDate.getMonth() + i);

      const installmentNumber = i + 1;
      const isHistorical = i < initialPaidInstallments;

      installmentTransactions.push({
        userId: p.userId,
        projectId: p.projectId,
        accountId: p.accountId,
        categoryId: p.categoryId,
        entityId: p.entityId,
        cardPurchaseId: p.id,
        type: 'expense' as const,
        nature: p.nature,
        description: `${p.description} - Cuota ${installmentNumber}/${p.installments}`,
        originalAmount: installmentAmount.toFixed(2),
        originalCurrency: projectInfo.currencyCode,
        baseAmount: installmentAmount.toFixed(2),
        baseCurrency: projectInfo.currencyCode,
        exchangeRate: '1',
        date: chargeDate,
        isPaid: true,
        paidAt: null,
        isHistoricallyPaid: isHistorical,
      });
    }

    // Reemplazar las cuotas y actualizar la compra en una sola transacción
    await db.transaction(async (tx) => {
      // Eliminar todas las transacciones existentes
      await tx
        .delete(transactions)
        .where(and(eq(transactions.cardPurchaseId, purchaseId), eq(transactions.projectId, p.projectId)));

      if (installmentTransactions.length > 0) {
        await tx.insert(transactions).values(installmentTransactions);
      }

      // Actualizar campos en la compra
      await tx
        .update(cardPurchases)
        .set({
          chargedInstallments: p.installments,
          initialPaidInstallments,
          updatedAt: new Date(),
        })
        .where(and(eq(cardPurchases.id, purchaseId), eq(cardPurchases.projectId, p.projectId)));
    });

    // Ajustar balance de la cuenta: revertir viejo total + aplicar nuevo total
    // oldTransactionsTotal = suma de baseAmount de las transacciones eliminadas (positivo = gastos)
    // totalAmount = monto total de la compra que debe estar reflejado como deuda
    const balanceDiff = oldTransactionsTotal - totalAmount;
    if (balanceDiff !== 0) {
      await updateAccountBalance(p.accountId, balanceDiff);
    }

    invalidateRelatedCache('cardPurchases');

    return { success: true, data: { regenerated: installmentTransactions.length } };
  } catch (error) {
    console.error('Error regenerating installments:', error);
    return { success: false, error: 'Error al regenerar cuotas' };
  }
}
