import { db } from '@/lib/db';
import { credits, categories, transactions, projectMembers } from '@/lib/db/schema';
import { eq, and, sql, isNotNull, desc } from 'drizzle-orm';
import type { CreditWithProgress, CreditSummary } from './types';

/**
 * Calcula la próxima fecha de pago basada en la frecuencia
 */
function calculateNextPaymentDate(
  startDate: Date,
  frequency: 'monthly' | 'biweekly' | 'weekly',
  paidInstallments: number
): Date {
  const nextDate = new Date(startDate);

  switch (frequency) {
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + paidInstallments);
      break;
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + paidInstallments * 14);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + paidInstallments * 7);
      break;
  }

  return nextDate;
}

/**
 * Obtiene todos los créditos del proyecto con progreso
 */
export async function getCreditsWithProgress(
  projectId: string,
  userId: string,
  includeArchived: boolean = false
): Promise<CreditWithProgress[]> {
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

  // Condiciones base
  const conditions = [eq(credits.projectId, projectId)];
  if (!includeArchived) {
    conditions.push(eq(credits.isArchived, false));
  }

  // Obtener créditos
  const creditsList = await db
    .select({
      id: credits.id,
      userId: credits.userId,
      projectId: credits.projectId,
      categoryId: credits.categoryId,
      name: credits.name,
      originalPrincipalAmount: credits.originalPrincipalAmount,
      originalTotalAmount: credits.originalTotalAmount,
      originalCurrency: credits.originalCurrency,
      originalCurrencyId: credits.originalCurrencyId,
      basePrincipalAmount: credits.basePrincipalAmount,
      baseTotalAmount: credits.baseTotalAmount,
      baseCurrency: credits.baseCurrency,
      baseCurrencyId: credits.baseCurrencyId,
      exchangeRate: credits.exchangeRate,
      installments: credits.installments,
      installmentAmount: credits.installmentAmount,
      startDate: credits.startDate,
      endDate: credits.endDate,
      frequency: credits.frequency,
      description: credits.description,
      notes: credits.notes,
      isArchived: credits.isArchived,
      createdAt: credits.createdAt,
      updatedAt: credits.updatedAt,
      categoryName: categories.name,
      categoryColor: categories.color,
    })
    .from(credits)
    .innerJoin(categories, eq(credits.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(desc(credits.createdAt));

  if (creditsList.length === 0) {
    return [];
  }

  // Obtener cuotas pagadas por crédito
  const paidByCredit = await db
    .select({
      creditId: transactions.creditId,
      paidCount: sql<number>`COUNT(*)`,
      paidAmount: sql<string>`SUM(${transactions.baseAmount})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.projectId, projectId),
        isNotNull(transactions.creditId),
        eq(transactions.isPaid, true)
      )
    )
    .groupBy(transactions.creditId);

  // Crear mapa de cuotas pagadas
  const paidMap = new Map<string, { count: number; amount: number }>();
  for (const row of paidByCredit) {
    if (row.creditId) {
      paidMap.set(row.creditId, {
        count: Number(row.paidCount),
        amount: parseFloat(row.paidAmount ?? '0'),
      });
    }
  }

  // Combinar créditos con progreso
  return creditsList.map((credit) => {
    const paid = paidMap.get(credit.id) ?? { count: 0, amount: 0 };
    const totalAmount = parseFloat(credit.baseTotalAmount);
    const installmentAmount = parseFloat(credit.installmentAmount);

    const paidInstallments = paid.count;
    const remainingInstallments = credit.installments - paidInstallments;
    const paidAmount = paid.amount;
    const remainingAmount = totalAmount - paidAmount;
    const progressPercentage = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

    const nextPaymentDate =
      remainingInstallments > 0
        ? calculateNextPaymentDate(credit.startDate, credit.frequency, paidInstallments)
        : null;

    return {
      ...credit,
      paidInstallments,
      remainingInstallments,
      paidAmount,
      remainingAmount: Math.max(0, remainingAmount),
      progressPercentage,
      nextPaymentDate,
    };
  });
}

/**
 * Obtiene un crédito por ID con progreso
 */
export async function getCreditById(
  creditId: string,
  userId: string
): Promise<CreditWithProgress | null> {
  const result = await db
    .select({
      id: credits.id,
      userId: credits.userId,
      projectId: credits.projectId,
      categoryId: credits.categoryId,
      name: credits.name,
      originalPrincipalAmount: credits.originalPrincipalAmount,
      originalTotalAmount: credits.originalTotalAmount,
      originalCurrency: credits.originalCurrency,
      originalCurrencyId: credits.originalCurrencyId,
      basePrincipalAmount: credits.basePrincipalAmount,
      baseTotalAmount: credits.baseTotalAmount,
      baseCurrency: credits.baseCurrency,
      baseCurrencyId: credits.baseCurrencyId,
      exchangeRate: credits.exchangeRate,
      installments: credits.installments,
      installmentAmount: credits.installmentAmount,
      startDate: credits.startDate,
      endDate: credits.endDate,
      frequency: credits.frequency,
      description: credits.description,
      notes: credits.notes,
      isArchived: credits.isArchived,
      createdAt: credits.createdAt,
      updatedAt: credits.updatedAt,
      categoryName: categories.name,
      categoryColor: categories.color,
    })
    .from(credits)
    .innerJoin(categories, eq(credits.categoryId, categories.id))
    .innerJoin(projectMembers, eq(credits.projectId, projectMembers.projectId))
    .where(
      and(
        eq(credits.id, creditId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!result[0]) {
    return null;
  }

  const credit = result[0];

  // Obtener cuotas pagadas
  const paidResult = await db
    .select({
      paidCount: sql<number>`COUNT(*)`,
      paidAmount: sql<string>`SUM(${transactions.baseAmount})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.creditId, creditId),
        eq(transactions.isPaid, true)
      )
    );

  const paid = paidResult[0];
  const totalAmount = parseFloat(credit.baseTotalAmount);

  const paidInstallments = Number(paid?.paidCount ?? 0);
  const remainingInstallments = credit.installments - paidInstallments;
  const paidAmount = parseFloat(paid?.paidAmount ?? '0');
  const remainingAmount = totalAmount - paidAmount;
  const progressPercentage = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

  const nextPaymentDate =
    remainingInstallments > 0
      ? calculateNextPaymentDate(credit.startDate, credit.frequency, paidInstallments)
      : null;

  return {
    ...credit,
    paidInstallments,
    remainingInstallments,
    paidAmount,
    remainingAmount: Math.max(0, remainingAmount),
    progressPercentage,
    nextPaymentDate,
  };
}

/**
 * Obtiene resumen de créditos del proyecto
 */
export async function getCreditsSummary(
  projectId: string,
  userId: string
): Promise<CreditSummary> {
  const creditsWithProgress = await getCreditsWithProgress(projectId, userId, false);

  let totalDebt = 0;
  let totalPaid = 0;
  let monthlyPayment = 0;

  for (const credit of creditsWithProgress) {
    totalDebt += parseFloat(credit.baseTotalAmount);
    totalPaid += credit.paidAmount;

    // Solo sumar cuota mensual si hay cuotas pendientes
    if (credit.remainingInstallments > 0 && credit.frequency === 'monthly') {
      monthlyPayment += parseFloat(credit.installmentAmount);
    }
  }

  return {
    totalCredits: creditsWithProgress.length,
    activeCredits: creditsWithProgress.filter((c) => c.remainingInstallments > 0).length,
    totalDebt,
    totalPaid,
    totalRemaining: totalDebt - totalPaid,
    monthlyPayment,
  };
}
