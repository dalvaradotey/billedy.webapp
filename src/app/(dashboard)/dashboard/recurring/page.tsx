import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getRecurringItems, getRecurringItemsSummary } from '@/features/recurring-items/queries';
import { getActiveCategories } from '@/features/categories/queries';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject } from '@/features/projects/queries';
import { RecurringItemList } from '@/features/recurring-items/components';

export default async function RecurringPage() {
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

  // Cargar datos en paralelo
  const [items, summary, categories] = await Promise.all([
    getRecurringItems(projectId, session.user.id),
    getRecurringItemsSummary(projectId, session.user.id),
    getActiveCategories(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gastos Fijos</h1>
        <p className="text-muted-foreground">
          Configura los ingresos y gastos que se repiten cada mes.
        </p>
      </div>

      <RecurringItemList
        items={items}
        categories={categories}
        summary={summary}
        projectId={projectId}
        userId={session.user.id}
      />
    </div>
  );
}
