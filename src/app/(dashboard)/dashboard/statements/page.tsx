import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject } from '@/features/projects/queries';
import { getActiveBudgets } from '@/features/budgets/queries';
import { StatementReconcile } from '@/features/statements/components/statement-reconcile';

export default async function StatementsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  let projectId = await getCurrentProjectId();
  if (!projectId) {
    const latestProject = await getLatestProject(session.user.id);
    if (!latestProject) redirect('/dashboard');
    projectId = latestProject.id;
  }

  const budgets = await getActiveBudgets(projectId, session.user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.035em]">Conciliar tarjeta</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Sube el estado de cuenta y revisa solo lo que no calza con tus movimientos.
        </p>
      </div>
      <StatementReconcile
        userId={session.user.id}
        projectId={projectId}
        budgets={budgets.map((b) => ({ id: b.id, name: b.name, categoryId: b.categoryId }))}
      />
    </div>
  );
}
