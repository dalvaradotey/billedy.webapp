import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  getBudgetsWithProgress,
  getBudgetSummary,
  getCategoriesWithoutBudget,
} from '@/features/budgets/queries';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject } from '@/features/projects/queries';
import { BudgetList } from '@/features/budgets/components';
import type { BudgetPeriod } from '@/features/budgets/types';

interface BudgetsPageProps {
  searchParams: Promise<{
    year?: string;
    month?: string;
  }>;
}

export default async function BudgetsPage({ searchParams }: BudgetsPageProps) {
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

  // Determinar período (mes actual por defecto)
  const now = new Date();
  const period: BudgetPeriod = {
    year: params.year ? parseInt(params.year) : now.getFullYear(),
    month: params.month ? parseInt(params.month) : now.getMonth() + 1,
  };

  // Cargar datos en paralelo
  const [budgets, summary, categoriesWithoutBudget] = await Promise.all([
    getBudgetsWithProgress(projectId, session.user.id, period),
    getBudgetSummary(projectId, session.user.id, period),
    getCategoriesWithoutBudget(projectId, session.user.id, period),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Presupuestos</h1>
        <p className="text-muted-foreground">
          Controla tus límites de gasto por categoría.
        </p>
      </div>

      <BudgetList
        budgets={budgets}
        categoriesWithoutBudget={categoriesWithoutBudget}
        summary={summary}
        projectId={projectId}
        userId={session.user.id}
        period={period}
      />
    </div>
  );
}
