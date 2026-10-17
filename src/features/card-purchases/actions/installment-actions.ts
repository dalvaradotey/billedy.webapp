'use server';

import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import { memberCondition, NO_PROJECT_ACCESS } from '@/lib/auth/project-access';
import { invalidateRelatedCache } from '@/lib/cache';
import { db } from '@/lib/db';
import {
  cardPurchases,
  transactions,
  projectMembers,
  projects,
  currencies,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { ActionResult } from '@/types/action-result';

/**
 * Cobra una cuota de una compra, generando una transacción
 */
export async function chargeInstallment(
  purchaseId: string,
  userId: string,
  date: Date = new Date()
): Promise<ActionResult> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

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
      .where(and(eq(cardPurchases.id, purchaseId), memberCondition(userId, { write: true })))
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

    // Nuevo contador de cuotas cobradas
    const newChargedInstallments = purchase.chargedInstallments + 1;
    const isComplete = newChargedInstallments >= purchase.installments;

    await db.transaction(async (tx) => {
      // Crear transacción de gasto
      await tx.insert(transactions).values({
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

      await tx
        .update(cardPurchases)
        .set({
          chargedInstallments: newChargedInstallments,
          isActive: !isComplete,
          updatedAt: new Date(),
        })
        .where(and(eq(cardPurchases.id, purchaseId), eq(cardPurchases.projectId, purchase.projectId)));
    });

    invalidateRelatedCache('cardPurchases');

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error charging installment:', error);
    return { success: false, error: 'Error al cobrar cuota' };
  }
}

/**
 * Cobra todas las cuotas pendientes hasta la fecha actual
 */
export async function chargeAllPendingInstallments(
  projectId: string,
  userId: string
): Promise<ActionResult<{ charged: number }>> {
  if (!(await isSessionUser(userId))) {
    return { success: false, error: UNAUTHORIZED_ERROR };
  }

  try {
    // Verificar acceso de escritura y obtener info del proyecto
    const [projectInfo] = await db
      .select({
        id: projects.id,
        baseCurrencyId: projects.baseCurrencyId,
        currencyCode: currencies.code,
      })
      .from(projects)
      .innerJoin(currencies, eq(projects.baseCurrencyId, currencies.id))
      .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(and(eq(projects.id, projectId), memberCondition(userId, { write: true })))
      .limit(1);

    if (!projectInfo) {
      return { success: false, error: NO_PROJECT_ACCESS };
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
    const transactionsToInsert: (typeof transactions.$inferInsert)[] = [];
    // Nuevo contador de cuotas cobradas por compra
    const purchaseUpdates: { id: string; charged: number; isActive: boolean }[] = [];

    for (const purchase of activePurchases) {
      // Skip purchases without category
      if (!purchase.categoryId) continue;

      const firstCharge = new Date(purchase.firstChargeDate);
      let chargedNow = 0;

      // Iterar cada cuota restante y verificar si su fecha ya pasó
      for (let i = purchase.chargedInstallments; i < purchase.installments; i++) {
        const chargeDate = new Date(firstCharge);
        chargeDate.setMonth(chargeDate.getMonth() + i);

        // Solo cobrar si la fecha ya pasó (antes de hoy)
        if (chargeDate < today) {
          const installmentNumber = i + 1;
          chargedNow++;
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

      if (chargedNow > 0) {
        const newChargedInstallments = purchase.chargedInstallments + chargedNow;
        purchaseUpdates.push({
          id: purchase.id,
          charged: newChargedInstallments,
          isActive: newChargedInstallments < purchase.installments,
        });
      }
    }

    if (transactionsToInsert.length > 0) {
      // Un solo insert de cuotas y un solo update de compras (sin N+1)
      const values = sql.join(
        purchaseUpdates.map((u) => sql`(${u.id}, ${u.charged}::int, ${u.isActive}::boolean)`),
        sql`, `
      );
      await db.transaction(async (tx) => {
        await tx.insert(transactions).values(transactionsToInsert);
        await tx.execute(sql`
          update ${cardPurchases}
          set charged_installments = v.charged, is_active = v.is_active, updated_at = now()
          from (values ${values}) as v(id, charged, is_active)
          where ${cardPurchases.id} = v.id::uuid and ${cardPurchases.projectId} = ${projectId}
        `);
      });
    }

    invalidateRelatedCache('cardPurchases');

    return { success: true, data: { charged: transactionsToInsert.length } };
  } catch (error) {
    console.error('Error charging pending installments:', error);
    return { success: false, error: 'Error al cobrar cuotas' };
  }
}
