import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getTemplatesWithItems, getTemplatesSummary } from '@/features/templates/queries';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject, getProjectById } from '@/features/projects/queries';
import { getActiveCategories } from '@/features/categories/queries';
import { getAccounts } from '@/features/accounts/queries';
import { getEntities } from '@/features/entities/queries';
import { TemplateList } from '@/features/templates/components';

interface TemplatesPageProps {
  searchParams: Promise<{
    archived?: string;
  }>;
}

export default async function TemplatesPage({ searchParams }: TemplatesPageProps) {
  const session = await auth();
  const params = await searchParams;

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

  const showArchived = params.archived === 'true';

  // Cargar datos en paralelo
  const [templates, summary, categories, accounts, entities, project] = await Promise.all([
    getTemplatesWithItems(projectId, session.user.id, showArchived),
    getTemplatesSummary(projectId, session.user.id),
    getActiveCategories(projectId, session.user.id),
    getAccounts(session.user.id),
    getEntities(),
    getProjectById(projectId, session.user.id),
  ]);

  const baseCurrency = project?.currency ?? 'CLP';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Plantillas</h1>
        <p className="text-muted-foreground">
          Configura los items recurrentes que se cargarán automáticamente en cada ciclo.
        </p>
      </div>

      <TemplateList
        templates={templates}
        categories={categories}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        entities={entities}
        summary={summary}
        projectId={projectId}
        userId={session.user.id}
        baseCurrency={baseCurrency}
        showArchived={showArchived}
      />
    </div>
  );
}
