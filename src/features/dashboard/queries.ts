import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject, getProjectById } from '@/features/projects/queries';
import { getCurrentCycle, getCycleHistory } from '@/features/billing-cycles/queries';
import { getCyclePlanStatus, getCardPaceSeries, getCycleDailySeries } from '@/features/billing-cycles/lib/cycle-plan';
import { getAccountsSummaryWithAccounts, getAccountDebtBreakdown } from '@/features/accounts/queries';
import { getBudgetsProgress, getActiveBudgets } from '@/features/budgets';
import { getActiveCategories } from '@/features/categories/queries';
import { getActiveSavingsGoals } from '@/features/savings/queries';
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
  const [currentCycle, accountsData, project, categories, budgets, savingsGoals, allEntities, debtBreakdown, cycleHistory] = await Promise.all([
    getCurrentCycle(projectId, userId),
    getAccountsSummaryWithAccounts(projectId, userId),
    getProjectById(projectId, userId),
    getActiveCategories(projectId, userId),
    getActiveBudgets(projectId, userId),
    getActiveSavingsGoals(userId, projectId),
    getEntities(),
    getAccountDebtBreakdown(projectId, userId),
    getCycleHistory(projectId, userId),
  ]);

  const { summary: accountsSummary, accounts } = accountsData;
  const isOwner = project?.userId === userId;
  const totalExternalDebt = Object.values(debtBreakdown).reduce((sum, d) => sum + d.externalDebt, 0);

  // Con ciclo activo: progreso de presupuestos, plan del ciclo (techo TC, ahorro, libre)
  // y las series del inicio, todo en paralelo. El ritmo usa el mismo gasto propio
  // comprometido que el plan (card.own.committed), así no espera al plan.
  const [budgetsProgress, planStatus, cardPace, dailySeries] = currentCycle
    ? await Promise.all([
        getBudgetsProgress(projectId, userId, new Date(currentCycle.startDate), new Date(currentCycle.endDate)),
        getCyclePlanStatus(currentCycle),
        getCardPaceSeries(currentCycle, currentCycle.balance.card.own.committed),
        getCycleDailySeries(currentCycle),
      ])
    : [[], null, null, null];

  return {
    hasProject: true as const,
    projectId,
    currentCycle,
    accountsSummary,
    accounts,
    project,
    categories,
    budgets,
    savingsGoals,
    allEntities,
    isOwner,
    budgetsProgress,
    planStatus,
    totalExternalDebt,
    cycleHistory,
    cardPace,
    dailySeries,
  };
}
