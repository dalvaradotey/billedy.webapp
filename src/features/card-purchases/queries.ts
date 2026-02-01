import { db } from '@/lib/db';
import { cardPurchases, accounts, categories, projectMembers, projects, entities, transactions } from '@/lib/db/schema';
import { eq, and, desc, isNotNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { CardPurchaseWithDetails, CardPurchasesSummary, DebtCapacityReport } from './types';

// Alias for account entity (to join entities table twice)
const accountEntities = alias(entities, 'accountEntities');

/**
 * Obtiene las compras en cuotas del proyecto
 */
export async function getCardPurchases(
  projectId: string,
  userId: string,
  activeOnly: boolean = false
): Promise<CardPurchaseWithDetails[]> {
  // Verificar acceso al proyecto
  const hasAccess = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (hasAccess.length === 0) {
    return [];
  }

  const conditions = [eq(cardPurchases.projectId, projectId)];
  if (activeOnly) {
    conditions.push(eq(cardPurchases.isActive, true));
  }

  const result = await db
    .select({
      id: cardPurchases.id,
      userId: cardPurchases.userId,
      projectId: cardPurchases.projectId,
      accountId: cardPurchases.accountId,
      categoryId: cardPurchases.categoryId,
      entityId: cardPurchases.entityId,
      description: cardPurchases.description,
      storeName: cardPurchases.storeName,
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
      isExternalDebt: cardPurchases.isExternalDebt,
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
    .where(and(...conditions))
    .orderBy(desc(cardPurchases.purchaseDate), desc(cardPurchases.createdAt));

  if (result.length === 0) {
    return [];
  }

  // Obtener cuotas pagadas por compra (contando transacciones con isPaid = true)
  const paidByPurchase = await db
    .select({
      cardPurchaseId: transactions.cardPurchaseId,
      paidCount: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.projectId, projectId),
        isNotNull(transactions.cardPurchaseId),
        eq(transactions.isPaid, true)
      )
    )
    .groupBy(transactions.cardPurchaseId);

  // Crear mapa de cuotas pagadas
  const paidMap = new Map<string, number>();
  for (const row of paidByPurchase) {
    if (row.cardPurchaseId) {
      paidMap.set(row.cardPurchaseId, Number(row.paidCount));
    }
  }

  // Calcular campos derivados usando transacciones pagadas + cuotas iniciales
  return result.map((purchase) => {
    // Cuotas pagadas = iniciales (pre-registro) + transacciones pagadas
    const transactionsPaid = paidMap.get(purchase.id) ?? 0;
    const paidInstallments = (purchase.initialPaidInstallments ?? 0) + transactionsPaid;
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
      chargedInstallments: paidInstallments, // Sobreescribir con el conteo real de transacciones
      remainingInstallments: remaining,
      remainingAmount,
      progressPercentage: Math.round(progress),
      nextChargeDate,
    };
  });
}

/**
 * Obtiene el resumen de compras en cuotas
 */
export async function getCardPurchasesSummary(
  projectId: string,
  userId: string
): Promise<CardPurchasesSummary> {
  const hasAccess = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (hasAccess.length === 0) {
    return {
      totalPurchases: 0,
      activePurchases: 0,
      totalDebt: 0,
      totalInterestPaid: 0,
      monthlyCharge: 0,
      personalDebt: 0,
      externalDebt: 0,
    };
  }

  const purchases = await db
    .select({
      id: cardPurchases.id,
      isActive: cardPurchases.isActive,
      isExternalDebt: cardPurchases.isExternalDebt,
      installments: cardPurchases.installments,
      installmentAmount: cardPurchases.installmentAmount,
      interestAmount: cardPurchases.interestAmount,
      initialPaidInstallments: cardPurchases.initialPaidInstallments,
    })
    .from(cardPurchases)
    .where(eq(cardPurchases.projectId, projectId));

  if (purchases.length === 0) {
    return {
      totalPurchases: 0,
      activePurchases: 0,
      totalDebt: 0,
      totalInterestPaid: 0,
      monthlyCharge: 0,
      personalDebt: 0,
      externalDebt: 0,
    };
  }

  // Obtener cuotas pagadas por compra
  const paidByPurchase = await db
    .select({
      cardPurchaseId: transactions.cardPurchaseId,
      paidCount: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.projectId, projectId),
        isNotNull(transactions.cardPurchaseId),
        eq(transactions.isPaid, true)
      )
    )
    .groupBy(transactions.cardPurchaseId);

  const paidMap = new Map<string, number>();
  for (const row of paidByPurchase) {
    if (row.cardPurchaseId) {
      paidMap.set(row.cardPurchaseId, Number(row.paidCount));
    }
  }

  let totalPurchases = purchases.length;
  let activePurchases = 0;
  let totalDebt = 0;
  let totalInterestPaid = 0;
  let monthlyCharge = 0;
  let personalDebt = 0;
  let externalDebt = 0;

  for (const p of purchases) {
    // Cuotas pagadas = iniciales (pre-registro) + transacciones pagadas
    const transactionsPaid = paidMap.get(p.id) ?? 0;
    const paidInstallments = (p.initialPaidInstallments ?? 0) + transactionsPaid;
    const remaining = p.installments - paidInstallments;
    const remainingAmount = remaining * parseFloat(p.installmentAmount);

    if (p.isActive && remaining > 0) {
      activePurchases++;
      totalDebt += remainingAmount;
      monthlyCharge += parseFloat(p.installmentAmount);

      // Separar deuda personal vs externa
      if (p.isExternalDebt) {
        externalDebt += remainingAmount;
      } else {
        personalDebt += remainingAmount;
      }
    }

    // Interés pagado proporcional a las cuotas pagadas
    const interestPerInstallment = parseFloat(p.interestAmount) / p.installments;
    totalInterestPaid += interestPerInstallment * paidInstallments;
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
 * Obtiene una compra por ID
 */
export async function getCardPurchaseById(
  purchaseId: string,
  userId: string
): Promise<CardPurchaseWithDetails | null> {
  const result = await db
    .select({
      id: cardPurchases.id,
      userId: cardPurchases.userId,
      projectId: cardPurchases.projectId,
      accountId: cardPurchases.accountId,
      categoryId: cardPurchases.categoryId,
      entityId: cardPurchases.entityId,
      description: cardPurchases.description,
      storeName: cardPurchases.storeName,
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
      isExternalDebt: cardPurchases.isExternalDebt,
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
    .innerJoin(projectMembers, eq(cardPurchases.projectId, projectMembers.projectId))
    .leftJoin(categories, eq(cardPurchases.categoryId, categories.id))
    .leftJoin(entities, eq(cardPurchases.entityId, entities.id))
    .where(
      and(
        eq(cardPurchases.id, purchaseId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!result[0]) return null;

  const purchase = result[0];

  // Obtener cuotas pagadas contando transacciones
  const paidResult = await db
    .select({
      paidCount: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.cardPurchaseId, purchaseId),
        eq(transactions.isPaid, true)
      )
    );

  // Cuotas pagadas = iniciales (pre-registro) + transacciones pagadas
  const transactionsPaid = Number(paidResult[0]?.paidCount ?? 0);
  const paidInstallments = (purchase.initialPaidInstallments ?? 0) + transactionsPaid;
  const remaining = purchase.installments - paidInstallments;
  const remainingAmount = remaining * parseFloat(purchase.installmentAmount);
  const progress = (paidInstallments / purchase.installments) * 100;

  let nextChargeDate: Date | null = null;
  if (purchase.isActive && remaining > 0) {
    const firstCharge = new Date(purchase.firstChargeDate);
    nextChargeDate = new Date(firstCharge);
    nextChargeDate.setMonth(nextChargeDate.getMonth() + paidInstallments);
  }

  return {
    ...purchase,
    chargedInstallments: paidInstallments, // Sobreescribir con el total (iniciales + transacciones)
    remainingInstallments: remaining,
    remainingAmount,
    progressPercentage: Math.round(progress),
    nextChargeDate,
  };
}

/**
 * Obtiene el reporte de capacidad de endeudamiento en cuotas
 */
export async function getDebtCapacityReport(
  projectId: string,
  userId: string
): Promise<DebtCapacityReport> {
  // Verificar acceso y obtener límite del proyecto
  const [project] = await db
    .select({
      maxInstallmentAmount: projects.maxInstallmentAmount,
    })
    .from(projects)
    .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
    .where(
      and(
        eq(projects.id, projectId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!project) {
    return {
      maxInstallmentAmount: null,
      personalDebt: 0,
      externalDebt: 0,
      usedPercentage: 0,
      availableCapacity: 0,
      isOverLimit: false,
    };
  }

  // Obtener deudas activas
  const purchases = await db
    .select({
      id: cardPurchases.id,
      isExternalDebt: cardPurchases.isExternalDebt,
      installments: cardPurchases.installments,
      installmentAmount: cardPurchases.installmentAmount,
      initialPaidInstallments: cardPurchases.initialPaidInstallments,
    })
    .from(cardPurchases)
    .where(
      and(
        eq(cardPurchases.projectId, projectId),
        eq(cardPurchases.isActive, true)
      )
    );

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

  // Obtener cuotas pagadas por compra
  const paidByPurchase = await db
    .select({
      cardPurchaseId: transactions.cardPurchaseId,
      paidCount: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.projectId, projectId),
        isNotNull(transactions.cardPurchaseId),
        eq(transactions.isPaid, true)
      )
    )
    .groupBy(transactions.cardPurchaseId);

  const paidMap = new Map<string, number>();
  for (const row of paidByPurchase) {
    if (row.cardPurchaseId) {
      paidMap.set(row.cardPurchaseId, Number(row.paidCount));
    }
  }

  let personalMonthlyCharge = 0;
  let externalMonthlyCharge = 0;

  for (const p of purchases) {
    // Cuotas pagadas = iniciales (pre-registro) + transacciones pagadas
    const transactionsPaid = paidMap.get(p.id) ?? 0;
    const paidInstallments = (p.initialPaidInstallments ?? 0) + transactionsPaid;
    const remaining = p.installments - paidInstallments;
    if (remaining > 0) {
      // Usar el monto de la cuota mensual, no el total restante
      const installmentAmount = parseFloat(p.installmentAmount);
      if (p.isExternalDebt) {
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
