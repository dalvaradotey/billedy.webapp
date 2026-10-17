import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject } from '@/features/projects/queries';
import { InvestmentsView } from '@/features/investments/components/investments-view';

export default async function InvestmentsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  let projectId = await getCurrentProjectId();
  if (!projectId) {
    const latestProject = await getLatestProject(session.user.id);
    if (!latestProject) redirect('/dashboard');
    projectId = latestProject.id;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.035em]">Inversiones</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Cuánto pusiste, cuánto te ha retornado y el resultado de cada una.</p>
      </div>
      <InvestmentsView userId={session.user.id} projectId={projectId} />
    </div>
  );
}
