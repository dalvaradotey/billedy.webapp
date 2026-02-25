'use server';

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
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { createCardPurchaseSchema, updateCardPurchaseSchema } from '../schemas';
import type { CardPurchase } from '../types';
import { updateAccountBalance } from '@/features/accounts/actions';

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
  notes?: string | null;
}): Promise<{ success: boolean; data?: CardPurchase; error?: string }> {
  try {
    // Validar datos
    const validated = createCardPurchaseSchema.parse(data);

    // Verificar acceso al proyecto
    const hasAccess = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, validated.projectId),
          eq(projectMembers.userId, validated.userId),
          isNotNull(projectMembers.acceptedAt)
        )
      )
      .limit(1);

    if (hasAccess.length === 0) {
      return { success: false, error: 'No tienes acceso a este proyecto' };
    }

    // Verificar que la cuenta existe y es una tarjeta de crédito
    const account = await db
      .select({ id: accounts.id, type: accounts.type })
      .from(accounts)
      .where(eq(accounts.id, validated.accountId))
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

    // Crear la compra
    const [purchase] = await db
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
        isExternalDebt: validated.isExternalDebt || false,
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
        await db.insert(transactions).values(installmentTransactions);

        // Actualizar el balance de la tarjeta de crédito
        // Para TC, un gasto aumenta la deuda (updateAccountBalance ya maneja esto)
        await updateAccountBalance(validated.accountId, -totalAmount);
      }
    }

    invalidateRelatedCache('cardPurchases');

    return { success: true, data: purchase };
  } catch (error) {
    console.error('Error creating card purchase:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear la compra',
    };
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
  }
): Promise<{ success: boolean; data?: CardPurchase; error?: string }> {
  try {
    const validated = updateCardPurchaseSchema.parse(data);

    // Verificar acceso
    const existing = await db
      .select({
        id: cardPurchases.id,
        projectId: cardPurchases.projectId,
      })
      .from(cardPurchases)
      .innerJoin(projectMembers, eq(cardPurchases.projectId, projectMembers.projectId))
      .where(
        and(
          eq(cardPurchases.id, purchaseId),
          eq(projectMembers.userId, userId),
          isNotNull(projectMembers.acceptedAt)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return { success: false, error: 'Compra no encontrada' };
    }

    const [updated] = await db
      .update(cardPurchases)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(eq(cardPurchases.id, purchaseId))
      .returning();

    invalidateRelatedCache('cardPurchases');

    return { success: true, data: updated };
  } catch (error) {
    console.error('Error updating card purchase:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar',
    };
  }
}

/**
 * Archiva (desactiva) una compra en cuotas
 */
export async function archiveCardPurchase(
  purchaseId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verificar acceso
    const existing = await db
      .select({ id: cardPurchases.id })
      .from(cardPurchases)
      .innerJoin(projectMembers, eq(cardPurchases.projectId, projectMembers.projectId))
      .where(
        and(
          eq(cardPurchases.id, purchaseId),
          eq(projectMembers.userId, userId),
          isNotNull(projectMembers.acceptedAt)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return { success: false, error: 'Compra no encontrada' };
    }

    await db
      .update(cardPurchases)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(cardPurchases.id, purchaseId));

    invalidateRelatedCache('cardPurchases');

    return { success: true };
  } catch (error) {
    console.error('Error archiving card purchase:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al archivar',
    };
  }
}

/**
 * Elimina una compra en cuotas junto con todas sus transacciones asociadas
 */
export async function deleteCardPurchase(
  purchaseId: string,
  userId: string
): Promise<{ success: boolean; deletedTransactions?: number; error?: string }> {
  try {
    // Verificar acceso
    const existing = await db
      .select({ id: cardPurchases.id })
      .from(cardPurchases)
      .innerJoin(projectMembers, eq(cardPurchases.projectId, projectMembers.projectId))
      .where(
        and(
          eq(cardPurchases.id, purchaseId),
          eq(projectMembers.userId, userId),
          isNotNull(projectMembers.acceptedAt)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return { success: false, error: 'Compra no encontrada' };
    }

    // Primero eliminar todas las transacciones asociadas a esta compra
    const deletedTransactions = await db
      .delete(transactions)
      .where(eq(transactions.cardPurchaseId, purchaseId))
      .returning({ id: transactions.id });

    // Luego eliminar la compra
    await db.delete(cardPurchases).where(eq(cardPurchases.id, purchaseId));

    invalidateRelatedCache('cardPurchases');

    return { success: true, deletedTransactions: deletedTransactions.length };
  } catch (error) {
    console.error('Error deleting card purchase:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar',
    };
  }
}

/**
 * Regenera todas las transacciones de cuotas de una compra.
 * Elimina las transacciones existentes y las vuelve a crear con la lógica original.
 */
export async function regenerateInstallments(
  purchaseId: string,
  userId: string
): Promise<{ success: boolean; regenerated?: number; error?: string }> {
  try {
    // Obtener la compra con verificación de acceso
    const [purchase] = await db
      .select()
      .from(cardPurchases)
      .innerJoin(projectMembers, eq(cardPurchases.projectId, projectMembers.projectId))
      .where(
        and(
          eq(cardPurchases.id, purchaseId),
          eq(projectMembers.userId, userId),
          isNotNull(projectMembers.acceptedAt)
        )
      )
      .limit(1);

    if (!purchase) {
      return { success: false, error: 'Compra no encontrada' };
    }

    const p = purchase.n1n4_card_purchases;

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

    // Eliminar todas las transacciones existentes
    await db
      .delete(transactions)
      .where(eq(transactions.cardPurchaseId, purchaseId));

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
    const installmentTransactions = [];

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

    if (installmentTransactions.length > 0) {
      await db.insert(transactions).values(installmentTransactions);
    }

    // Ajustar balance de la cuenta: revertir viejo total + aplicar nuevo total
    // oldTransactionsTotal = suma de baseAmount de las transacciones eliminadas (positivo = gastos)
    // totalAmount = monto total de la compra que debe estar reflejado como deuda
    const balanceDiff = oldTransactionsTotal - totalAmount;
    if (balanceDiff !== 0) {
      await updateAccountBalance(p.accountId, balanceDiff);
    }

    // Actualizar campos en la compra
    await db
      .update(cardPurchases)
      .set({
        chargedInstallments: p.installments,
        initialPaidInstallments,
        updatedAt: new Date(),
      })
      .where(eq(cardPurchases.id, purchaseId));

    invalidateRelatedCache('cardPurchases');

    return { success: true, regenerated: installmentTransactions.length };
  } catch (error) {
    console.error('Error regenerating installments:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al regenerar cuotas',
    };
  }
}
