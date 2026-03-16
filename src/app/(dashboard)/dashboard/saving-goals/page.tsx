import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  getSavingsGoalsWithProgress,
  getSavingsSummary,
  getAllCurrencies,
} from '@/features/savings/queries';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject } from '@/features/projects/queries';
import { SavingsList } from '@/features/savings/components';
import type { SavingsFilter } from '@/features/savings/types';

interface SavingsPageProps {
  searchParams: Promise<{
    filter?: string;
  }>;
}

export default async function SavingsPage({ searchParams }: SavingsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;

  let projectId = await getCurrentProjectId();
  if (!projectId) {
    const latestProject = await getLatestProject(session.user.id);
    if (latestProject) {
      projectId = latestProject.id;
    }
  }

  const validFilters: SavingsFilter[] = ['active', 'completed', 'archived'];
  const filter: SavingsFilter = validFilters.includes(params.filter as SavingsFilter)
    ? (params.filter as SavingsFilter)
    : 'active';

  const [goals, summary, currencies] = await Promise.all([
    getSavingsGoalsWithProgress(session.user.id, undefined, filter),
    getSavingsSummary(session.user.id),
    getAllCurrencies(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Metas de ahorro</h1>
        <p className="text-muted-foreground">
          Administra tus metas de ahorro y alcanza tus objetivos financieros.
        </p>
      </div>

      <SavingsList
        goals={goals}
        currencies={currencies}
        summary={summary}
        projectId={projectId ?? undefined}
        userId={session.user.id}
        filter={filter}
      />
    </div>
  );
}
