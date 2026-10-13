'use server';

import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts, cardStatements, merchantAliases, templateItems, transactions } from '@/lib/db/schema';
import { invalidateRelatedCache } from '@/lib/cache';
import { isSessionUser, UNAUTHORIZED_ERROR } from '@/lib/auth/guards';
import { verifyProjectAccess } from '@/features/transactions/lib/access';
import { insertTransaction } from '@/features/transactions/lib/write-transaction';
import { updateTransaction } from '@/features/transactions/actions/transaction-crud';
import { normalizeNature, type TransactionNature } from '@/features/transactions/nature';
import { pdfToLines } from './lib/pdf-lines';
import { parseSantanderStatement, type ParsedStatement, type StatementLine } from './lib/parse-santander';
import { matchStatement, merchantKey, type Alias, type AppTransaction, type MatchResult } from './lib/match';

type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

const MAX_PDF_BYTES = 5 * 1024 * 1024;

export type StatementReview = {
  statementId: string;
  account: { id: string; name: string };
  statement: Omit<ParsedStatement, 'lines'> & { lineCount: number };
  alreadyReconciled: boolean;
  result: MatchResult;
};

const num = (v: unknown) => Math.round(Number(v ?? 0));

async function loadReview(
  projectId: string,
  accountId: string,
  statement: ParsedStatement
): Promise<MatchResult> {
  const [txRows, aliasRows, templateRows] = await Promise.all([
    db.execute(sql`
      select t.id, t.date::text as date, t.description, t.base_amount as amount, t.type::text as type,
        t.card_purchase_id is not null as is_installment, t.is_reconciled, t.budget_id, t.category_id,
        t.entity_id, t.nature::text as nature
      from n1n4_transactions t
      where t.project_id = ${projectId} and t.account_id = ${accountId}
        and t.linked_transaction_id is null
        and t.date between (${statement.periodStart}::date - 5) and (${statement.statementDate}::date + 25)`) as unknown as Promise<
      Record<string, unknown>[]
    >,
    db.select().from(merchantAliases).where(eq(merchantAliases.projectId, projectId)),
    db
      .select({ id: templateItems.id, description: templateItems.description, amount: templateItems.baseAmount })
      .from(templateItems)
      .where(and(eq(templateItems.projectId, projectId), eq(templateItems.accountId, accountId))),
  ]);

  const txs: AppTransaction[] = txRows.map((r) => ({
    id: String(r.id),
    date: String(r.date).slice(0, 10),
    description: String(r.description),
    amount: num(r.amount),
    type: r.type === 'income' ? 'income' : 'expense',
    isInstallment: Boolean(r.is_installment),
    isReconciled: Boolean(r.is_reconciled),
    budgetId: (r.budget_id as string) ?? null,
    categoryId: (r.category_id as string) ?? null,
    entityId: (r.entity_id as string) ?? null,
    nature: String(r.nature),
  }));
  const aliases: Alias[] = aliasRows.map((a) => ({
    key: a.key,
    description: a.description,
    budgetId: a.budgetId,
    categoryId: a.categoryId,
    entityId: a.entityId,
    nature: a.nature,
  }));
  return matchStatement(
    statement,
    txs,
    aliases,
    templateRows.map((t) => ({ id: t.id, description: t.description, amount: num(t.amount) }))
  );
}

/**
 * Lee el PDF del estado de cuenta, lo guarda (solo lo extraído) y lo cruza con
 * los movimientos de la tarjeta. La tarjeta se reconoce por sus últimos 4
 * dígitos en el nombre de la cuenta.
 */
export async function analyzeStatement(
  userId: string,
  projectId: string,
  formData: FormData
): Promise<ActionResult<StatementReview>> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };
  if (!(await verifyProjectAccess(projectId, userId))) return { success: false, error: 'No tienes acceso a este proyecto' };

  const file = formData.get('file');
  if (!(file instanceof File)) return { success: false, error: 'Sube el PDF del estado de cuenta' };
  if (file.size > MAX_PDF_BYTES) return { success: false, error: 'El PDF es demasiado grande (máximo 5 MB)' };

  let parsed;
  try {
    parsed = parseSantanderStatement(await pdfToLines(new Uint8Array(await file.arrayBuffer())));
  } catch {
    return { success: false, error: 'No pude leer el PDF. ¿Es el estado de cuenta descargado del banco?' };
  }
  if (!parsed.ok) return { success: false, error: parsed.error };
  const statement = parsed.data;

  const cards = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(and(eq(accounts.projectId, projectId), eq(accounts.type, 'credit_card')));
  const account = cards.find((a) => a.name.includes(statement.card));
  if (!account) {
    return {
      success: false,
      error: `No encontré una tarjeta terminada en ${statement.card}. Agrega esos 4 dígitos al nombre de la cuenta.`,
    };
  }

  const [saved] = await db
    .insert(cardStatements)
    .values({
      projectId,
      accountId: account.id,
      statementDate: statement.statementDate,
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      dueDate: statement.dueDate,
      totalBilled: String(statement.totalBilled),
      minimumPayment: statement.minimumPayment != null ? String(statement.minimumPayment) : null,
      lines: statement.lines,
      createdBy: userId,
    })
    .onConflictDoUpdate({
      target: [cardStatements.accountId, cardStatements.statementDate],
      set: { lines: statement.lines, totalBilled: String(statement.totalBilled), updatedAt: new Date() },
    })
    .returning({ id: cardStatements.id, reconciledAt: cardStatements.reconciledAt });

  const result = await loadReview(projectId, account.id, statement);
  const { lines, ...header } = statement;

  return {
    success: true,
    data: {
      statementId: saved.id,
      account,
      statement: { ...header, lineCount: lines.length },
      alreadyReconciled: saved.reconciledAt != null,
      result,
    },
  };
}

export type ApplyReconciliationInput = {
  /** Movimientos que calzan (y los de monto corregido) a marcar como conciliados */
  reconcileIds: string[];
  /** Líneas que faltan en la app: se crean como gasto (o abono) pagado y conciliado */
  create: { lineIndex: number; description: string; budgetId: string | null; categoryId: string | null; nature: string }[];
  /** Corregir el monto de un movimiento al del estado de cuenta */
  amountFixes: { txId: string; amount: number }[];
  /** Actualizar el monto de un ítem de plantilla */
  templateUpdates: { itemId: string; amount: number }[];
};

/**
 * Aplica lo revisado: corrige montos, crea lo que falta, marca todo como
 * conciliado, actualiza la plantilla y aprende cómo registras cada comercio.
 */
export async function applyReconciliation(
  userId: string,
  statementId: string,
  input: ApplyReconciliationInput
): Promise<ActionResult<{ reconciled: number; created: number; fixed: number; templates: number }>> {
  if (!(await isSessionUser(userId))) return { success: false, error: UNAUTHORIZED_ERROR };

  const [statement] = await db.select().from(cardStatements).where(eq(cardStatements.id, statementId)).limit(1);
  if (!statement || !(await verifyProjectAccess(statement.projectId, userId))) {
    return { success: false, error: 'Estado de cuenta no encontrado' };
  }
  const lines = statement.lines as StatementLine[];
  const { projectId, accountId } = statement;

  // Solo movimientos de esta tarjeta y este proyecto
  const ownIds = async (ids: string[]) => {
    if (!ids.length) return new Set<string>();
    const rows = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(inArray(transactions.id, ids), eq(transactions.projectId, projectId), eq(transactions.accountId, accountId)));
    return new Set(rows.map((r) => r.id));
  };

  const allowed = await ownIds([...input.reconcileIds, ...input.amountFixes.map((f) => f.txId)]);

  let fixed = 0;
  for (const fix of input.amountFixes) {
    if (!allowed.has(fix.txId) || !(fix.amount > 0)) continue;
    const result = await updateTransaction(fix.txId, userId, { originalAmount: fix.amount });
    if (result.success) fixed++;
  }

  const createdIds: string[] = [];
  const learned: { key: string; description: string; budgetId: string | null; categoryId: string | null; entityId: string | null; nature: string }[] = [];
  for (const item of input.create) {
    const line = lines[item.lineIndex];
    if (!line || line.kind === 'installment' || line.kind === 'payment') continue;
    const type = line.amount < 0 ? 'income' : 'expense';
    const result = await insertTransaction(
      userId,
      {
        projectId,
        accountId,
        type,
        originalAmount: Math.abs(line.amount),
        date: new Date(`${line.date}T00:00:00Z`),
        description: item.description.trim() || line.description,
        budgetId: type === 'expense' ? item.budgetId : null,
        categoryId: item.categoryId,
        nature: normalizeNature(item.nature as TransactionNature, type),
        isPaid: true,
      },
      invalidateRelatedCache
    );
    if (result.success) {
      createdIds.push(result.data.id);
      learned.push({
        key: merchantKey(line.description),
        description: item.description.trim() || line.description,
        budgetId: item.budgetId,
        categoryId: item.categoryId,
        entityId: null,
        nature: item.nature,
      });
    }
  }

  const reconcileIds = [...input.reconcileIds.filter((id) => allowed.has(id)), ...createdIds];
  if (reconcileIds.length) {
    await db
      .update(transactions)
      .set({ isReconciled: true, updatedAt: new Date() })
      .where(and(inArray(transactions.id, reconcileIds), eq(transactions.projectId, projectId)));
  }

  let templates = 0;
  for (const update of input.templateUpdates) {
    if (!(update.amount > 0)) continue;
    const rows = await db
      .update(templateItems)
      .set({ originalAmount: String(update.amount), baseAmount: String(update.amount), updatedAt: new Date() })
      .where(and(eq(templateItems.id, update.itemId), eq(templateItems.projectId, projectId)))
      .returning({ id: templateItems.id });
    templates += rows.length;
  }

  // Aprender cómo registras cada comercio: de lo que calzó y de lo que creaste
  const review = await loadReview(projectId, accountId, {
    ...(statement as unknown as ParsedStatement),
    statementDate: String(statement.statementDate),
    periodStart: String(statement.periodStart),
    periodEnd: String(statement.periodEnd),
    lines,
  });
  for (const { line, tx } of review.matched) {
    if (line.kind !== 'purchase') continue;
    learned.push({
      key: merchantKey(line.description),
      description: tx.description,
      budgetId: tx.budgetId,
      categoryId: tx.categoryId,
      entityId: tx.entityId,
      nature: tx.nature,
    });
  }
  for (const alias of learned) {
    if (!alias.key) continue;
    await db
      .insert(merchantAliases)
      .values({ projectId, ...alias, nature: alias.nature as TransactionNature })
      .onConflictDoUpdate({
        target: [merchantAliases.projectId, merchantAliases.key],
        set: {
          description: alias.description,
          budgetId: alias.budgetId,
          categoryId: alias.categoryId,
          entityId: alias.entityId,
          nature: alias.nature as TransactionNature,
          times: sql`${merchantAliases.times} + 1`,
          updatedAt: new Date(),
        },
      });
  }

  await db.update(cardStatements).set({ reconciledAt: new Date(), updatedAt: new Date() }).where(eq(cardStatements.id, statementId));

  invalidateRelatedCache('transactions');
  if (templates) invalidateRelatedCache('templates');

  return { success: true, data: { reconciled: reconcileIds.length, created: createdIds.length, fixed, templates } };
}
