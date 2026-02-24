import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { ArrowRight, CalendarDays, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject, getProjectById } from '@/features/projects/queries';
import { getCurrentCycle } from '@/features/billing-cycles/queries';
import { getAccountsSummaryWithAccounts } from '@/features/accounts/queries';
import { getBudgetsProgress, getActiveBudgets } from '@/features/budgets';
import { getActiveCategories } from '@/features/categories/queries';
import { getEntities } from '@/features/entities/queries';
import { DashboardClientWrapper } from './dashboard-client-wrapper';
import { DashboardBudgetsSection } from './dashboard-budgets-section';
import { DashboardCycleBanner } from './dashboard-cycle-banner';
import { DashboardAccountsBanner } from './dashboard-accounts-banner';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Obtener proyecto actual
  let projectId = await getCurrentProjectId();
  if (!projectId) {
    const latestProject = await getLatestProject(session.user.id);
    if (!latestProject) {
      // No hay proyectos, mostrar estado vacío
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Hola, {session.user.name?.split(' ')[0]}
            </h1>
            <p className="text-muted-foreground">Bienvenido a Billedy.</p>
          </div>

          <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-cyan-950/40 p-6 md:p-8">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 blur-2xl" />
            <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-32 w-32 rounded-full bg-gradient-to-tr from-teal-400/20 to-emerald-400/20 blur-2xl" />

            <div className="relative text-center space-y-4 py-4">
              <div className="mx-auto rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white shadow-lg shadow-emerald-500/25 w-fit">
                <Sparkles className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-xl">Crea tu primer proyecto</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Un proyecto agrupa tus finanzas por contexto: personal, familia, negocio.
                  Usa el selector en la barra superior para comenzar.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }
    projectId = latestProject.id;
  }

  // Obtener ciclo actual, proyecto y datos maestros para el formulario de transacciones
  // Nota: getAccountsSummaryWithAccounts retorna summary + accounts en una sola llamada (optimización)
  const [currentCycle, accountsData, project, categories, budgets, allEntities] = await Promise.all([
    getCurrentCycle(projectId, session.user.id),
    getAccountsSummaryWithAccounts(projectId, session.user.id),
    getProjectById(projectId, session.user.id),
    getActiveCategories(projectId, session.user.id),
    getActiveBudgets(projectId, session.user.id),
    getEntities(),
  ]);

  const { summary: accountsSummary, accounts } = accountsData;

  const isOwner = project?.userId === session.user.id;

  // Obtener progreso de presupuestos si hay ciclo activo
  const budgetsProgress = currentCycle
    ? await getBudgetsProgress(
        projectId,
        session.user.id,
        new Date(currentCycle.startDate),
        new Date(currentCycle.endDate)
      )
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Hola, {session.user.name?.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground">
          {currentCycle
            ? `Resumen de ${currentCycle.name}`
            : 'Aquí está el resumen de tus finanzas.'}
        </p>
      </div>

      {/* Contenido dinámico con actualizaciones optimistas */}
      <DashboardClientWrapper
        budgetsProgress={budgetsProgress}
        cycle={currentCycle}
        accountsSummary={accountsSummary}
      >
        {/* Banner de resumen de cuentas - Solo para el dueño del proyecto */}
        {isOwner && accountsSummary.totalAccounts > 0 && <DashboardAccountsBanner />}

        {/* Banner si no hay ciclo activo */}
        {!currentCycle && (
          <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-violet-950/40 p-6 md:p-8">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-gradient-to-br from-blue-400/20 to-violet-400/20 blur-2xl" />
            <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-32 w-32 rounded-full bg-gradient-to-tr from-indigo-400/20 to-blue-400/20 blur-2xl" />

            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-3 text-white shadow-lg shadow-blue-500/25">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">Comienza tu primer ciclo</h3>
                    <Sparkles className="h-4 w-4 text-amber-500" />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Los ciclos te permiten organizar tus finanzas por períodos.
                    Define cuándo empieza y termina cada período de facturación.
                  </p>
                </div>
              </div>

              <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 w-full md:w-auto">
                <Link href="/dashboard/cycles">
                  Crear mi primer ciclo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Banner de resumen del ciclo */}
        {currentCycle && <DashboardCycleBanner />}

        {/* Slider de presupuestos con drawer de transacciones */}
        {currentCycle && (
          <DashboardBudgetsSection
            categories={categories}
            accounts={accounts}
            budgets={budgets}
            entities={allEntities}
            projectId={projectId}
            userId={session.user.id}
            defaultCurrency={project?.currency ?? 'USD'}
          />
        )}
      </DashboardClientWrapper>
    </div>
  );
}
