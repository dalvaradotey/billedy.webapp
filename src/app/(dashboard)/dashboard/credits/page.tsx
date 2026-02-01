import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  getCreditsWithProgress,
  getCreditsSummary,
} from '@/features/credits/queries';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject } from '@/features/projects/queries';
import { getActiveCategories } from '@/features/categories/queries';
import { getEntities } from '@/features/entities/queries';
import { getAccounts } from '@/features/accounts/queries';
import { CreditList } from '@/features/credits/components';

interface CreditsPageProps {
  searchParams: Promise<{
    archived?: string;
  }>;
}

export default async function CreditsPage({ searchParams }: CreditsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;

  // Obtener proyecto actual
  let projectId = await getCurrentProjectId();
  if (!projectId) {
    const latestProject = await getLatestProject(session.user.id);
    if (!latestProject) {
      redirect('/dashboard');
    }
    projectId = latestProject.id;
  }

  const showArchived = params.archived === 'true';

  // Cargar datos en paralelo
  const [credits, summary, categories, entities, accounts] = await Promise.all([
    getCreditsWithProgress(projectId, session.user.id, showArchived),
    getCreditsSummary(projectId, session.user.id),
    getActiveCategories(projectId, session.user.id),
    getEntities(),
    getAccounts(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Créditos</h1>
        <p className="text-muted-foreground">
          Administra tus préstamos y pagos en cuotas.
        </p>
      </div>

      <CreditList
        credits={credits}
        categories={categories}
        entities={entities}
        accounts={accounts}
        summary={summary}
        projectId={projectId}
        userId={session.user.id}
        showArchived={showArchived}
      />
    </div>
  );
}
