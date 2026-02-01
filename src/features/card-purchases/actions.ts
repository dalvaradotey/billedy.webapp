'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { cardPurchases, transactions, projectMembers, accounts, projects, currencies } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { createCardPurchaseSchema, updateCardPurchaseSchema } from './schemas';
import type { CardPurchase } from './types';

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
    const interestMultiplier = 1 + (interestRate / 100);
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
        chargedInstallments: 0,
        initialPaidInstallments,
        isExternalDebt: validated.isExternalDebt || false,
        notes: validated.notes || null,
        isActive: initialPaidInstallments < validated.installments,
      })
      .returning();

    revalidatePath('/dashboard/card-purchases');
    revalidatePath('/dashboard');

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
      .innerJoin(
        projectMembers,
        eq(cardPurchases.projectId, projectMembers.projectId)
      )
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

    revalidatePath('/dashboard/card-purchases');

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
 * Cobra una cuota de una compra, generando una transacción
 */
export async function chargeInstallment(
  purchaseId: string,
  userId: string,
  date: Date = new Date()
): Promise<{ success: boolean; error?: string }> {
  try {
    // Obtener la compra con info del proyecto
    const [result] = await db
      .select({
        purchase: cardPurchases,
        projectCurrency: currencies.code,
        baseCurrencyId: projects.baseCurrencyId,
      })
      .from(cardPurchases)
      .innerJoin(projects, eq(cardPurchases.projectId, projects.id))
      .innerJoin(currencies, eq(projects.baseCurrencyId, currencies.id))
      .innerJoin(
        projectMembers,
        eq(cardPurchases.projectId, projectMembers.projectId)
      )
      .where(
        and(
          eq(cardPurchases.id, purchaseId),
          eq(projectMembers.userId, userId),
          isNotNull(projectMembers.acceptedAt)
        )
      )
      .limit(1);

    if (!result) {
      return { success: false, error: 'Compra no encontrada' };
    }

    const { purchase, projectCurrency, baseCurrencyId } = result;

    if (!purchase.isActive) {
      return { success: false, error: 'La compra ya está finalizada' };
    }

    const remaining = purchase.installments - purchase.chargedInstallments;
    if (remaining <= 0) {
      return { success: false, error: 'Todas las cuotas ya han sido cobradas' };
    }

    if (!purchase.categoryId) {
      return { success: false, error: 'La compra no tiene categoría asignada' };
    }

    const installmentNumber = purchase.chargedInstallments + 1;

    // Crear transacción de gasto
    await db.insert(transactions).values({
      userId: purchase.userId,
      projectId: purchase.projectId,
      accountId: purchase.accountId,
      categoryId: purchase.categoryId,
      cardPurchaseId: purchase.id,
      type: 'expense',
      description: `${purchase.description} - Cuota ${installmentNumber}/${purchase.installments}`,
      originalAmount: purchase.installmentAmount,
      originalCurrency: projectCurrency,
      baseAmount: purchase.installmentAmount,
      baseCurrency: projectCurrency,
      exchangeRate: '1',
      date: date,
    });

    // Actualizar contador de cuotas cobradas
    const newChargedInstallments = purchase.chargedInstallments + 1;
    const isComplete = newChargedInstallments >= purchase.installments;

    await db
      .update(cardPurchases)
      .set({
        chargedInstallments: newChargedInstallments,
        isActive: !isComplete,
        updatedAt: new Date(),
      })
      .where(eq(cardPurchases.id, purchaseId));

    revalidatePath('/dashboard/card-purchases');
    revalidatePath('/dashboard/transactions');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error('Error charging installment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al cobrar cuota',
    };
  }
}

/**
 * Cobra todas las cuotas pendientes hasta la fecha actual
 */
export async function chargeAllPendingInstallments(
  projectId: string,
  userId: string
): Promise<{ success: boolean; charged: number; error?: string }> {
  try {
    // Verificar acceso y obtener info del proyecto
    const [projectInfo] = await db
      .select({
        id: projects.id,
        baseCurrencyId: projects.baseCurrencyId,
        currencyCode: currencies.code,
      })
      .from(projects)
      .innerJoin(currencies, eq(projects.baseCurrencyId, currencies.id))
      .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(
        and(
          eq(projects.id, projectId),
          eq(projectMembers.userId, userId),
          isNotNull(projectMembers.acceptedAt)
        )
      )
      .limit(1);

    if (!projectInfo) {
      return { success: false, charged: 0, error: 'No tienes acceso a este proyecto' };
    }

    // Obtener todas las compras activas
    const activePurchases = await db
      .select()
      .from(cardPurchases)
      .where(
        and(
          eq(cardPurchases.projectId, projectId),
          eq(cardPurchases.isActive, true)
        )
      );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let totalCharged = 0;

    for (const purchase of activePurchases) {
      // Skip purchases without category
      if (!purchase.categoryId) continue;

      const firstCharge = new Date(purchase.firstChargeDate);
      const transactionsToInsert = [];

      // Iterar cada cuota restante y verificar si su fecha ya pasó
      for (let i = purchase.chargedInstallments; i < purchase.installments; i++) {
        const chargeDate = new Date(firstCharge);
        chargeDate.setMonth(chargeDate.getMonth() + i);

        // Solo cobrar si la fecha ya pasó (antes de hoy)
        if (chargeDate < today) {
          const installmentNumber = i + 1;
          transactionsToInsert.push({
            userId: purchase.userId,
            projectId: purchase.projectId,
            accountId: purchase.accountId,
            categoryId: purchase.categoryId,
            cardPurchaseId: purchase.id,
            type: 'expense' as const,
            description: `${purchase.description} - Cuota ${installmentNumber}/${purchase.installments}`,
            originalAmount: purchase.installmentAmount,
            originalCurrency: projectInfo.currencyCode,
            baseAmount: purchase.installmentAmount,
            baseCurrency: projectInfo.currencyCode,
            exchangeRate: '1',
            date: chargeDate,
          });
        } else {
          // Las fechas son secuenciales, si esta no está vencida, las siguientes tampoco
          break;
        }
      }

      if (transactionsToInsert.length > 0) {
        await db.insert(transactions).values(transactionsToInsert);
        totalCharged += transactionsToInsert.length;

        // Actualizar la compra
        const newChargedInstallments = purchase.chargedInstallments + transactionsToInsert.length;
        const isComplete = newChargedInstallments >= purchase.installments;

        await db
          .update(cardPurchases)
          .set({
            chargedInstallments: newChargedInstallments,
            isActive: !isComplete,
            updatedAt: new Date(),
          })
          .where(eq(cardPurchases.id, purchase.id));
      }
    }

    revalidatePath('/dashboard/card-purchases');
    revalidatePath('/dashboard/transactions');
    revalidatePath('/dashboard');

    return { success: true, charged: totalCharged };
  } catch (error) {
    console.error('Error charging pending installments:', error);
    return {
      success: false,
      charged: 0,
      error: error instanceof Error ? error.message : 'Error al cobrar cuotas',
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
      .innerJoin(
        projectMembers,
        eq(cardPurchases.projectId, projectMembers.projectId)
      )
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

    revalidatePath('/dashboard/card-purchases');

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
      .innerJoin(
        projectMembers,
        eq(cardPurchases.projectId, projectMembers.projectId)
      )
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

    revalidatePath('/dashboard/card-purchases');
    revalidatePath('/dashboard/transactions');
    revalidatePath('/dashboard');

    return { success: true, deletedTransactions: deletedTransactions.length };
  } catch (error) {
    console.error('Error deleting card purchase:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar',
    };
  }
}
