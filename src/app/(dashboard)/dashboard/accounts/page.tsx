import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getAccounts, getAccountsSummary, getAccountDebtBreakdown } from '@/features/accounts/queries';
import { getAllCurrencies } from '@/features/savings/queries';
import { getEntities } from '@/features/entities';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject } from '@/features/projects/queries';
import { AccountsList } from '@/features/accounts';
import { getAccountFundsForUser } from '@/features/accounts/lib/funds';

export default async function AccountsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Obtener proyecto actual
  let projectId = await getCurrentProjectId();
  if (!projectId) {
    const latestProject = await getLatestProject(session.user.id);
    if (!latestProject) {
      redirect('/dashboard');
    }
    projectId = latestProject.id;
  }

  const [accounts, summary, currencies, entities, debtBreakdown, funds] = await Promise.all([
    getAccounts(projectId, session.user.id),
    getAccountsSummary(projectId, session.user.id),
    getAllCurrencies(),
    getEntities(),
    getAccountDebtBreakdown(projectId, session.user.id),
    getAccountFundsForUser(projectId, session.user.id),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-[28px] font-extrabold tracking-[-0.035em]">Cuentas</h1>

      <AccountsList
        accounts={accounts}
        summary={summary}
        projectId={projectId}
        userId={session.user.id}
        currencies={currencies.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
        entities={entities}
        debtBreakdown={debtBreakdown}
        funds={funds}
      />
    </div>
  );
}
