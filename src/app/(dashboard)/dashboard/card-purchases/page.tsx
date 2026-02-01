import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getCardPurchases, getCardPurchasesSummary, getDebtCapacityReport } from '@/features/card-purchases/queries';
import { getAccounts } from '@/features/accounts/queries';
import { getCategories } from '@/features/categories/queries';
import { getEntities } from '@/features/entities/queries';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject } from '@/features/projects/queries';
import { CardPurchasesList } from '@/features/card-purchases';

export default async function CardPurchasesPage() {
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

  const [purchases, summary, debtCapacity, accounts, categories, entities] = await Promise.all([
    getCardPurchases(projectId, session.user.id),
    getCardPurchasesSummary(projectId, session.user.id),
    getDebtCapacityReport(projectId, session.user.id),
    getAccounts(session.user.id),
    getCategories(projectId, session.user.id),
    getEntities(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compras en Cuotas</h1>
        <p className="text-muted-foreground">
          Controla tus compras con tarjeta de crédito en cuotas y visualiza cuánto
          estás pagando en intereses.
        </p>
      </div>

      <CardPurchasesList
        purchases={purchases}
        summary={summary}
        debtCapacity={debtCapacity}
        accounts={accounts}
        categories={categories}
        entities={entities}
        projectId={projectId}
        userId={session.user.id}
      />
    </div>
  );
}
