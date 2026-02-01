import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getBudgetsWithCategory, getProjectCategories } from '@/features/budgets/queries';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject, getProjectById } from '@/features/projects/queries';
import { getAllCurrencies } from '@/features/savings/queries';
import { BudgetList } from '@/features/budgets/components';

export default async function BudgetsPage() {
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
  const [budgets, categories, currencies, project] = await Promise.all([
    getBudgetsWithCategory(projectId, session.user.id),
    getProjectCategories(projectId, session.user.id),
    getAllCurrencies(),
    getProjectById(projectId, session.user.id),
  ]);

  const defaultCurrency = project?.currency ?? 'CLP';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Presupuestos</h1>
        <p className="text-muted-foreground">
          Define plantillas de presupuesto para asignar a cada ciclo de facturación.
        </p>
      </div>

      <BudgetList
        budgets={budgets}
        categories={categories}
        currencies={currencies.map((c) => ({ code: c.code, name: c.name }))}
        projectId={projectId}
        userId={session.user.id}
        defaultCurrency={defaultCurrency}
      />
    </div>
  );
}
