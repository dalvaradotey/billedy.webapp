/**
 * Verifica el saldo de caja de los ciclos contra los valores acordados en
 * docs/PLAN_SALDOS_CICLOS_Y_TECHO_TC.md (§9 y Anexo B).
 *
 * Solo lectura: todas las consultas corren dentro de una transacción READ ONLY.
 *
 *   npx tsx scripts/verify-cycle-balances.ts
 */
import 'dotenv/config';
import postgres from 'postgres';
import { PgDialect } from 'drizzle-orm/pg-core';
import { getToday } from '@/lib/formatting';
import { bucketAggregationQuery, parseBucketRows } from '@/features/billing-cycles/lib/cycle-buckets';
import { buildBalances, type BalanceRange } from '@/features/billing-cycles/lib/cycle-balance';

type Expected = {
  income: number;
  reimbursements: number;
  debitExpenses: number;
  cardPayment: number;
  balanceBeforeSavings: number;
  savings: number;
  finalBalance: number;
};

const EXPECTED: Record<string, Expected> = {
  'Ciclo Junio 2026': {
    income: 4_678_022,
    reimbursements: 485_779,
    debitExpenses: 2_503_976,
    cardPayment: 2_007_738,
    balanceBeforeSavings: 652_087,
    savings: 470_000,
    finalBalance: 182_087,
  },
  'Ciclo Julio 2026': {
    income: 5_326_137,
    reimbursements: 1_008_231,
    debitExpenses: 2_684_735,
    cardPayment: 2_186_801,
    balanceBeforeSavings: 1_462_832,
    savings: 270_000,
    finalBalance: 1_192_832,
  },
  'Ciclo Agosto 2026': {
    income: 4_021_467,
    reimbursements: 420_848,
    debitExpenses: 2_185_678,
    cardPayment: 1_701_077,
    balanceBeforeSavings: 555_560,
    savings: 170_000,
    finalBalance: 385_560,
  },
  'Ciclo Septiembre 2026': {
    income: 4_286_043,
    reimbursements: 247_700,
    debitExpenses: 2_131_723,
    cardPayment: 1_897_350,
    balanceBeforeSavings: 504_670,
    savings: 220_000,
    finalBalance: 284_670,
  },
};

/** Diferencia máxima aceptada entre el pago TC real y la vista estado de cuenta */
const BACKTEST_TOLERANCE = 10_000;

const fmt = (n: number) => n.toLocaleString('es-CL');

async function main() {
  const client = postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: 1,
    ssl: { rejectUnauthorized: false },
  });
  const dialect = new PgDialect();
  let failures = 0;

  try {
    await client.begin('read only', async (transaction) => {
      // Los tipos de postgres.js pierden la firma invocable dentro de begin()
      const tx = transaction as unknown as postgres.Sql;
      const projects = await tx<{ project_id: string }[]>`
        select distinct project_id from n1n4_billing_cycles`;

      for (const { project_id: projectId } of projects) {
        const cycles = await tx<{ id: string; name: string; start: string; end: string; status: 'open' | 'closed' }[]>`
          select id, name, start_date::text as start, end_date::text as end, status::text as status
          from n1n4_billing_cycles where project_id = ${projectId} order by start_date`;
        const cards = await tx<{ id: string; name: string }[]>`
          select id, name from n1n4_accounts where project_id = ${projectId} and type = 'credit_card'`;

        const ranges: BalanceRange[] = cycles.map((c) => ({
          key: c.id,
          start: c.start,
          end: c.end,
          status: c.status,
        }));
        const today = getToday().toISOString().slice(0, 10);
        const query = dialect.sqlToQuery(bucketAggregationQuery(projectId, ranges, today));
        const raw = await tx.unsafe(query.sql, query.params as never[]);
        const balances = buildBalances(
          ranges,
          parseBucketRows(raw as unknown as Parameters<typeof parseBucketRows>[0]),
          new Map(cards.map((c) => [c.id, c.name]))
        );

        console.log(`\nProyecto ${projectId}`);
        console.log('─'.repeat(100));

        cycles.forEach((cycle, index) => {
          const b = balances.get(cycle.id)!;
          const actual: Expected = {
            income: b.income.real,
            reimbursements: b.reimbursements.real,
            debitExpenses: b.debitExpenses.real,
            cardPayment: b.cardPayment.real,
            balanceBeforeSavings: b.balanceBeforeSavings.real,
            savings: b.savingsIn.real - b.savingsOut.real,
            finalBalance: b.finalBalance.real,
          };

          const expected = EXPECTED[cycle.name];
          const mismatches = expected
            ? (Object.keys(expected) as (keyof Expected)[]).filter((k) => expected[k] !== actual[k])
            : [];
          const status = !expected ? '·' : mismatches.length === 0 ? '✅' : '❌';
          if (mismatches.length > 0) failures++;

          console.log(
            `${status} ${cycle.name.padEnd(24)} ${cycle.status.padEnd(6)} ` +
              `antes de ahorro ${fmt(actual.balanceBeforeSavings).padStart(11)} · ` +
              `final ${fmt(actual.finalBalance).padStart(11)}` +
              (cycle.status === 'open'
                ? ` · proyectado ${fmt(b.finalBalance.projected)} (pago TC pendiente ${fmt(b.card.pendingPayment)})`
                : '')
          );
          for (const key of mismatches) {
            console.log(`     ${key}: esperado ${fmt(expected![key])}, obtenido ${fmt(actual[key])}`);
          }
          for (const w of b.warnings) {
            console.log(`     ⚠️  ${JSON.stringify(w)}`);
          }

          // Backtest: el pago TC de este ciclo vs la vista estado de cuenta del anterior
          if (index > 0 && b.cardPayment.real > 0) {
            const prev = balances.get(cycles[index - 1].id)!;
            const diff = b.cardPayment.real - prev.card.upcomingStatement;
            const ok = Math.abs(diff) <= BACKTEST_TOLERANCE;
            if (!ok) failures++;
            console.log(
              `     ${ok ? '✅' : '❌'} backtest pago TC: pagado ${fmt(b.cardPayment.real)} · ` +
                `predicho ${fmt(prev.card.upcomingStatement)} · diferencia ${fmt(diff)}`
            );
          }
        });
      }
    });
  } finally {
    await client.end();
  }

  console.log(failures === 0 ? '\n✅ Todo cuadra.' : `\n❌ ${failures} diferencia(s).`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
