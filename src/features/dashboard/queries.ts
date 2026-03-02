import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject, getProjectById } from '@/features/projects/queries';
import { getCurrentCycle } from '@/features/billing-cycles/queries';
import { getAccountsSummaryWithAccounts, getAccountDebtBreakdown } from '@/features/accounts/queries';
import { getBudgetsProgress, getActiveBudgets } from '@/features/budgets';
import { getActiveCategories } from '@/features/categories/queries';
import { getEntities } from '@/features/entities/queries';

export async function getDashboardData(userId: string) {
  // Obtener proyecto actual
  let projectId = await getCurrentProjectId();
  if (!projectId) {
    const latestProject = await getLatestProject(userId);
    if (!latestProject) {
      return { hasProject: false as const };
    }
    projectId = latestProject.id;
  }

  // Obtener datos principales en paralelo
  const [currentCycle, accountsData, project, categories, budgets, allEntities, debtBreakdown] = await Promise.all([
    getCurrentCycle(projectId, userId),
    getAccountsSummaryWithAccounts(projectId, userId),
    getProjectById(projectId, userId),
    getActiveCategories(projectId, userId),
    getActiveBudgets(projectId, userId),
    getEntities(),
    getAccountDebtBreakdown(projectId, userId),
  ]);

  const { summary: accountsSummary, accounts } = accountsData;
  const isOwner = project?.userId === userId;
  const totalExternalDebt = Object.values(debtBreakdown).reduce((sum, d) => sum + d.externalDebt, 0);

  // Obtener progreso de presupuestos si hay ciclo activo
  const budgetsProgress = currentCycle
    ? await getBudgetsProgress(
        projectId,
        userId,
        new Date(currentCycle.startDate),
        new Date(currentCycle.endDate)
      )
    : [];

  return {
    hasProject: true as const,
    projectId,
    currentCycle,
    accountsSummary,
    accounts,
    project,
    categories,
    budgets,
    allEntities,
    isOwner,
    budgetsProgress,
    totalExternalDebt,
  };
}
