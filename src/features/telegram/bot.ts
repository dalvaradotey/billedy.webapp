import { and, asc, desc, eq, gt, gte, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts, budgets, entities, projectMembers, telegramDrafts, telegramLinks, transactions } from '@/lib/db/schema';
import { expireRelatedCache } from '@/lib/cache';
import { formatCurrency, getToday } from '@/lib/formatting';
import { insertTransaction, removeTransaction } from '@/features/transactions/lib/write-transaction';
import { getBillingCycles } from '@/features/billing-cycles/queries';
import { getCyclePlanStatus } from '@/features/billing-cycles/lib/cycle-plan';
import { answerCallback, editMessage, esc, sendMessage, type InlineKeyboard, type TelegramUpdate } from './api';
import { parseExpenseMessage, type ParseContext, type ParsedExpense } from './parser';

/**
 * Bot de Telegram: interpreta un mensaje como gasto, pide confirmación con
 * botones y lo guarda como el usuario vinculado a ese chat. Solo responde a
 * chats vinculados desde la app con un código de un solo uso.
 */

type Link = typeof telegramLinks.$inferSelect;

/** Un borrador pendiente vence a las 24 h; deshacer se permite durante 24 h */
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
/** Si el bot preguntó el detalle, el siguiente mensaje sin monto se toma como respuesta */
const DETAIL_WAIT_MS = 30 * 60 * 1000;

/**
 * Borrador con el paso de la conversación:
 * - detail: solo vino el monto, se pregunta "¿qué fue?"
 * - budget: vino el detalle pero no el presupuesto, se ofrece elegirlo
 * - confirm: resumen con Guardar
 */
type DraftPayload = ParsedExpense & {
  step?: 'detail' | 'budget' | 'confirm';
  /** Ya se preguntó el presupuesto (aunque se haya elegido "Sin presupuesto") */
  budgetAsked?: boolean;
  /** Mensaje con la pregunta del detalle, para quitarle los botones al responder */
  promptMessageId?: number;
};

const nextStep = (d: DraftPayload): NonNullable<DraftPayload['step']> =>
  !d.hasDetail && !d.budgetId && d.step !== 'budget' && !d.budgetAsked
    ? 'detail'
    : d.type === 'expense' && !d.budgetId && !d.budgetAsked
      ? 'budget'
      : 'confirm';

const budgetKeyboard = (draftId: string, ctx: ParseContext, extra: InlineKeyboard): InlineKeyboard => {
  const options = [
    ...ctx.budgets.map((b, i) => ({ text: b.name, callback_data: `sb:${draftId}:${i}` })),
    { text: 'Sin presupuesto', callback_data: `sb:${draftId}:-1` },
  ];
  const rows: InlineKeyboard = [];
  for (let i = 0; i < options.length; i += 2) rows.push(options.slice(i, i + 2));
  return [...rows, ...extra];
};

/** Texto y botones del paso actual del borrador */
function stepView(draftId: string, d: DraftPayload, ctx: ParseContext): { text: string; keyboard: InlineKeyboard } {
  const step = nextStep(d);
  if (step === 'detail') {
    return {
      text: `<b>${d.type === 'income' ? '+' : '−'}${formatCurrency(d.amount)}</b> · ¿Qué fue?\nEscríbeme el detalle, por ejemplo <code>lider</code> o <code>almuerzo</code>. También puedes agregar el presupuesto.`,
      keyboard: [[
        { text: 'Sin detalle', callback_data: `nd:${draftId}` },
        { text: '✖️ Cancelar', callback_data: `c:${draftId}` },
      ]],
    };
  }
  if (step === 'budget') {
    return {
      text: `${summary(d, ctx)}\n\n¿Lo asocio a un presupuesto?`,
      keyboard: budgetKeyboard(draftId, ctx, [[{ text: '✖️ Cancelar', callback_data: `c:${draftId}` }]]),
    };
  }
  return { text: summary(d, ctx), keyboard: confirmKeyboard(draftId, d.type) };
}

/** Borrador que espera el detalle (el último, si no venció) */
async function findAwaitingDetail(linkId: string) {
  const [draft] = await db
    .select()
    .from(telegramDrafts)
    .where(
      and(
        eq(telegramDrafts.linkId, linkId),
        eq(telegramDrafts.status, 'pending'),
        gte(telegramDrafts.createdAt, new Date(Date.now() - DETAIL_WAIT_MS)),
        sql`${telegramDrafts.payload}->>'step' = 'detail'`
      )
    )
    .orderBy(desc(telegramDrafts.createdAt))
    .limit(1);
  return draft ?? null;
}

const HELP = [
  '<b>Cómo registrar un gasto</b>',
  'Escribe el monto y lo demás en cualquier orden:',
  '',
  '<code>15990 lider compras casa</code>',
  '<code>8.500 copec movilización débito</code>',
  '<code>12 lucas almuerzo ayer</code>',
  '<code>+150000 aporte anais</code> (ingreso)',
  '',
  'Reconozco tus tiendas, presupuestos (también por iniciales, como <code>gp</code>) y cuentas (<code>débito</code>, <code>tc</code>, <code>santander</code>). Antes de guardar te muestro el resumen para confirmar.',
  '',
  '/techo · disponible en la tarjeta',
  '/hoy · lo registrado hoy',
  '/deshacer · borra el último que guardaste',
].join('\n');

async function getLinkByChat(chatId: number): Promise<Link | null> {
  const [link] = await db.select().from(telegramLinks).where(eq(telegramLinks.chatId, chatId)).limit(1);
  if (!link) return null;
  // El vínculo vale mientras el usuario siga siendo miembro del proyecto
  const [member] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, link.projectId),
        eq(projectMembers.userId, link.userId),
        isNotNull(projectMembers.acceptedAt)
      )
    )
    .limit(1);
  return member ? link : null;
}

/** Fechas como texto: el driver no serializa Date dentro de sql`` */
const isoDate = (d: Date | string) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

export async function loadContext(projectId: string): Promise<ParseContext> {
  const today = getToday();
  const todayIso = isoDate(today);
  const [budgetRows, accountRows, entityRows, previousRows] = await Promise.all([
    db
      .select({ id: budgets.id, name: budgets.name, categoryId: budgets.categoryId, defaultAccountId: budgets.defaultAccountId })
      .from(budgets)
      .where(
        and(
          eq(budgets.projectId, projectId),
          eq(budgets.isActive, true),
          sql`(${budgets.startDate} is null or (${budgets.startDate} <= ${todayIso}::date and ${budgets.endDate} >= ${todayIso}::date))`
        )
      )
      // Orden estable: los botones de elegir presupuesto o cuenta usan la posición
      .orderBy(asc(budgets.sortOrder), asc(budgets.name), asc(budgets.id)),
    db
      .select({
        id: accounts.id,
        name: accounts.name,
        type: accounts.type,
        isDefault: accounts.isDefault,
        usage: sql<number>`(select count(*) from n1n4_transactions t where t.account_id = ${accounts.id} and t.date > now() - interval '90 days')::int`,
      })
      .from(accounts)
      .where(and(eq(accounts.projectId, projectId), eq(accounts.isArchived, false)))
      .orderBy(desc(accounts.isDefault), asc(accounts.name), asc(accounts.id)),
    db.select({ id: entities.id, name: entities.name }).from(entities).where(eq(entities.isActive, true)),
    db.execute(sql`
      select distinct on (lower(description)) description, budget_id, category_id, account_id
      from n1n4_transactions
      where project_id = ${projectId} and linked_transaction_id is null
      order by lower(description), date desc`) as unknown as Promise<Record<string, string | null>[]>,
  ]);

  return {
    budgets: budgetRows,
    accounts: accountRows.map((a) => ({ ...a, type: String(a.type), usage: Number(a.usage) })),
    entities: entityRows,
    previous: previousRows.map((r) => ({
      description: String(r.description),
      budgetId: r.budget_id,
      categoryId: r.category_id,
      accountId: r.account_id,
    })),
    today,
  };
}

const shortDate = (iso: string) => {
  const today = getToday().toISOString().slice(0, 10);
  if (iso === today) return 'hoy';
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
};

function summary(data: ParsedExpense, ctx: ParseContext): string {
  const account = ctx.accounts.find((a) => a.id === data.accountId);
  const budget = ctx.budgets.find((b) => b.id === data.budgetId);
  const sign = data.type === 'income' ? '+' : '−';
  return [
    `<b>${sign}${formatCurrency(data.amount)}</b> · ${esc(data.description)}`,
    `${data.type === 'income' ? 'Ingreso' : budget ? esc(budget.name) : 'Sin presupuesto'} · ${esc(account?.name ?? '—')} · ${shortDate(data.date)}`,
  ].join('\n');
}

const confirmKeyboard = (draftId: string, type: ParsedExpense['type']): InlineKeyboard => [
  [{ text: '✅ Guardar', callback_data: `s:${draftId}` }],
  [
    { text: '💳 Cuenta', callback_data: `a:${draftId}` },
    ...(type === 'expense' ? [{ text: '📂 Presupuesto', callback_data: `b:${draftId}` }] : []),
    { text: '✖️ Cancelar', callback_data: `c:${draftId}` },
  ],
];

/** Lo que queda en el presupuesto y en el techo después de guardar */
async function afterSaveNote(link: Link, data: ParsedExpense, ctx: ParseContext): Promise<string> {
  if (data.type !== 'expense') return '';
  const cycles = await getBillingCycles(link.projectId, link.userId);
  const open = cycles.find((c) => c.status === 'open');
  if (!open) return '';
  const lines: string[] = [];

  if (data.budgetId) {
    const [row] = (await db.execute(sql`
      select b.name, b.default_amount,
        coalesce((
          select sum(t.base_amount) from n1n4_transactions t
          where t.budget_id = b.id and t.type = 'expense'
            and t.date >= coalesce(b.start_date, ${isoDate(open.startDate)}::date)
            and t.date <= coalesce(b.end_date, ${isoDate(open.endDate)}::date)
        ), 0) as spent
      from n1n4_budgets b where b.id = ${data.budgetId}`)) as unknown as Record<string, string>[];
    if (row) {
      const left = Number(row.default_amount) - Number(row.spent);
      lines.push(
        left >= 0
          ? `Quedan ${formatCurrency(left)} en ${esc(row.name)}`
          : `Te pasaste ${formatCurrency(-left)} en ${esc(row.name)}`
      );
    }
  }

  const account = ctx.accounts.find((a) => a.id === data.accountId);
  if (account?.type === 'credit_card') {
    const plan = await getCyclePlanStatus(open);
    lines.push(
      plan.card.available >= 0
        ? `${formatCurrency(plan.card.available)} disponibles en el techo`
        : `Pasaste el techo por ${formatCurrency(-plan.card.available)}`
    );
  }
  return lines.length ? `\n\n${lines.join(' · ')}` : '';
}

async function handleLink(chatId: number, code: string) {
  const [link] = await db
    .select()
    .from(telegramLinks)
    .where(and(eq(telegramLinks.linkCode, code.toUpperCase()), gt(telegramLinks.codeExpiresAt, new Date())))
    .limit(1);
  if (!link) {
    await sendMessage(chatId, 'Ese código no sirve o ya venció. Genera uno nuevo en Billedy → Telegram.');
    return;
  }
  // Un chat solo puede estar vinculado a un usuario
  await db.update(telegramLinks).set({ chatId: null, updatedAt: new Date() }).where(eq(telegramLinks.chatId, chatId));
  await db
    .update(telegramLinks)
    .set({ chatId, linkCode: null, codeExpiresAt: null, linkedAt: new Date(), updatedAt: new Date() })
    .where(eq(telegramLinks.id, link.id));
  await sendMessage(chatId, `Listo, este chat quedó conectado a Billedy.\n\n${HELP}`);
}

async function handleText(chatId: number, text: string) {
  const trimmed = text.trim();
  const start = trimmed.match(/^\/start(?:@\w+)?\s+(\S+)/);
  if (start) return handleLink(chatId, start[1]);

  const link = await getLinkByChat(chatId);
  if (!link) {
    await sendMessage(chatId, 'Este chat no está conectado. Abre Billedy → Telegram y envía aquí el código que te muestra.');
    return;
  }

  const command = trimmed.match(/^\/(\w+)/)?.[1]?.toLowerCase();
  if (command === 'start' || command === 'ayuda' || command === 'help') return sendMessage(chatId, HELP);
  if (command === 'techo') return sendCap(chatId, link);
  if (command === 'hoy') return sendToday(chatId, link);
  if (command === 'deshacer') return undoLast(chatId, link);
  if (command) return sendMessage(chatId, `No conozco ese comando.\n\n${HELP}`);

  const ctx = await loadContext(link.projectId);
  const parsed = parseExpenseMessage(trimmed, ctx);
  const awaiting = await findAwaitingDetail(link.id);

  // Respuesta a "¿Qué fue?": un mensaje sin monto completa el borrador que esperaba el detalle
  if (awaiting && !parsed.ok) {
    const prev = awaiting.payload as DraftPayload;
    const re = parseExpenseMessage(`${prev.type === 'income' ? '+' : ''}${prev.amount} ${trimmed}`, ctx);
    if (!re.ok) return sendMessage(chatId, esc(re.error));
    const next: DraftPayload = { ...re.data, date: prev.date, step: undefined };
    next.step = nextStep(next);
    if (prev.promptMessageId) {
      await editMessage(chatId, prev.promptMessageId, `<b>${formatCurrency(prev.amount)}</b> · ${esc(trimmed)}`);
    }
    const view = stepView(awaiting.id, next, ctx);
    const sent = await sendMessage(chatId, view.text, view.keyboard);
    await db
      .update(telegramDrafts)
      .set({ payload: { ...next, promptMessageId: sent?.message_id }, updatedAt: new Date() })
      .where(eq(telegramDrafts.id, awaiting.id));
    return;
  }
  if (!parsed.ok) return sendMessage(chatId, esc(parsed.error));

  // Un monto nuevo deja de lado la pregunta anterior
  if (awaiting) {
    await db.update(telegramDrafts).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(telegramDrafts.id, awaiting.id));
    const prev = awaiting.payload as DraftPayload;
    if (prev.promptMessageId) {
      await editMessage(chatId, prev.promptMessageId, `<s>${formatCurrency(prev.amount)}</s> · reemplazado por el siguiente`);
    }
  }

  const payload: DraftPayload = { ...parsed.data };
  payload.step = nextStep(payload);
  const [draft] = await db
    .insert(telegramDrafts)
    .values({ linkId: link.id, payload })
    .returning({ id: telegramDrafts.id });
  const view = stepView(draft.id, payload, ctx);
  const sent = await sendMessage(chatId, view.text, view.keyboard);
  if (sent && payload.step === 'detail') {
    await db
      .update(telegramDrafts)
      .set({ payload: { ...payload, promptMessageId: sent.message_id } })
      .where(eq(telegramDrafts.id, draft.id));
  }
}

async function sendCap(chatId: number, link: Link) {
  const cycles = await getBillingCycles(link.projectId, link.userId);
  const open = cycles.find((c) => c.status === 'open');
  if (!open) return sendMessage(chatId, 'No hay un ciclo abierto.');
  const plan = await getCyclePlanStatus(open);
  const c = plan.card;
  await sendMessage(
    chatId,
    [
      `<b>Techo de la tarjeta</b> (${open.daysRemaining} días para cerrar)`,
      `Gastado: ${formatCurrency(c.spent)} de ${formatCurrency(c.cap)} (${c.percent}%)`,
      c.available >= 0
        ? `Disponible: <b>${formatCurrency(c.available)}</b> · ${formatCurrency(c.dailyAllowance)} por día`
        : `Te pasaste por <b>${formatCurrency(-c.available)}</b>`,
      `Proyección al cierre: ${formatCurrency(c.projection)}`,
    ].join('\n')
  );
}

async function sendToday(chatId: number, link: Link) {
  const today = getToday();
  const rows = await db
    .select({ description: transactions.description, amount: transactions.baseAmount, type: transactions.type })
    .from(transactions)
    .where(
      and(
        eq(transactions.projectId, link.projectId),
        eq(transactions.date, today),
        sql`${transactions.linkedTransactionId} is null`
      )
    )
    .orderBy(desc(transactions.createdAt))
    .limit(15);
  if (!rows.length) return sendMessage(chatId, 'Hoy no hay movimientos registrados.');
  const spent = rows.filter((r) => r.type === 'expense').reduce((acc, r) => acc + Number(r.amount), 0);
  await sendMessage(
    chatId,
    [
      `<b>Hoy</b> · gastado ${formatCurrency(spent)}`,
      ...rows.map((r) => `${r.type === 'income' ? '+' : '−'}${formatCurrency(Number(r.amount))} · ${esc(r.description)}`),
    ].join('\n')
  );
}

async function undoLast(chatId: number, link: Link) {
  const [draft] = await db
    .select()
    .from(telegramDrafts)
    .where(
      and(
        eq(telegramDrafts.linkId, link.id),
        eq(telegramDrafts.status, 'saved'),
        gte(telegramDrafts.updatedAt, new Date(Date.now() - DRAFT_TTL_MS))
      )
    )
    .orderBy(desc(telegramDrafts.updatedAt))
    .limit(1);
  if (!draft?.transactionId) return sendMessage(chatId, 'No hay nada reciente que deshacer.');
  const result = await removeTransaction(draft.transactionId, link.userId, expireRelatedCache);
  if (!result.success) return sendMessage(chatId, esc(result.error));
  await db.update(telegramDrafts).set({ status: 'undone', updatedAt: new Date() }).where(eq(telegramDrafts.id, draft.id));
  const data = draft.payload as ParsedExpense;
  await sendMessage(chatId, `↩️ Deshice ${formatCurrency(data.amount)} · ${esc(data.description)}`);
}

async function handleCallback(cb: NonNullable<TelegramUpdate['callback_query']>) {
  const chatId = cb.message?.chat.id;
  const messageId = cb.message?.message_id;
  if (!chatId || !messageId || !cb.data) return answerCallback(cb.id);

  const link = await getLinkByChat(chatId);
  if (!link) return answerCallback(cb.id, 'Este chat no está conectado');

  const [action, draftId, arg] = cb.data.split(':');
  const [draft] = await db
    .select()
    .from(telegramDrafts)
    .where(and(eq(telegramDrafts.id, draftId), eq(telegramDrafts.linkId, link.id)))
    .limit(1);
  if (!draft) return answerCallback(cb.id, 'No encontré ese movimiento');

  const data = draft.payload as DraftPayload;
  const expired = Date.now() - draft.createdAt.getTime() > DRAFT_TTL_MS;

  // Deshacer un guardado
  if (action === 'u') {
    if (draft.status !== 'saved' || !draft.transactionId || expired) return answerCallback(cb.id, 'Ya no se puede deshacer');
    const result = await removeTransaction(draft.transactionId, link.userId, expireRelatedCache);
    if (!result.success) return answerCallback(cb.id, result.error);
    await db.update(telegramDrafts).set({ status: 'undone', updatedAt: new Date() }).where(eq(telegramDrafts.id, draft.id));
    await editMessage(chatId, messageId, `↩️ Deshecho\n<s>${formatCurrency(data.amount)} · ${esc(data.description)}</s>`);
    return answerCallback(cb.id, 'Deshecho');
  }

  if (draft.status !== 'pending') return answerCallback(cb.id, 'Este movimiento ya se resolvió');
  if (expired) {
    await db.update(telegramDrafts).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(telegramDrafts.id, draft.id));
    await editMessage(chatId, messageId, 'Venció. Vuelve a escribirlo si quieres registrarlo.');
    return answerCallback(cb.id);
  }

  const ctx = await loadContext(link.projectId);

  if (action === 'c') {
    await db.update(telegramDrafts).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(telegramDrafts.id, draft.id));
    await editMessage(chatId, messageId, `✖️ Cancelado\n<s>${formatCurrency(data.amount)} · ${esc(data.description)}</s>`);
    return answerCallback(cb.id);
  }

  // Sin detalle: sigue al presupuesto (o a confirmar)
  if (action === 'nd') {
    const next: DraftPayload = { ...data, hasDetail: true, step: 'budget' };
    next.step = nextStep(next);
    await db.update(telegramDrafts).set({ payload: next, updatedAt: new Date() }).where(eq(telegramDrafts.id, draft.id));
    const view = stepView(draft.id, next, ctx);
    await editMessage(chatId, messageId, view.text, view.keyboard);
    return answerCallback(cb.id);
  }

  // Elegir cuenta o presupuesto: muestra la lista; al elegir, actualiza el borrador
  const spendable = ctx.accounts.filter((a) => ['checking', 'cash', 'credit_card'].includes(a.type));
  if (action === 'a' || action === 'b') {
    const back: InlineKeyboard = [[{ text: '← Volver', callback_data: `r:${draft.id}` }]];
    let rows: InlineKeyboard;
    if (action === 'a') {
      const options = spendable.map((a, i) => ({ text: a.name, callback_data: `sa:${draft.id}:${i}` }));
      rows = [];
      for (let i = 0; i < options.length; i += 2) rows.push(options.slice(i, i + 2));
      rows.push(...back);
    } else {
      rows = budgetKeyboard(draft.id, ctx, back);
    }
    await editMessage(chatId, messageId, `${summary(data, ctx)}\n\n${action === 'a' ? '¿Con qué cuenta?' : '¿Qué presupuesto?'}`, rows);
    return answerCallback(cb.id);
  }

  let next: DraftPayload = data;
  if (action === 'sa') {
    const account = spendable[Number(arg)];
    if (account) next = { ...data, accountId: account.id };
  } else if (action === 'sb') {
    const budget = Number(arg) >= 0 ? ctx.budgets[Number(arg)] : null;
    // Sin detalle, el gasto toma el nombre del presupuesto ("Pellet Estufa" en vez de "Gasto")
    const genericName = data.description === 'Gasto' || data.description === 'Ingreso';
    next = {
      ...data,
      budgetAsked: true,
      step: 'confirm',
      description: genericName && budget ? budget.name : data.description,
      budgetId: budget?.id ?? null,
      categoryId: budget?.categoryId ?? data.categoryId,
      // Si el presupuesto tiene cuenta asignada, se usa esa
      accountId: budget?.defaultAccountId ?? data.accountId,
    };
  }
  if (next !== data) {
    await db.update(telegramDrafts).set({ payload: next, updatedAt: new Date() }).where(eq(telegramDrafts.id, draft.id));
  }

  if (action === 'sa' || action === 'sb' || action === 'r') {
    await editMessage(chatId, messageId, summary(next, ctx), confirmKeyboard(draft.id, next.type));
    return answerCallback(cb.id);
  }

  if (action === 's') {
    // Marca primero para que un doble toque no guarde dos veces
    const claimed = await db
      .update(telegramDrafts)
      .set({ status: 'saved', updatedAt: new Date() })
      .where(and(eq(telegramDrafts.id, draft.id), eq(telegramDrafts.status, 'pending')))
      .returning({ id: telegramDrafts.id });
    if (!claimed.length) return answerCallback(cb.id, 'Ya se guardó');

    const result = await insertTransaction(
      link.userId,
      {
        projectId: link.projectId,
        type: next.type,
        originalAmount: next.amount,
        description: next.description,
        date: new Date(`${next.date}T00:00:00Z`),
        accountId: next.accountId,
        budgetId: next.budgetId,
        categoryId: next.categoryId,
        entityId: next.entityId,
        isPaid: true,
        nature: 'own',
      },
      expireRelatedCache
    );
    if (!result.success) {
      await db.update(telegramDrafts).set({ status: 'pending', updatedAt: new Date() }).where(eq(telegramDrafts.id, draft.id));
      return answerCallback(cb.id, result.error);
    }
    await db
      .update(telegramDrafts)
      .set({ transactionId: result.data.id, updatedAt: new Date() })
      .where(eq(telegramDrafts.id, draft.id));

    const note = await afterSaveNote(link, next, ctx).catch(() => '');
    await editMessage(chatId, messageId, `✅ Guardado\n${summary(next, ctx)}${note}`, [
      [{ text: '↩️ Deshacer', callback_data: `u:${draft.id}` }],
    ]);
    return answerCallback(cb.id, 'Guardado');
  }

  return answerCallback(cb.id);
}

export async function handleUpdate(update: TelegramUpdate) {
  // Solo chats privados: en grupos no se sabe quién escribe
  if (update.message?.text && update.message.chat.type === 'private') {
    await handleText(update.message.chat.id, update.message.text);
  } else if (update.callback_query) {
    await handleCallback(update.callback_query);
  }
}
