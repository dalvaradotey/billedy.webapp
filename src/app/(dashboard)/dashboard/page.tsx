import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { ArrowRight, CalendarDays, FolderPlus } from 'lucide-react';
import {
  getDashboardData,
  DashboardClientWrapper,
  DashboardBudgetsSection,
  PulseHome,
  CycleFlowCard,
  CycleHistoryCard,
  DashboardAccountsStrip,
} from '@/features/dashboard';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const data = await getDashboardData(session.user.id);
  const firstName = session.user.name?.split(' ')[0];

  if (!data.hasProject) {
    return (
      <div className="space-y-6">
        <h1 className="text-[28px] font-extrabold tracking-[-0.035em]">Hola, {firstName}</h1>
        <div className="rounded-[28px] border border-line bg-surface p-6 text-center md:p-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-jade-soft text-jade">
            <FolderPlus className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-xl font-extrabold">Crea tu primer proyecto</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Un proyecto agrupa tus finanzas por contexto: personal, familia, negocio.
            Usa el selector de proyecto para comenzar.
          </p>
        </div>
      </div>
    );
  }

  const {
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
    projectId,
    totalExternalDebt,
    cycleHistory,
    cardPace,
    dailySeries,
  } = data;

  return (
    <div className="space-y-6 md:space-y-4">
      <h1 className="sr-only">Inicio</h1>
      <DashboardClientWrapper
        budgetsProgress={budgetsProgress}
        cycle={currentCycle}
        accountsSummary={accountsSummary}
        totalExternalDebt={totalExternalDebt}
      >
        {!currentCycle && (
          <section className="rounded-[28px] border border-line bg-surface p-5 md:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-sky-soft text-sky">
                  <CalendarDays className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-lg font-extrabold">Hola {firstName}, comienza tu primer ciclo</h2>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Los ciclos ordenan tus finanzas por período de facturación: desde que te pagan hasta el siguiente pago.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/cycles"
                className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-jade px-5 text-sm font-extrabold text-jade-ink"
              >
                Crear mi primer ciclo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        )}

        {currentCycle && planStatus && (
          <PulseHome
            plan={planStatus}
            cardPace={cardPace}
            dailySeries={dailySeries}
            projectId={projectId}
            userId={session.user.id}
            isOwner={isOwner}
            savingsAccounts={accounts
              .filter((a) => a.type === 'savings' && !a.isArchived)
              .map((a) => ({ id: a.id, name: a.name }))}
            savingsTargetValue={project?.savingsTarget != null ? Math.round(Number(project.savingsTarget)) : null}
            cardSpendingCapValue={project?.cardSpendingCap != null ? Math.round(Number(project.cardSpendingCap)) : null}
          />
        )}

        {currentCycle && (
          <div className="grid gap-6 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-4">
            <DashboardBudgetsSection
              categories={categories}
              accounts={accounts}
              budgets={budgets}
              savingsGoals={savingsGoals}
              entities={allEntities}
              projectId={projectId}
              userId={session.user.id}
              defaultCurrency={project?.currency ?? 'USD'}
            />
            <div className="flex flex-col gap-4">
              <CycleFlowCard />
              <CycleHistoryCard history={cycleHistory} />
            </div>
          </div>
        )}

        {isOwner && accountsSummary.totalAccounts > 0 && <DashboardAccountsStrip />}
      </DashboardClientWrapper>
    </div>
  );
}
