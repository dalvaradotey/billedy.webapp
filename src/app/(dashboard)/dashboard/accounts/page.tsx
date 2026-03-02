import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getAccounts, getAccountsSummary, getAccountDebtBreakdown } from '@/features/accounts/queries';
import { getAllCurrencies } from '@/features/savings/queries';
import { getEntities } from '@/features/entities';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject } from '@/features/projects/queries';
import { AccountsList } from '@/features/accounts';

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

  const [accounts, summary, currencies, entities, debtBreakdown] = await Promise.all([
    getAccounts(projectId, session.user.id),
    getAccountsSummary(projectId, session.user.id),
    getAllCurrencies(),
    getEntities(),
    getAccountDebtBreakdown(projectId, session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cuentas</h1>
        <p className="text-muted-foreground">
          Administra tus cuentas bancarias, efectivo y tarjetas de crédito.
        </p>
      </div>

      <AccountsList
        accounts={accounts}
        summary={summary}
        projectId={projectId}
        userId={session.user.id}
        currencies={currencies.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
        entities={entities}
        debtBreakdown={debtBreakdown}
      />
    </div>
  );
}
