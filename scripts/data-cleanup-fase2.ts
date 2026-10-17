/**
 * Limpieza de datos y marcado del historial (Fase 2 del plan de saldos).
 *
 * Todo corre en UNA transacción. Sin --apply se hace ROLLBACK al final: el
 * reporte muestra exactamente lo que se aplicaría. Es idempotente (las
 * condiciones solo calzan con filas que aún no tienen el cambio).
 *
 *   npx tsx scripts/data-cleanup-fase2.ts            → reporte (no cambia nada)
 *   npx tsx scripts/data-cleanup-fase2.ts --apply    → aplica
 */
import 'dotenv/config';
import postgres from 'postgres';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PgDialect } from 'drizzle-orm/pg-core';
import { getToday } from '@/lib/formatting';
import { bucketAggregationQuery, parseBucketRows } from '@/features/billing-cycles/lib/cycle-buckets';
import { buildBalances, toClosingSnapshot, type BalanceRange } from '@/features/billing-cycles/lib/cycle-balance';

/** Desde aquí empiezan "Por cobrar" y "Fondo por liquidar"; lo anterior se da por compensado */
const SETTLEMENT_CUTOFF = '2026-09-25';
const SAVINGS_TARGET = 400_000;
const CARD_SPENDING_CAP = 1_142_000;
const CONTINGENCY_ACCOUNT_NAME = 'Fondo Backup';

type Row = Record<string, unknown>;
const report: string[] = [];
const fmt = (n: unknown) => Math.round(Number(n)).toLocaleString('es-CL');

function section(title: string, rows: Row[], describe: (r: Row) => string) {
  report.push(`\n## ${title} (${rows.length})`);
  if (rows.length === 0) report.push('_Sin cambios._');
  for (const r of rows) report.push(`- ${describe(r)}`);
}

const isoDate = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
const tx = (r: Row) => `${isoDate(r.date)} · $${fmt(r.base_amount)} · ${String(r.description).trim()}`;

async function run(sql: postgres.Sql, projectId: string) {
  // 1. Categorías nuevas y naturaleza sugerida por categoría
  const newCategories = await sql`
    insert into n1n4_categories (project_id, name, color)
    select ${projectId}, v.name, v.color
    from (values ('Inversión', '#0ea5e9'), ('Proyectos personales', '#8b5cf6')) as v(name, color)
    where not exists (
      select 1 from n1n4_categories c where c.project_id = ${projectId} and c.name = v.name
    )
    returning name`;
  section('Categorías nuevas', newCategories, (r) => String(r.name));

  const defaults = await sql`
    update n1n4_categories c set default_nature = v.nature::transaction_nature, updated_at = now()
    from (values ('Externo', 'external'), ('Avance en cuotas', 'external'),
                 ('Inesperado', 'fund'), ('Trabajo', 'fund'),
                 ('Reembolsos', 'reimbursement')) as v(name, nature)
    where c.project_id = ${projectId} and c.name = v.name
      and c.default_nature is distinct from v.nature::transaction_nature
    returning c.name, c.default_nature`;
  section('Naturaleza sugerida por categoría', defaults, (r) => `${r.name} → ${r.default_nature}`);

  // 2. Recategorización
  const recategorize = async (title: string, where: postgres.PendingQuery<Row[]>, category: string) => {
    const rows = await sql`
      update n1n4_transactions t set category_id = c.id, updated_at = now()
      from n1n4_categories c
      where c.project_id = ${projectId} and c.name = ${category}
        and t.project_id = ${projectId} and t.category_id is distinct from c.id
        and ${where}
      returning t.date, t.base_amount, t.description`;
    section(`${title} → ${category}`, rows, tx);
  };
  await recategorize('Saesa sin categoría', sql`t.description = 'Compra Saesa' and t.category_id is null`, 'Gastos básicos');
  await recategorize('Pasaje viaje laboral', sql`t.description = 'Pasaje a Santiago Octubre'`, 'Trabajo');
  await recategorize('Pruebas Nomades', sql`t.description ilike 'prueba nomades'`, 'Trabajo');
  await recategorize('Runpod', sql`t.description ilike 'runpod'`, 'Proyectos personales');
  await recategorize('Inversión ostras', sql`t.description = 'Inversión Ostras'`, 'Inversión');

  // 3. Naturaleza
  const installmentsNature = await sql`
    update n1n4_transactions t set nature = cp.nature, updated_at = now()
    from n1n4_card_purchases cp
    where t.card_purchase_id = cp.id and t.project_id = ${projectId} and t.nature <> cp.nature
    returning t.date, t.base_amount, t.description`;
  section('Cuotas que heredan la naturaleza de su compra', installmentsNature, tx);

  const setNature = async (title: string, nature: string, where: postgres.PendingQuery<Row[]>) => {
    const rows = await sql`
      update n1n4_transactions t set nature = ${nature}::transaction_nature, updated_at = now()
      from n1n4_accounts a
      where a.id = t.account_id and t.project_id = ${projectId}
        and t.nature = 'own' and ${where}
      returning t.date, t.base_amount, t.description`;
    section(title, rows, tx);
  };
  const category = (name: string) =>
    sql`t.category_id in (select id from n1n4_categories where project_id = ${projectId} and name = ${name})`;

  await setNature('Gastos de otra persona (categorías Externo / Avance en cuotas)', 'external',
    sql`t.type = 'expense' and t.card_purchase_id is null and (${category('Externo')} or ${category('Avance en cuotas')})`);
  await setNature('Gastos reembolsables', 'reimbursable',
    sql`t.type = 'expense' and (t.description ilike '%reembolsable%' or t.description ilike '%reeembolsable%')`);
  await setNature('Gastos del fondo (categorías Inesperado / Trabajo)', 'fund',
    sql`t.type = 'expense' and t.card_purchase_id is null and (${category('Inesperado')} or ${category('Trabajo')})`);
  await setNature('Abonos en cuenta corriente', 'reimbursement',
    sql`t.type = 'income' and t.linked_transaction_id is null and a.type in ('checking', 'cash')
        and (${category('Reembolsos')} or ${category('Externo')} or ltrim(t.description) ilike 'abono%'
             or (ltrim(t.description) ilike 'devoluci%' and not ${category('Impuestos')}))`);
  await setNature('Devoluciones en TC', 'reimbursement',
    sql`t.type = 'income' and t.linked_transaction_id is null and a.type = 'credit_card'
        and t.description ilike 'devolución%'`);

  // 4. Historial: lo anterior al ciclo actual se da por compensado
  const waived = await sql`
    insert into n1n4_settlements (expense_id, amount, kind)
    select t.id, t.base_amount, 'waived'
    from n1n4_transactions t
    where t.project_id = ${projectId} and t.type = 'expense'
      and t.nature in ('external', 'reimbursable', 'fund')
      and t.date < ${SETTLEMENT_CUTOFF}::date
      and not exists (select 1 from n1n4_settlements s where s.expense_id = t.id)
    returning amount`;
  const waivedTotal = waived.reduce((acc, r) => acc + Number(r.amount), 0);
  report.push(
    `\n## Historial anterior al ${SETTLEMENT_CUTOFF} dado por compensado (${waived.length})\n` +
      `${waived.length} gastos de otra persona / reembolsables / del fondo, por $${fmt(waivedTotal)}. ` +
      `"Por cobrar" y "Fondo por liquidar" parten desde el ciclo actual.`
  );

  // 5. Aportes a Fondo Huevito sin meta
  const huevito = await sql`
    update n1n4_transactions t set savings_goal_id = g.id, updated_at = now()
    from n1n4_accounts a, n1n4_savings_goals g
    where a.id = t.account_id and a.name = 'Fondo Huevito' and g.name = 'Fondo Huevito'
      and t.project_id = ${projectId} and t.type = 'income' and t.savings_goal_id is null
    returning t.date, t.base_amount, t.description`;
  section('Aportes a Fondo Huevito → meta "Fondo Huevito"', huevito, tx);

  // 6. Plan del proyecto
  const plan = await sql`
    update n1n4_projects p set
      savings_target = coalesce(p.savings_target, ${SAVINGS_TARGET}),
      card_spending_cap = coalesce(p.card_spending_cap, ${CARD_SPENDING_CAP}),
      contingency_account_id = coalesce(p.contingency_account_id,
        (select id from n1n4_accounts where project_id = p.id and name = ${CONTINGENCY_ACCOUNT_NAME})),
      updated_at = now()
    where p.id = ${projectId}
      and (p.savings_target is null or p.card_spending_cap is null or p.contingency_account_id is null)
    returning savings_target, card_spending_cap, contingency_account_id`;
  section('Plan del proyecto', plan, (r) =>
    `ahorro objetivo $${fmt(r.savings_target)} · techo TC $${fmt(r.card_spending_cap)} · fondo ${CONTINGENCY_ACCOUNT_NAME}`);

  // 7. Snapshot de cierre de los ciclos cerrados (con la fórmula nueva)
  const cycles = await sql<{ id: string; name: string; start: string; end: string; status: 'open' | 'closed' }[]>`
    select id, name, start_date::text as start, end_date::text as "end", status::text as status
    from n1n4_billing_cycles where project_id = ${projectId} order by start_date`;
  const ranges: BalanceRange[] = cycles.map((c) => ({ key: c.id, start: c.start, end: c.end, status: c.status }));
  const query = new PgDialect().sqlToQuery(
    bucketAggregationQuery(projectId, ranges, getToday().toISOString().slice(0, 10))
  );
  const raw = await sql.unsafe(query.sql, query.params as never[]);
  const balances = buildBalances(ranges, parseBucketRows(raw as never), new Map());
  const snapshots: Row[] = [];
  for (const cycle of cycles.filter((c) => c.status === 'closed')) {
    const b = balances.get(cycle.id)!;
    const rows = await sql`
      update n1n4_billing_cycles set
        closing_snapshot = ${sql.json(toClosingSnapshot(b))},
        updated_at = now()
      where id = ${cycle.id} and closing_snapshot is null
      returning name, closing_snapshot->>'finalBalance' as final_balance`;
    snapshots.push(...rows);
  }
  section('Snapshot de cierre de ciclos cerrados (fórmula nueva)', snapshots, (r) =>
    `${r.name}: saldo final $${fmt(r.final_balance)}`);

  // Para revisar a mano (no se cambia)
  const uncategorized = await sql`
    select t.date, t.base_amount, t.description from n1n4_transactions t
    where t.project_id = ${projectId} and t.category_id is null order by t.date`;
  section('Para revisar a mano: transacciones sin categoría (no se modifican)', uncategorized, tx);
}

class Rollback extends Error {}

async function main() {
  const apply = process.argv.includes('--apply');
  const client = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.begin(async (transaction) => {
      const sql = transaction as unknown as postgres.Sql;
      const projects = await sql<{ id: string; name: string }[]>`select id, name from n1n4_projects`;
      for (const project of projects) {
        report.push(`# Proyecto ${project.name}`);
        await run(sql, project.id);
      }
      if (!apply) throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  } finally {
    await client.end();
  }

  const text =
    `${apply ? '# ✅ APLICADO' : '# Reporte de prueba (no se aplicó nada)'}\n\n` + report.join('\n');
  mkdirSync(join(process.cwd(), 'backups'), { recursive: true });
  const file = join(process.cwd(), 'backups', `cleanup-${apply ? 'aplicado' : 'dry-run'}.md`);
  writeFileSync(file, text);
  console.log(text);
  console.log(`\nReporte en ${file}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
