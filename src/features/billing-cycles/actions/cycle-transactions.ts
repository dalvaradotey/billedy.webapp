'use server';

import { db } from '@/lib/db';
import {
  transactions,
  templates,
  templateItems,
  credits,
  projects,
  currencies,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Carga transacciones automáticas al crear un ciclo:
 * - Items de plantillas activas
 * - Cuotas de créditos que caigan en el rango
 * - Cuotas de compras en cuotas que caigan en el rango
 */
export async function loadCycleTransactions(
  projectId: string,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<void> {
  // Obtener moneda del proyecto
  const [projectInfo] = await db
    .select({
      currencyCode: currencies.code,
    })
    .from(projects)
    .innerJoin(currencies, eq(projects.baseCurrencyId, currencies.id))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!projectInfo) return;

  const transactionsToInsert: Array<typeof transactions.$inferInsert> = [];

  // 1. Cargar items de plantillas activas
  const activeTemplateItems = await db
    .select({
      item: templateItems,
    })
    .from(templateItems)
    .innerJoin(templates, eq(templateItems.templateId, templates.id))
    .where(
      and(
        eq(templates.projectId, projectId),
        eq(templates.isActive, true),
        eq(templates.isArchived, false)
      )
    );

  for (const { item } of activeTemplateItems) {
    transactionsToInsert.push({
      userId: item.userId,
      projectId: item.projectId,
      categoryId: item.categoryId,
      accountId: item.accountId,
      entityId: item.entityId,
      type: item.type,
      description: item.description,
      originalAmount: item.originalAmount,
      originalCurrency: item.originalCurrency,
      baseAmount: item.baseAmount,
      baseCurrency: item.baseCurrency,
      exchangeRate: '1',
      date: startDate,
      notes: item.notes,
      isPaid: false,
    });
  }

  // 2. Generar cuotas de créditos activos
  const activeCredits = await db
    .select()
    .from(credits)
    .where(and(eq(credits.projectId, projectId), eq(credits.isArchived, false)));

  for (const credit of activeCredits) {
    // Calcular cuotas que caen en el rango del ciclo
    const creditStartDate = new Date(credit.startDate);
    const totalInstallments = credit.installments;

    // Contar cuotas ya generadas para este crédito
    const [existingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(eq(transactions.creditId, credit.id));

    const paidInstallments = existingCount?.count ?? 0;
    const remainingInstallments = totalInstallments - paidInstallments;

    if (remainingInstallments <= 0) continue;

    // Calcular fechas de las próximas cuotas según frecuencia
    for (let i = 0; i < remainingInstallments; i++) {
      const installmentNumber = paidInstallments + i + 1;
      const installmentDate = new Date(creditStartDate);

      // Calcular fecha según frecuencia
      if (credit.frequency === 'monthly') {
        installmentDate.setMonth(installmentDate.getMonth() + paidInstallments + i);
      } else if (credit.frequency === 'biweekly') {
        installmentDate.setDate(installmentDate.getDate() + (paidInstallments + i) * 14);
      } else if (credit.frequency === 'weekly') {
        installmentDate.setDate(installmentDate.getDate() + (paidInstallments + i) * 7);
      }

      // Verificar si la cuota cae dentro del rango del ciclo
      if (installmentDate >= startDate && installmentDate <= endDate) {
        transactionsToInsert.push({
          userId: credit.userId,
          projectId: credit.projectId,
          categoryId: credit.categoryId,
          accountId: credit.accountId,
          entityId: credit.entityId,
          type: 'expense',
          description: `${credit.name} - Cuota ${installmentNumber}/${totalInstallments}`,
          originalAmount: credit.installmentAmount,
          originalCurrency: credit.originalCurrency,
          baseAmount: credit.installmentAmount,
          baseCurrency: credit.baseCurrency,
          exchangeRate: credit.exchangeRate,
          date: installmentDate,
          notes: credit.notes,
          isPaid: false,
          creditId: credit.id,
        });
      }
    }
  }

  // NOTA: Las compras en cuotas (cardPurchases) ya no se procesan aquí.
  // Desde el rediseño, createCardPurchase crea TODAS las transacciones de cuotas
  // inmediatamente al registrar la compra, con isPaid=true para que afecten
  // el balance de la tarjeta de crédito de inmediato.

  // Insertar todas las transacciones
  if (transactionsToInsert.length > 0) {
    await db.insert(transactions).values(transactionsToInsert);
  }
}
