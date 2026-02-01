import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  getBillingCycles,
  getBillingCyclesSummary,
  suggestNextCycleDates,
} from '@/features/billing-cycles/queries';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject } from '@/features/projects/queries';
import { BillingCyclesList } from '@/features/billing-cycles/components';

export default async function CyclesPage() {
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
  const [cycles, summary, suggestedDates] = await Promise.all([
    getBillingCycles(projectId, session.user.id),
    getBillingCyclesSummary(projectId, session.user.id),
    suggestNextCycleDates(projectId, session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ciclos de Facturación</h1>
        <p className="text-muted-foreground">
          Organiza tus finanzas por períodos de facturación.
        </p>
      </div>

      <BillingCyclesList
        cycles={cycles}
        summary={summary}
        projectId={projectId}
        userId={session.user.id}
        suggestedDates={suggestedDates}
      />
    </div>
  );
}
