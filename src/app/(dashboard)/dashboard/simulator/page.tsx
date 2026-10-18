import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject } from '@/features/projects/queries';
import { getSimulations, getSimulatorData } from '@/features/simulator/queries';
import { SimulatorView } from '@/features/simulator/components/simulator-view';

export default async function SimulatorPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  let projectId = await getCurrentProjectId();
  if (!projectId) {
    const latestProject = await getLatestProject(session.user.id);
    if (!latestProject) redirect('/dashboard');
    projectId = latestProject.id;
  }

  const [data, saved] = await Promise.all([
    getSimulatorData(projectId, session.user.id),
    getSimulations(projectId, session.user.id),
  ]);
  if (!data) redirect('/dashboard');

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.035em]">¿Me alcanza?</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Dime qué quieres hacer y cuánto cuesta: te muestro cómo juntarlo y cómo reponerlo.</p>
      </div>
      <SimulatorView userId={session.user.id} projectId={projectId} data={data} saved={saved} />
    </div>
  );
}
