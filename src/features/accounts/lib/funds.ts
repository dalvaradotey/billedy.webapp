import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

/**
 * Fondos dentro de una cuenta ("sobres" que solo existen en la app).
 *
 *   Saldo del fondo = initial + allocate − release − gastos pagados con el fondo
 *   Libre de la cuenta = saldo de la cuenta − saldo de sus fondos (no archivados)
 */

export type AccountFund = {
  id: string;
  accountId: string;
  accountName: string;
  accountType: string;
  name: string;
  balance: number;
  targetAmount: number | null;
  isThirdParty: boolean;
  isArchived: boolean;
};

export type FundTotals = {
  /** Fondos propios (cualquier cuenta) */
  own: number;
  /** Plata de terceros guardada en tus cuentas */
  thirdParty: number;
  /** Por cuenta: suma de fondos y libre */
  byAccount: Record<string, { funds: number; free: number }>;
};

const num = (v: unknown) => Math.round(Number(v ?? 0));

type Row = Record<string, unknown>;

export async function getAccountFunds(projectId: string, includeArchived = false): Promise<AccountFund[]> {
  const rows = (await db.execute(sql`
    select
      f.id, f.account_id, a.name as account_name, a.type::text as account_type,
      f.name, f.target_amount, f.is_third_party, f.is_archived,
      coalesce((
        select sum(case when m.kind = 'release' then -m.amount else m.amount end)
        from n1n4_fund_movements m where m.fund_id = f.id
      ), 0)
      - coalesce((
        select sum(t.base_amount) from n1n4_transactions t
        where t.account_fund_id = f.id and t.type = 'expense'
      ), 0) as balance
    from n1n4_account_funds f
    join n1n4_accounts a on a.id = f.account_id
    where f.project_id = ${projectId}
      and (${includeArchived} or not f.is_archived)
    order by a.name, f.is_third_party, f.created_at`)) as unknown as Row[];

  return rows.map((r) => ({
    id: String(r.id),
    accountId: String(r.account_id),
    accountName: String(r.account_name),
    accountType: String(r.account_type),
    name: String(r.name),
    balance: num(r.balance),
    targetAmount: r.target_amount != null ? num(r.target_amount) : null,
    isThirdParty: Boolean(r.is_third_party),
    isArchived: Boolean(r.is_archived),
  }));
}

export async function getFundTotals(projectId: string): Promise<FundTotals> {
  const [funds, accountRows] = await Promise.all([
    getAccountFunds(projectId),
    db.execute(sql`
      select id, current_balance from n1n4_accounts
      where project_id = ${projectId} and type <> 'credit_card'`) as unknown as Promise<Row[]>,
  ]);

  const byAccount: FundTotals['byAccount'] = {};
  for (const account of accountRows) {
    byAccount[String(account.id)] = { funds: 0, free: num(account.current_balance) };
  }

  let own = 0;
  let thirdParty = 0;
  for (const fund of funds) {
    if (fund.isThirdParty) thirdParty += fund.balance;
    else own += fund.balance;
    const entry = byAccount[fund.accountId];
    if (entry) {
      entry.funds += fund.balance;
      entry.free -= fund.balance;
    }
  }

  return { own, thirdParty, byAccount };
}

/** Libre de una cuenta (saldo − fondos). null si la cuenta no existe o es TC. */
export async function getAccountFree(projectId: string, accountId: string): Promise<number | null> {
  const totals = await getFundTotals(projectId);
  return totals.byAccount[accountId]?.free ?? null;
}
