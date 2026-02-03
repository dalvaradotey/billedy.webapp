'use server';

import { invalidateRelatedCache } from '@/lib/cache';
import { db } from '@/lib/db';
import {
  cardPurchases,
  transactions,
  projectMembers,
  projects,
  currencies,
} from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

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
      .innerJoin(projectMembers, eq(cardPurchases.projectId, projectMembers.projectId))
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

    const { purchase, projectCurrency } = result;

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

    invalidateRelatedCache('cardPurchases');

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
        and(eq(cardPurchases.projectId, projectId), eq(cardPurchases.isActive, true))
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
        const newChargedInstallments =
          purchase.chargedInstallments + transactionsToInsert.length;
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

    invalidateRelatedCache('cardPurchases');

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
