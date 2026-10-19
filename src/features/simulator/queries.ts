import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accounts, projects, simulations } from '@/lib/db/schema';
import { verifyProjectAccess } from '@/lib/auth/project-access';
import { getAccountFunds } from '@/features/accounts/lib/funds';
import type { PlanInput, SimulatorData, Source } from './lib/plan';

/**
 * Fuentes para el simulador:
 * - fondos propios (no provisiones: esas ya tienen destino);
 * - cuentas de ahorro, descontando la plata de terceros que guardan, sin la
 *   cuenta de imprevistos del plan ni las bloqueadas;
 * - plata de terceros (como préstamo sin interés);
 * - lo libre de la cuenta corriente principal.
 * Las tarjetas (con su cupo disponible) son para simular un avance en efectivo.
 * Lo que ahorras al mes es la meta de ahorro del plan.
 */
export async function getSimulatorData(projectId: string, userId: string): Promise<SimulatorData | null> {
  if (!(await verifyProjectAccess(projectId, userId))) return null;

  const [funds, savingsAccounts, otherAccounts, [project]] = await Promise.all([
    getAccountFunds(projectId),
    db
      .select({ id: accounts.id, name: accounts.name, balance: accounts.currentBalance })
      .from(accounts)
      .where(
        and(
          eq(accounts.projectId, projectId),
          eq(accounts.type, 'savings'),
          eq(accounts.isArchived, false),
          // Bloqueada: plata que de momento no se puede sacar
          eq(accounts.isLocked, false)
        )
      ),
    // Cuenta corriente principal y tarjetas (para el avance en efectivo)
    db
      .select({
        id: accounts.id,
        name: accounts.name,
        type: accounts.type,
        isDefault: accounts.isDefault,
        balance: accounts.currentBalance,
        creditLimit: accounts.creditLimit,
      })
      .from(accounts)
      .where(and(eq(accounts.projectId, projectId), eq(accounts.isArchived, false), eq(accounts.isLocked, false))),
    db
      .select({ savingsTarget: projects.savingsTarget, contingencyAccountId: projects.contingencyAccountId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1),
  ]);

  const thirdPartyByAccount = new Map<string, number>();
  const fundsByAccount = new Map<string, number>();
  for (const f of funds) {
    if (f.isThirdParty) thirdPartyByAccount.set(f.accountId, (thirdPartyByAccount.get(f.accountId) ?? 0) + f.balance);
    fundsByAccount.set(f.accountId, (fundsByAccount.get(f.accountId) ?? 0) + f.balance);
  }
  const main = otherAccounts.find((a) => a.type === 'checking' && a.isDefault);
  const mainFree = main ? Math.round(Number(main.balance)) - (fundsByAccount.get(main.id) ?? 0) : 0;

  const sources: Source[] = [
    // Lo libre de la cuenta corriente principal (saldo menos sus fondos)
    ...(main && mainFree > 0
      ? [{ id: main.id, kind: 'checking' as const, name: main.name, accountName: main.name, available: mainFree }]
      : []),
    ...funds
      .filter((f) => !f.isThirdParty && !f.isProvision && f.balance > 0)
      .map((f) => ({ id: f.id, kind: 'fund' as const, name: f.name, accountName: f.accountName, available: f.balance })),
    ...savingsAccounts
      .filter((a) => a.id !== project?.contingencyAccountId)
      .map((a) => {
        const own = Math.round(Number(a.balance)) - (thirdPartyByAccount.get(a.id) ?? 0);
        return { id: a.id, kind: 'savings' as const, name: a.name, accountName: a.name, available: own };
      })
      .filter((s) => s.available > 0),
    ...funds
      .filter((f) => f.isThirdParty && f.balance > 0)
      .map((f) => ({ id: f.id, kind: 'third_party' as const, name: f.name, accountName: f.accountName, available: f.balance })),
  ];

  const cards = otherAccounts
    .filter((a) => a.type === 'credit_card' && a.creditLimit != null)
    .map((a) => ({
      id: a.id,
      name: a.name,
      // La deuda de la tarjeta se guarda en positivo: disponible = cupo − deuda
      available: Math.max(0, Math.round(Number(a.creditLimit) - Math.abs(Number(a.balance)))),
    }));

  return {
    sources,
    cards,
    monthlySaving: project?.savingsTarget != null ? Math.round(Number(project.savingsTarget)) : 0,
  };
}

export type SavedSimulation = {
  id: string;
  name: string;
  target: number;
  plan: PlanInput & { optionId?: string };
  source: 'app' | 'claude';
  note: string | null;
  createdAt: string;
};

export async function getSimulations(projectId: string, userId: string): Promise<SavedSimulation[]> {
  if (!(await verifyProjectAccess(projectId, userId))) return [];
  const rows = await db
    .select()
    .from(simulations)
    .where(eq(simulations.projectId, projectId))
    .orderBy(desc(simulations.createdAt))
    .limit(30);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    target: Math.round(Number(r.target)),
    plan: r.plan as SavedSimulation['plan'],
    source: r.source === 'claude' ? 'claude' : 'app',
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }));
}
