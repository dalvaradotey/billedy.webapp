'use server';

import { db } from '@/lib/db';
import {
  billingCycles,
  projectMembers,
  transactions,
  savingsMovements,
  savingsFunds,
  templates,
  templateItems,
  credits,
  projects,
  currencies,
} from '@/lib/db/schema';
import { eq, and, isNotNull, gte, lte, sql, lt } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  createBillingCycleSchema,
  updateBillingCycleSchema,
  closeBillingCycleSchema,
  type CreateBillingCycleInput,
  type UpdateBillingCycleInput,
  type CloseBillingCycleInput,
} from './schemas';

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Verifica que el usuario tenga acceso al proyecto
 */
async function verifyProjectAccess(projectId: string, userId: string): Promise<boolean> {
  const member = await db
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

  return member.length > 0;
}

/**
 * Calcula totales de transacciones para un rango de fechas
 */
async function calculateTotalsForRange(
  projectId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  income: number;
  expenses: number;
  savings: number;
  balance: number;
}> {
  const transactionTotals = await db
    .select({
      totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.baseAmount} ELSE 0 END), 0)`,
      totalExpenses: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.baseAmount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.projectId, projectId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    );

  const savingsTotals = await db
    .select({
      totalSavings: sql<string>`COALESCE(SUM(CASE WHEN ${savingsMovements.type} = 'deposit' THEN ${savingsMovements.amount} ELSE 0 END), 0)`,
    })
    .from(savingsMovements)
    .innerJoin(savingsFunds, eq(savingsMovements.savingsFundId, savingsFunds.id))
    .where(
      and(
        eq(savingsFunds.projectId, projectId),
        gte(savingsMovements.date, startDate),
        lte(savingsMovements.date, endDate)
      )
    );

  const income = parseFloat(transactionTotals[0]?.totalIncome ?? '0');
  const expenses = parseFloat(transactionTotals[0]?.totalExpenses ?? '0');
  const savings = parseFloat(savingsTotals[0]?.totalSavings ?? '0');
  const balance = income - expenses - savings;

  return { income, expenses, savings, balance };
}

/**
 * Carga transacciones automáticas al crear un ciclo:
 * - Items de plantillas activas
 * - Cuotas de créditos que caigan en el rango
 * - Cuotas de compras en cuotas que caigan en el rango
 */
async function loadCycleTransactions(
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

  const baseCurrency = projectInfo.currencyCode;
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
    .where(
      and(
        eq(credits.projectId, projectId),
        eq(credits.isArchived, false)
      )
    );

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

/**
 * Crea un nuevo ciclo de facturación
 */
export async function createBillingCycle(
  userId: string,
  input: CreateBillingCycleInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = createBillingCycleSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  const hasAccess = await verifyProjectAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  // Verificar que no haya un ciclo abierto que se solape
  const overlapping = await db
    .select({ id: billingCycles.id })
    .from(billingCycles)
    .where(
      and(
        eq(billingCycles.projectId, parsed.data.projectId),
        eq(billingCycles.status, 'open')
      )
    )
    .limit(1);

  if (overlapping.length > 0) {
    return { success: false, error: 'Ya existe un ciclo abierto. Ciérralo antes de crear uno nuevo.' };
  }

  const [newCycle] = await db
    .insert(billingCycles)
    .values({
      projectId: parsed.data.projectId,
      name: parsed.data.name,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      notes: parsed.data.notes,
      status: 'open',
    })
    .returning({ id: billingCycles.id });

  // Cargar transacciones automáticas al crear el ciclo
  await loadCycleTransactions(
    parsed.data.projectId,
    userId,
    parsed.data.startDate,
    parsed.data.endDate
  );

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/cycles');
  revalidatePath('/dashboard/transactions');

  return { success: true, data: { id: newCycle.id } };
}

/**
 * Actualiza un ciclo de facturación
 */
export async function updateBillingCycle(
  cycleId: string,
  userId: string,
  input: UpdateBillingCycleInput
): Promise<ActionResult> {
  const parsed = updateBillingCycleSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar que el ciclo existe y el usuario tiene acceso
  const existing = await db
    .select({
      id: billingCycles.id,
      projectId: billingCycles.projectId,
      status: billingCycles.status,
    })
    .from(billingCycles)
    .innerJoin(projectMembers, eq(billingCycles.projectId, projectMembers.projectId))
    .where(
      and(
        eq(billingCycles.id, cycleId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Ciclo no encontrado' };
  }

  if (existing[0].status === 'closed') {
    return { success: false, error: 'No se puede editar un ciclo cerrado' };
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.startDate !== undefined) updateData.startDate = parsed.data.startDate;
  if (parsed.data.endDate !== undefined) updateData.endDate = parsed.data.endDate;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

  await db.update(billingCycles).set(updateData).where(eq(billingCycles.id, cycleId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/cycles');

  return { success: true, data: undefined };
}

/**
 * Cierra un ciclo de facturación y guarda el snapshot
 * Permite ajustar la fecha de fin al momento de cerrar
 */
export async function closeBillingCycle(
  cycleId: string,
  userId: string,
  input?: CloseBillingCycleInput
): Promise<ActionResult> {
  // Validar input si existe
  if (input) {
    const parsed = closeBillingCycleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
    }
  }

  // Verificar que el ciclo existe y el usuario tiene acceso
  const existing = await db
    .select({
      id: billingCycles.id,
      projectId: billingCycles.projectId,
      status: billingCycles.status,
      startDate: billingCycles.startDate,
      endDate: billingCycles.endDate,
    })
    .from(billingCycles)
    .innerJoin(projectMembers, eq(billingCycles.projectId, projectMembers.projectId))
    .where(
      and(
        eq(billingCycles.id, cycleId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Ciclo no encontrado' };
  }

  if (existing[0].status === 'closed') {
    return { success: false, error: 'El ciclo ya está cerrado' };
  }

  // Usar la fecha de fin proporcionada o la existente
  const finalEndDate = input?.endDate ?? new Date(existing[0].endDate);
  const startDate = new Date(existing[0].startDate);

  // Validar que endDate >= startDate
  if (finalEndDate < startDate) {
    return { success: false, error: 'La fecha de fin debe ser posterior a la fecha de inicio' };
  }

  // Calcular totales usando el rango de fechas final
  const totals = await calculateTotalsForRange(
    existing[0].projectId,
    startDate,
    finalEndDate
  );

  // Cerrar el ciclo con el snapshot
  await db
    .update(billingCycles)
    .set({
      status: 'closed',
      endDate: finalEndDate,
      snapshotIncome: String(totals.income),
      snapshotExpenses: String(totals.expenses),
      snapshotSavings: String(totals.savings),
      snapshotBalance: String(totals.balance),
      updatedAt: new Date(),
    })
    .where(eq(billingCycles.id, cycleId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/cycles');

  return { success: true, data: undefined };
}

/**
 * Reabre un ciclo cerrado (borra el snapshot)
 */
export async function reopenBillingCycle(
  cycleId: string,
  userId: string
): Promise<ActionResult> {
  const existing = await db
    .select({
      id: billingCycles.id,
      projectId: billingCycles.projectId,
      status: billingCycles.status,
    })
    .from(billingCycles)
    .innerJoin(projectMembers, eq(billingCycles.projectId, projectMembers.projectId))
    .where(
      and(
        eq(billingCycles.id, cycleId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Ciclo no encontrado' };
  }

  if (existing[0].status === 'open') {
    return { success: false, error: 'El ciclo ya está abierto' };
  }

  // Verificar que no haya otro ciclo abierto
  const openCycle = await db
    .select({ id: billingCycles.id })
    .from(billingCycles)
    .where(
      and(
        eq(billingCycles.projectId, existing[0].projectId),
        eq(billingCycles.status, 'open')
      )
    )
    .limit(1);

  if (openCycle.length > 0) {
    return { success: false, error: 'Ya hay un ciclo abierto. Ciérralo antes de reabrir este.' };
  }

  await db
    .update(billingCycles)
    .set({
      status: 'open',
      snapshotIncome: null,
      snapshotExpenses: null,
      snapshotSavings: null,
      snapshotBalance: null,
      updatedAt: new Date(),
    })
    .where(eq(billingCycles.id, cycleId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/cycles');

  return { success: true, data: undefined };
}

/**
 * Elimina un ciclo de facturación
 */
export async function deleteBillingCycle(
  cycleId: string,
  userId: string
): Promise<ActionResult> {
  const existing = await db
    .select({
      id: billingCycles.id,
      projectId: billingCycles.projectId,
    })
    .from(billingCycles)
    .innerJoin(projectMembers, eq(billingCycles.projectId, projectMembers.projectId))
    .where(
      and(
        eq(billingCycles.id, cycleId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Ciclo no encontrado' };
  }

  await db.delete(billingCycles).where(eq(billingCycles.id, cycleId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/cycles');

  return { success: true, data: undefined };
}

/**
 * Recalcula el snapshot de un ciclo cerrado
 */
export async function recalculateSnapshot(
  cycleId: string,
  userId: string
): Promise<ActionResult> {
  const existing = await db
    .select({
      id: billingCycles.id,
      projectId: billingCycles.projectId,
      status: billingCycles.status,
      startDate: billingCycles.startDate,
      endDate: billingCycles.endDate,
    })
    .from(billingCycles)
    .innerJoin(projectMembers, eq(billingCycles.projectId, projectMembers.projectId))
    .where(
      and(
        eq(billingCycles.id, cycleId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Ciclo no encontrado' };
  }

  if (existing[0].status !== 'closed') {
    return { success: false, error: 'Solo se puede recalcular un ciclo cerrado' };
  }

  const totals = await calculateTotalsForRange(
    existing[0].projectId,
    new Date(existing[0].startDate),
    new Date(existing[0].endDate)
  );

  await db
    .update(billingCycles)
    .set({
      snapshotIncome: String(totals.income),
      snapshotExpenses: String(totals.expenses),
      snapshotSavings: String(totals.savings),
      snapshotBalance: String(totals.balance),
      updatedAt: new Date(),
    })
    .where(eq(billingCycles.id, cycleId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/cycles');

  return { success: true, data: undefined };
}
