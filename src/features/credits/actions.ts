'use server';

import { db } from '@/lib/db';
import { credits, transactions, projects, projectMembers } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { createCreditSchema, updateCreditSchema } from './schemas';
import type { CreateCreditInput, UpdateCreditInput } from './schemas';

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
 * Calcula la fecha de fin basada en la frecuencia y número de cuotas
 */
function calculateEndDate(
  startDate: Date,
  frequency: 'monthly' | 'biweekly' | 'weekly',
  installments: number
): Date {
  const endDate = new Date(startDate);

  switch (frequency) {
    case 'monthly':
      endDate.setMonth(endDate.getMonth() + installments);
      break;
    case 'biweekly':
      endDate.setDate(endDate.getDate() + installments * 14);
      break;
    case 'weekly':
      endDate.setDate(endDate.getDate() + installments * 7);
      break;
  }

  return endDate;
}

/**
 * Crea un nuevo crédito
 */
export async function createCredit(
  userId: string,
  input: CreateCreditInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = createCreditSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Validar que cuotas pagadas no excedan el total
  const paidInstallmentsCount = parsed.data.paidInstallments ?? 0;
  if (paidInstallmentsCount > parsed.data.installments) {
    return { success: false, error: 'Las cuotas pagadas no pueden ser mayores al total de cuotas' };
  }

  // Verificar acceso al proyecto
  const hasAccess = await verifyProjectAccess(parsed.data.projectId, userId);
  if (!hasAccess) {
    return { success: false, error: 'No tienes acceso a este proyecto' };
  }

  // Obtener la moneda base del proyecto
  const project = await db
    .select({
      baseCurrencyId: projects.baseCurrencyId,
      currency: projects.currency,
    })
    .from(projects)
    .where(eq(projects.id, parsed.data.projectId))
    .limit(1);

  if (!project[0]) {
    return { success: false, error: 'Proyecto no encontrado' };
  }

  // Calcular monto total = cuota × número de cuotas
  const principalAmount = String(parsed.data.principalAmount);
  const installmentAmount = String(parsed.data.installmentAmount);
  const totalAmount = String(parsed.data.installmentAmount * parsed.data.installments);

  const endDate = calculateEndDate(
    parsed.data.startDate,
    parsed.data.frequency,
    parsed.data.installments
  );

  const [newCredit] = await db
    .insert(credits)
    .values({
      userId,
      projectId: parsed.data.projectId,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      originalPrincipalAmount: principalAmount,
      originalTotalAmount: totalAmount,
      originalCurrency: project[0].currency,
      originalCurrencyId: project[0].baseCurrencyId,
      basePrincipalAmount: principalAmount,
      baseTotalAmount: totalAmount,
      baseCurrency: project[0].currency,
      baseCurrencyId: project[0].baseCurrencyId,
      exchangeRate: '1',
      installments: parsed.data.installments,
      installmentAmount,
      startDate: parsed.data.startDate,
      endDate,
      frequency: parsed.data.frequency,
      description: parsed.data.description,
      notes: parsed.data.notes,
    })
    .returning({ id: credits.id });

  // Si hay cuotas ya pagadas, generar las transacciones correspondientes
  const paidInstallments = parsed.data.paidInstallments ?? 0;
  if (paidInstallments > 0) {
    const paidTransactions = [];
    const now = new Date();

    for (let i = 0; i < paidInstallments; i++) {
      const paymentDate = new Date(parsed.data.startDate);
      switch (parsed.data.frequency) {
        case 'monthly':
          paymentDate.setMonth(paymentDate.getMonth() + i);
          break;
        case 'biweekly':
          paymentDate.setDate(paymentDate.getDate() + i * 14);
          break;
        case 'weekly':
          paymentDate.setDate(paymentDate.getDate() + i * 7);
          break;
      }

      paidTransactions.push({
        userId,
        projectId: parsed.data.projectId,
        categoryId: parsed.data.categoryId,
        creditId: newCredit.id,
        type: 'expense' as const,
        description: `${parsed.data.name} - Cuota ${i + 1}/${parsed.data.installments}`,
        originalAmount: installmentAmount,
        originalCurrency: project[0].currency,
        originalCurrencyId: project[0].baseCurrencyId,
        baseAmount: installmentAmount,
        baseCurrency: project[0].currency,
        baseCurrencyId: project[0].baseCurrencyId,
        exchangeRate: '1',
        date: paymentDate,
        isPaid: true,
        paidAt: now,
      });
    }

    await db.insert(transactions).values(paidTransactions);
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/credits');
  revalidatePath('/dashboard/transactions');

  return { success: true, data: { id: newCredit.id } };
}

/**
 * Actualiza un crédito existente
 */
export async function updateCredit(
  creditId: string,
  userId: string,
  input: UpdateCreditInput
): Promise<ActionResult> {
  const parsed = updateCreditSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  // Verificar que el crédito existe y el usuario tiene acceso
  const existing = await db
    .select({ projectId: credits.projectId })
    .from(credits)
    .innerJoin(projectMembers, eq(credits.projectId, projectMembers.projectId))
    .where(
      and(
        eq(credits.id, creditId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Crédito no encontrado' };
  }

  await db
    .update(credits)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(credits.id, creditId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/credits');

  return { success: true, data: undefined };
}

/**
 * Archiva o restaura un crédito
 */
export async function archiveCredit(
  creditId: string,
  userId: string,
  isArchived: boolean
): Promise<ActionResult> {
  // Verificar acceso
  const existing = await db
    .select({ projectId: credits.projectId })
    .from(credits)
    .innerJoin(projectMembers, eq(credits.projectId, projectMembers.projectId))
    .where(
      and(
        eq(credits.id, creditId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Crédito no encontrado' };
  }

  await db
    .update(credits)
    .set({
      isArchived,
      updatedAt: new Date(),
    })
    .where(eq(credits.id, creditId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/credits');

  return { success: true, data: undefined };
}

/**
 * Elimina un crédito y todas sus transacciones (cuotas) asociadas
 */
export async function deleteCredit(
  creditId: string,
  userId: string
): Promise<ActionResult> {
  // Verificar acceso
  const existing = await db
    .select({ projectId: credits.projectId })
    .from(credits)
    .innerJoin(projectMembers, eq(credits.projectId, projectMembers.projectId))
    .where(
      and(
        eq(credits.id, creditId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!existing[0]) {
    return { success: false, error: 'Crédito no encontrado' };
  }

  // Primero eliminar las transacciones asociadas (cuotas)
  await db.delete(transactions).where(eq(transactions.creditId, creditId));

  // Luego eliminar el crédito
  await db.delete(credits).where(eq(credits.id, creditId));

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/credits');
  revalidatePath('/dashboard/transactions');

  return { success: true, data: undefined };
}

/**
 * Genera la transacción de la próxima cuota de un crédito
 */
export async function generateCreditInstallment(
  creditId: string,
  userId: string
): Promise<ActionResult<{ transactionId: string }>> {
  // Obtener crédito con verificación de acceso
  const creditResult = await db
    .select({
      id: credits.id,
      projectId: credits.projectId,
      categoryId: credits.categoryId,
      name: credits.name,
      installmentAmount: credits.installmentAmount,
      baseCurrency: credits.baseCurrency,
      baseCurrencyId: credits.baseCurrencyId,
      frequency: credits.frequency,
      startDate: credits.startDate,
      installments: credits.installments,
    })
    .from(credits)
    .innerJoin(projectMembers, eq(credits.projectId, projectMembers.projectId))
    .where(
      and(
        eq(credits.id, creditId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!creditResult[0]) {
    return { success: false, error: 'Crédito no encontrado' };
  }

  const credit = creditResult[0];

  // Contar cuotas ya generadas
  const paidResult = await db
    .select({
      count: db.$count(transactions, eq(transactions.creditId, creditId)),
    })
    .from(transactions)
    .where(eq(transactions.creditId, creditId));

  const paidCount = paidResult[0]?.count ?? 0;

  if (paidCount >= credit.installments) {
    return { success: false, error: 'El crédito ya tiene todas las cuotas generadas' };
  }

  // Calcular fecha de la siguiente cuota
  const nextPaymentDate = new Date(credit.startDate);
  switch (credit.frequency) {
    case 'monthly':
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + paidCount);
      break;
    case 'biweekly':
      nextPaymentDate.setDate(nextPaymentDate.getDate() + paidCount * 14);
      break;
    case 'weekly':
      nextPaymentDate.setDate(nextPaymentDate.getDate() + paidCount * 7);
      break;
  }

  // Crear transacción para la cuota
  const [newTransaction] = await db
    .insert(transactions)
    .values({
      userId,
      projectId: credit.projectId,
      categoryId: credit.categoryId,
      creditId: credit.id,
      type: 'expense',
      description: `${credit.name} - Cuota ${paidCount + 1}/${credit.installments}`,
      originalAmount: credit.installmentAmount,
      originalCurrency: credit.baseCurrency,
      originalCurrencyId: credit.baseCurrencyId,
      baseAmount: credit.installmentAmount,
      baseCurrency: credit.baseCurrency,
      baseCurrencyId: credit.baseCurrencyId,
      exchangeRate: '1',
      date: nextPaymentDate,
      isPaid: false,
    })
    .returning({ id: transactions.id });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/credits');
  revalidatePath('/dashboard/transactions');

  return { success: true, data: { transactionId: newTransaction.id } };
}

/**
 * Genera todas las cuotas pendientes de un crédito
 */
export async function generateAllCreditInstallments(
  creditId: string,
  userId: string
): Promise<ActionResult<{ count: number }>> {
  // Obtener crédito con verificación de acceso
  const creditResult = await db
    .select({
      id: credits.id,
      projectId: credits.projectId,
      categoryId: credits.categoryId,
      name: credits.name,
      installmentAmount: credits.installmentAmount,
      baseCurrency: credits.baseCurrency,
      baseCurrencyId: credits.baseCurrencyId,
      frequency: credits.frequency,
      startDate: credits.startDate,
      installments: credits.installments,
    })
    .from(credits)
    .innerJoin(projectMembers, eq(credits.projectId, projectMembers.projectId))
    .where(
      and(
        eq(credits.id, creditId),
        eq(projectMembers.userId, userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);

  if (!creditResult[0]) {
    return { success: false, error: 'Crédito no encontrado' };
  }

  const credit = creditResult[0];

  // Contar cuotas ya generadas
  const existingResult = await db
    .select({
      count: db.$count(transactions, eq(transactions.creditId, creditId)),
    })
    .from(transactions)
    .where(eq(transactions.creditId, creditId));

  const existingCount = existingResult[0]?.count ?? 0;

  if (existingCount >= credit.installments) {
    return { success: true, data: { count: 0 } };
  }

  // Generar todas las cuotas pendientes
  const installmentsToCreate = [];
  for (let i = existingCount; i < credit.installments; i++) {
    const paymentDate = new Date(credit.startDate);
    switch (credit.frequency) {
      case 'monthly':
        paymentDate.setMonth(paymentDate.getMonth() + i);
        break;
      case 'biweekly':
        paymentDate.setDate(paymentDate.getDate() + i * 14);
        break;
      case 'weekly':
        paymentDate.setDate(paymentDate.getDate() + i * 7);
        break;
    }

    installmentsToCreate.push({
      userId,
      projectId: credit.projectId,
      categoryId: credit.categoryId,
      creditId: credit.id,
      type: 'expense' as const,
      description: `${credit.name} - Cuota ${i + 1}/${credit.installments}`,
      originalAmount: credit.installmentAmount,
      originalCurrency: credit.baseCurrency,
      originalCurrencyId: credit.baseCurrencyId,
      baseAmount: credit.installmentAmount,
      baseCurrency: credit.baseCurrency,
      baseCurrencyId: credit.baseCurrencyId,
      exchangeRate: '1',
      date: paymentDate,
      isPaid: false,
    });
  }

  if (installmentsToCreate.length > 0) {
    await db.insert(transactions).values(installmentsToCreate);
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/credits');
  revalidatePath('/dashboard/transactions');

  return { success: true, data: { count: installmentsToCreate.length } };
}
