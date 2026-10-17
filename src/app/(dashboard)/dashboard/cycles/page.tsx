import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  getBillingCycles,
  summarizeBillingCycles,
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
  const [cycles, suggestedDates] = await Promise.all([
    getBillingCycles(projectId, session.user.id),
    suggestNextCycleDates(projectId, session.user.id),
  ]);
  const summary = summarizeBillingCycles(cycles);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.035em]">Ciclos</h1>
        <p className="mt-0.5 hidden text-[13px] text-muted-foreground md:block">Organiza tus finanzas por períodos de facturación.</p>
      </div>

      <BillingCyclesList
        cycles={cycles}
        summary={summary}
        projectId={projectId}
        suggestedDates={suggestedDates}
      />
    </div>
  );
}
