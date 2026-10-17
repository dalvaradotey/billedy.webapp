import { cache } from 'react';
import { db } from '@/lib/db';
import { cardPurchases, accounts, categories, projects, entities, transactions } from '@/lib/db/schema';
import { eq, and, desc, isNotNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { verifyProjectAccess } from '@/lib/auth/project-access';
import type { CardPurchaseWithDetails, CardPurchasesSummary, DebtCapacityReport } from './types';

// Alias for account entity (to join entities table twice)
const accountEntities = alias(entities, 'accountEntities');

/**
 * Todas las compras del proyecto con sus cuotas pagadas y campos derivados.
 * Devuelve null si el usuario no tiene acceso. Va envuelta en `cache` para que
 * la lista, el resumen y el reporte de capacidad compartan una sola lectura
 * por request.
 */
const getPurchasesWithPaidCounts = cache(
  async (projectId: string, userId: string): Promise<CardPurchaseWithDetails[] | null> => {
    if (!(await verifyProjectAccess(projectId, userId))) {
      return null;
    }

    const [result, paidByPurchase] = await Promise.all([
      db
        .select({
          id: cardPurchases.id,
          userId: cardPurchases.userId,
          projectId: cardPurchases.projectId,
          accountId: cardPurchases.accountId,
          categoryId: cardPurchases.categoryId,
          entityId: cardPurchases.entityId,
          description: cardPurchases.description,
          purchaseDate: cardPurchases.purchaseDate,
          originalAmount: cardPurchases.originalAmount,
          totalAmount: cardPurchases.totalAmount,
          interestAmount: cardPurchases.interestAmount,
          interestRate: cardPurchases.interestRate,
          installments: cardPurchases.installments,
          installmentAmount: cardPurchases.installmentAmount,
          firstChargeDate: cardPurchases.firstChargeDate,
          chargedInstallments: cardPurchases.chargedInstallments,
          initialPaidInstallments: cardPurchases.initialPaidInstallments,
          isActive: cardPurchases.isActive,
          nature: cardPurchases.nature,
          notes: cardPurchases.notes,
          createdAt: cardPurchases.createdAt,
          updatedAt: cardPurchases.updatedAt,
          accountName: accounts.name,
          accountType: accounts.type,
          accountEntityName: accountEntities.name,
          accountEntityImageUrl: accountEntities.imageUrl,
          categoryName: categories.name,
          categoryColor: categories.color,
          entityName: entities.name,
          entityImageUrl: entities.imageUrl,
        })
        .from(cardPurchases)
        .innerJoin(accounts, eq(cardPurchases.accountId, accounts.id))
        .leftJoin(accountEntities, eq(accounts.entityId, accountEntities.id))
        .leftJoin(categories, eq(cardPurchases.categoryId, categories.id))
        .leftJoin(entities, eq(cardPurchases.entityId, entities.id))
        .where(eq(cardPurchases.projectId, projectId))
        .orderBy(desc(cardPurchases.purchaseDate), desc(cardPurchases.createdAt)),
      // Cuotas pagadas por compra (históricas o pagadas con transferencia)
      db
        .select({
          cardPurchaseId: transactions.cardPurchaseId,
          paidCount: sql<number>`COUNT(*)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.projectId, projectId),
            isNotNull(transactions.cardPurchaseId),
            or(eq(transactions.isHistoricallyPaid, true), isNotNull(transactions.paidByTransferId))
          )
        )
        .groupBy(transactions.cardPurchaseId),
    ]);

    // Crear mapa de cuotas pagadas
    const paidMap = new Map<string, number>();
    for (const row of paidByPurchase) {
      if (row.cardPurchaseId) {
        paidMap.set(row.cardPurchaseId, Number(row.paidCount));
      }
    }

    // Calcular campos derivados usando transacciones pagadas
    return result.map((purchase) => {
      // Cuotas pagadas = históricas (isHistoricallyPaid) + pagadas con transferencia (paidByTransferId)
      const paidInstallments = paidMap.get(purchase.id) ?? 0;
      const remaining = purchase.installments - paidInstallments;
      const remainingAmount = remaining * parseFloat(purchase.installmentAmount);
      const progress = (paidInstallments / purchase.installments) * 100;

      // Calcular próxima fecha de cargo
      let nextChargeDate: Date | null = null;
      if (purchase.isActive && remaining > 0) {
        const firstCharge = new Date(purchase.firstChargeDate);
        nextChargeDate = new Date(firstCharge);
        nextChargeDate.setMonth(nextChargeDate.getMonth() + paidInstallments);
      }

      return {
        ...purchase,
        chargedInstallments: paidInstallments, // Cuotas realmente pagadas (con transferencia)
        remainingInstallments: remaining,
        remainingAmount,
        progressPercentage: Math.round(progress),
        nextChargeDate,
      };
    });
  }
);

/**
 * Obtiene las compras en cuotas del proyecto
 */
export async function getCardPurchases(
  projectId: string,
  userId: string,
  activeOnly: boolean = false
): Promise<CardPurchaseWithDetails[]> {
  const purchases = (await getPurchasesWithPaidCounts(projectId, userId)) ?? [];
  return activeOnly ? purchases.filter((p) => p.isActive) : purchases;
}

/**
 * Obtiene el resumen de compras en cuotas
 */
export async function getCardPurchasesSummary(
  projectId: string,
  userId: string
): Promise<CardPurchasesSummary> {
  const purchases = (await getPurchasesWithPaidCounts(projectId, userId)) ?? [];

  const totalPurchases = purchases.length;
  let activePurchases = 0;
  let totalDebt = 0;
  let totalInterestPaid = 0;
  let monthlyCharge = 0;
  let personalDebt = 0;
  let externalDebt = 0;

  for (const p of purchases) {
    const remaining = p.remainingInstallments;
    const remainingAmount = p.remainingAmount;

    if (p.isActive && remaining > 0) {
      activePurchases++;
      totalDebt += remainingAmount;
      monthlyCharge += parseFloat(p.installmentAmount);

      // Separar deuda personal vs externa
      if (p.nature === 'external') {
        externalDebt += remainingAmount;
      } else {
        personalDebt += remainingAmount;
      }
    }

    // Interés pagado proporcional a las cuotas pagadas
    const interestPerInstallment = parseFloat(p.interestAmount) / p.installments;
    totalInterestPaid += interestPerInstallment * p.chargedInstallments;
  }

  return {
    totalPurchases,
    activePurchases,
    totalDebt: Math.round(totalDebt),
    totalInterestPaid: Math.round(totalInterestPaid),
    monthlyCharge: Math.round(monthlyCharge),
    personalDebt: Math.round(personalDebt),
    externalDebt: Math.round(externalDebt),
  };
}

/**
 * Obtiene el reporte de capacidad de endeudamiento en cuotas
 */
export async function getDebtCapacityReport(
  projectId: string,
  userId: string
): Promise<DebtCapacityReport> {
  // Límite del proyecto y compras (el helper ya verifica el acceso)
  const [[project], allPurchases] = await Promise.all([
    db
      .select({ maxInstallmentAmount: projects.maxInstallmentAmount })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1),
    getPurchasesWithPaidCounts(projectId, userId),
  ]);

  if (!project || !allPurchases) {
    return {
      maxInstallmentAmount: null,
      personalDebt: 0,
      externalDebt: 0,
      usedPercentage: 0,
      availableCapacity: 0,
      isOverLimit: false,
    };
  }

  // Deudas activas
  const purchases = allPurchases.filter((p) => p.isActive);

  if (purchases.length === 0) {
    return {
      maxInstallmentAmount: project.maxInstallmentAmount
        ? parseFloat(project.maxInstallmentAmount)
        : null,
      personalDebt: 0,
      externalDebt: 0,
      usedPercentage: 0,
      availableCapacity: project.maxInstallmentAmount
        ? parseFloat(project.maxInstallmentAmount)
        : 0,
      isOverLimit: false,
    };
  }

  let personalMonthlyCharge = 0;
  let externalMonthlyCharge = 0;

  for (const p of purchases) {
    if (p.remainingInstallments > 0) {
      // Usar el monto de la cuota mensual, no el total restante
      const installmentAmount = parseFloat(p.installmentAmount);
      if (p.nature === 'external') {
        externalMonthlyCharge += installmentAmount;
      } else {
        personalMonthlyCharge += installmentAmount;
      }
    }
  }

  const maxAmount = project.maxInstallmentAmount
    ? parseFloat(project.maxInstallmentAmount)
    : null;

  const usedPercentage = maxAmount && maxAmount > 0
    ? Math.round((personalMonthlyCharge / maxAmount) * 100)
    : 0;

  const availableCapacity = maxAmount
    ? Math.max(0, maxAmount - personalMonthlyCharge)
    : 0;

  const isOverLimit = maxAmount !== null && personalMonthlyCharge > maxAmount;

  return {
    maxInstallmentAmount: maxAmount,
    personalDebt: Math.round(personalMonthlyCharge),
    externalDebt: Math.round(externalMonthlyCharge),
    usedPercentage,
    availableCapacity: Math.round(availableCapacity),
    isOverLimit,
  };
}
