import { sql } from 'drizzle-orm';
import { reserveRowsQuery } from './cycle-reserves';
import { db } from '@/lib/db';
import { getToday } from '@/lib/formatting';
import type { CycleBalance } from './cycle-balance';

/**
 * Plan del ciclo: techo de gasto propio en TC, meta de ahorro y "Libre del ciclo".
 * Ver docs/PLAN_SALDOS_CICLOS_Y_TECHO_TC.md §6.
 */

export type PendingSettlementSummary = {
  /** Gastos de otra persona / reembolsables ya cargados que aún no se compensan */
  toCollect: number;
  toCollectCount: number;
  /** Gastos del fondo cuya plata ya salió (débito o TC pagada) y que aún no se retiran del fondo */
  fundToLiquidate: number;
  fundToLiquidateCount: number;
  /** Gastos del fondo en TC que todavía no se pagan (se liquidan al pagar la tarjeta) */
  fundAwaitingPayment: number;
};

export type CyclePlanStatus = {
  savings: {
    target: number | null;
    done: number;
    remaining: number;
  };
  /** Saldo final proyectado menos el ahorro que falta hacer (null sin ahorro objetivo) */
  free: number | null;
  card: {
    cap: number;
    /** true si el usuario definió el techo; false si se usa el máximo calculado */
    isCustomCap: boolean;
    /** Punto en que el ahorro objetivo empieza a verse afectado */
    maxCap: number;
    spent: number;
    /** Plantilla TC + cuotas propias: conocido desde el día 1 */
    committedFixed: number;
    projection: number;
    available: number;
    /** Disponible por día restante */
    dailyAllowance: number;
    percent: number;
  };
  expectedIncome: number;
  debitCommitments: number;
  pending: PendingSettlementSummary;
  contingencyAccount: { id: string; name: string } | null;
};

type CycleInput = {
  id: string;
  projectId: string;
  startDate: Date | string;
  endDate: Date | string;
  balance: CycleBalance;
  daysTotal: number;
  daysElapsed: number;
  daysRemaining: number;
};

const toDate = (d: Date | string) => (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));
const num = (v: unknown) => Math.round(Number(v ?? 0));

async function rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
  return (await db.execute(query)) as unknown as T[];
}

/**
 * Lo pendiente de compensar del proyecto (Por cobrar / Fondo por liquidar).
 */
export async function getPendingSettlementSummary(projectId: string): Promise<PendingSettlementSummary> {
  const today = toDate(getToday());
  const [r] = await rows<Record<string, string>>(sql`
    with pending as (
      select
        t.nature,
        a.type::text as acc,
        t.paid_by_transfer_id is not null as card_paid,
        t.base_amount - coalesce((select sum(s.amount) from n1n4_settlements s where s.expense_id = t.id), 0) as remaining
      from n1n4_transactions t
      join n1n4_accounts a on a.id = t.account_id
      where t.project_id = ${projectId}
        and t.type = 'expense'
        and t.is_paid
        and t.nature in ('external', 'reimbursable', 'fund')
        -- Un traspaso de plata de terceros no espera abono
        and t.linked_transaction_id is null
        and t.date <= ${today}::date
    )
    select
      coalesce(sum(remaining) filter (where nature <> 'fund' and remaining > 0.5), 0) as to_collect,
      count(*) filter (where nature <> 'fund' and remaining > 0.5) as to_collect_count,
      coalesce(sum(remaining) filter (where nature = 'fund' and remaining > 0.5 and (acc <> 'credit_card' or card_paid)), 0) as fund_liquidate,
      count(*) filter (where nature = 'fund' and remaining > 0.5 and (acc <> 'credit_card' or card_paid)) as fund_liquidate_count,
      coalesce(sum(remaining) filter (where nature = 'fund' and remaining > 0.5 and acc = 'credit_card' and not card_paid), 0) as fund_awaiting
    from pending
  `);
  return {
    toCollect: num(r?.to_collect),
    toCollectCount: num(r?.to_collect_count),
    fundToLiquidate: num(r?.fund_liquidate),
    fundToLiquidateCount: num(r?.fund_liquidate_count),
    fundAwaitingPayment: num(r?.fund_awaiting),
  };
}

/**
 * Calcula el plan del ciclo abierto.
 */
export async function getCyclePlanStatus(cycle: CycleInput): Promise<CyclePlanStatus> {
  const { projectId, balance } = cycle;
  const start = toDate(cycle.startDate);
  const end = toDate(cycle.endDate);

  const [[project], templateRows, creditRows, pending] = await Promise.all([
    rows<Record<string, string | null>>(sql`
      select p.savings_target, p.card_spending_cap, p.contingency_account_id, a.name as contingency_name
      from n1n4_projects p
      left join n1n4_accounts a on a.id = p.contingency_account_id
      where p.id = ${projectId}`),
    // Ítems de plantillas activas. El ingreso esperado usa el último monto real
    // registrado con la misma descripción (prudente: el sueldo real, no el estimado).
    rows<Record<string, string>>(sql`
      select
        ti.type::text as type,
        a.type::text as acc,
        coalesce(
          case when ti.type = 'income' then (
            select t.base_amount from n1n4_transactions t
            where t.project_id = ${projectId} and t.type = 'income' and t.is_paid
              and lower(trim(t.description)) = lower(trim(ti.description))
            order by t.date desc limit 1
          ) end,
          ti.base_amount
        ) as amount
      from n1n4_template_items ti
      join n1n4_templates tp on tp.id = ti.template_id
      join n1n4_accounts a on a.id = ti.account_id
      where tp.project_id = ${projectId} and tp.is_active and not tp.is_archived`),
    rows<Record<string, string>>(sql`
      select coalesce(sum(t.base_amount), 0) as total
      from n1n4_transactions t
      where t.project_id = ${projectId} and t.credit_id is not null
        and t.date between ${start}::date and ${end}::date`),
    getPendingSettlementSummary(projectId),
  ]);

  const sumTemplates = (predicate: (r: Record<string, string>) => boolean) =>
    templateRows.filter(predicate).reduce((acc, r) => acc + num(r.amount), 0);

  const expectedIncome = sumTemplates((r) => r.type === 'income' && (r.acc === 'checking' || r.acc === 'cash'));
  const templateDebit = sumTemplates((r) => r.type === 'expense' && (r.acc === 'checking' || r.acc === 'cash'));
  const templateCard = sumTemplates((r) => r.type === 'expense' && r.acc === 'credit_card');
  const debitCommitments = num(creditRows[0]?.total) + templateDebit;

  const savingsTarget = project?.savings_target != null ? num(project.savings_target) : null;
  const maxCap = Math.max(0, expectedIncome - debitCommitments - (savingsTarget ?? 0));
  const customCap = project?.card_spending_cap != null ? num(project.card_spending_cap) : null;
  const cap = customCap ?? maxCap;

  const spent = balance.card.own.committed;
  const committedFixed = templateCard + balance.card.own.installments;
  const variable = Math.max(0, spent - committedFixed);
  const elapsed = Math.max(1, cycle.daysElapsed);
  const projection = Math.round(Math.max(spent, committedFixed + variable * (cycle.daysTotal / elapsed)));
  const available = cap - spent;

  const savingsDone = balance.savingsIn.real - balance.savingsOut.real;
  const savingsRemaining = savingsTarget != null ? Math.max(0, savingsTarget - savingsDone) : 0;

  return {
    savings: { target: savingsTarget, done: savingsDone, remaining: savingsRemaining },
    free: savingsTarget != null ? balance.finalBalance.projected - savingsRemaining : null,
    card: {
      cap,
      isCustomCap: customCap != null,
      maxCap,
      spent,
      committedFixed,
      projection,
      available,
      dailyAllowance: cycle.daysRemaining > 0 ? Math.round(available / cycle.daysRemaining) : available,
      percent: cap > 0 ? Math.round((spent / cap) * 100) : 0,
    },
    expectedIncome,
    debitCommitments,
    pending,
    contingencyAccount:
      project?.contingency_account_id && project.contingency_name
        ? { id: project.contingency_account_id, name: project.contingency_name }
        : null,
  };
}

export type CardPacePoint = { day: number; total: number };

export type CardPaceSeries = {
  /** Lo que ya cuenta desde el día 1: cuotas y cargos de plantilla aún no confirmados */
  baseline: number;
  /** Acumulado por día del ciclo (1 = primer día) hasta hoy */
  points: CardPacePoint[];
};

/**
 * Serie para el gráfico de ritmo: gasto propio en TC acumulado día a día.
 * Arranca en lo fijo (cuotas + plantilla pendiente) y suma las compras propias
 * ya cargadas, de modo que el último punto calza con `card.spent` del plan.
 */
export async function getCardPaceSeries(
  cycle: Pick<CycleInput, 'projectId' | 'startDate' | 'endDate' | 'daysElapsed'>,
  spent: number
): Promise<CardPaceSeries> {
  const start = toDate(cycle.startDate);
  const end = toDate(cycle.endDate);
  const today = toDate(getToday());
  const until = today < end ? today : end;

  const daily = await rows<Record<string, string>>(sql`
    select (t.date - ${start}::date + 1)::int as day, sum(t.base_amount) as total
    from n1n4_transactions t
    join n1n4_accounts a on a.id = t.account_id
    where t.project_id = ${cycle.projectId}
      and a.type = 'credit_card'
      and t.type = 'expense'
      and t.card_purchase_id is null
      and t.nature in ('own', 'reimbursement')
      and t.is_paid
      and not coalesce(t.is_historically_paid, false)
      and t.date between ${start}::date and ${until}::date
    group by 1
    order by 1`);

  const byDay = new Map(daily.map((r) => [num(r.day), num(r.total)]));
  const variableTotal = [...byDay.values()].reduce((a, b) => a + b, 0);
  const baseline = Math.max(0, spent - variableTotal);

  const points: CardPacePoint[] = [];
  let acc = baseline;
  for (let day = 1; day <= Math.max(1, cycle.daysElapsed); day++) {
    acc += byDay.get(day) ?? 0;
    points.push({ day, total: acc });
  }
  return { baseline, points };
}

export type CycleDailyPoint = { day: number; cash: number; savings: number };

/**
 * Caja y ahorro acumulados día a día (solo lo real, hasta hoy), con las mismas
 * reglas de la cascada: caja = ingresos + abonos − débito − pago TC − aportes + retiros;
 * ahorro = aportes − retiros (incluye apartar/liberar en fondos y gastos pagados con fondos).
 * Los abonos reservados (ver cycle-reserves) salen de la caja hasta que se paga su gasto.
 */
export async function getCycleDailySeries(
  cycle: Pick<CycleInput, 'projectId' | 'startDate' | 'endDate' | 'daysElapsed'>
): Promise<CycleDailyPoint[]> {
  const start = toDate(cycle.startDate);
  const end = toDate(cycle.endDate);
  const today = toDate(getToday());
  const until = today < end ? today : end;
  const projectId = cycle.projectId;

  const daily = await rows<Record<string, string>>(sql`
    with tx as (
      select
        t.date,
        t.type,
        t.base_amount,
        t.nature::text as nature,
        t.linked_transaction_id,
        a.type::text as acc,
        xa.type::text as contra
      from n1n4_transactions t
      join n1n4_accounts a on a.id = t.account_id
      left join n1n4_transactions x on x.id = t.linked_transaction_id
      left join n1n4_accounts xa on xa.id = x.account_id
      where t.project_id = ${projectId}
        and t.date between ${start}::date and ${until}::date
        and t.is_paid
        and not coalesce(t.is_historically_paid, false)
        and a.type in ('checking', 'cash')
    ),
    moves as (
      select date,
        case
          -- Plata de otra persona (ingreso o traspaso de terceros): no cuenta
          when nature = 'external' and (type = 'income' or linked_transaction_id is not null) then 0
          when type = 'income' and linked_transaction_id is null then base_amount
          when type = 'expense' and linked_transaction_id is null then -base_amount
          when type = 'expense' and contra = 'credit_card' then -base_amount
          when type = 'expense' and contra in ('savings', 'pension', 'unemployment') then -base_amount
          when type = 'income' and contra in ('savings', 'pension', 'unemployment') then base_amount
          else 0
        end as cash,
        case
          when nature = 'external' then 0
          when type = 'expense' and contra in ('savings', 'pension', 'unemployment') then base_amount
          when type = 'income' and contra in ('savings', 'pension', 'unemployment') then -base_amount
          else 0
        end as savings
      from tx
      union all
      select m.date,
        case when m.kind = 'allocate' then -m.amount else m.amount end as cash,
        case when f.is_provision then 0 when m.kind = 'allocate' then m.amount else -m.amount end as savings
      from n1n4_fund_movements m
      join n1n4_account_funds f on f.id = m.fund_id
      join n1n4_accounts a on a.id = f.account_id
      where f.project_id = ${projectId}
        and not f.is_third_party
        and a.type in ('checking', 'cash')
        and m.kind in ('allocate', 'release')
        and m.date between ${start}::date and ${until}::date
      union all
      select t.date, t.base_amount as cash, case when f.is_provision then 0 else -t.base_amount end as savings
      from n1n4_transactions t
      join n1n4_account_funds f on f.id = t.account_fund_id
      join n1n4_accounts a on a.id = t.account_id
      where t.project_id = ${projectId}
        and t.account_fund_id is not null
        and t.type = 'expense'
        and t.is_paid
        and a.type in ('checking', 'cash')
        and t.date between ${start}::date and ${until}::date
      union all
      -- Abono reservado (su gasto aún no sale de la caja) y su liberación al pagarse
      select rs.reserved_on::date, -rs.amount, 0
      from (${reserveRowsQuery(projectId, until)}) rs
      where rs.reserved_on::date between ${start}::date and ${until}::date
      union all
      select rs.released_on::date, rs.amount, 0
      from (${reserveRowsQuery(projectId, until)}) rs
      where rs.released_on::date between ${start}::date and ${until}::date
    )
    select (date - ${start}::date + 1)::int as day, sum(cash) as cash, sum(savings) as savings
    from moves
    group by 1
    order by 1`);

  const byDay = new Map(daily.map((r) => [num(r.day), { cash: num(r.cash), savings: num(r.savings) }]));
  const points: CycleDailyPoint[] = [];
  let cash = 0;
  let savings = 0;
  for (let day = 1; day <= Math.max(1, cycle.daysElapsed); day++) {
    const d = byDay.get(day);
    cash += d?.cash ?? 0;
    savings += d?.savings ?? 0;
    points.push({ day, cash, savings });
  }
  return points;
}
