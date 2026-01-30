import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  getSavingsFundsWithProgress,
  getSavingsSummary,
  getAllCurrencies,
} from '@/features/savings/queries';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject } from '@/features/projects/queries';
import { SavingsList } from '@/features/savings/components';

interface SavingsPageProps {
  searchParams: Promise<{
    archived?: string;
  }>;
}

export default async function SavingsPage({ searchParams }: SavingsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;

  // Obtener proyecto actual (opcional para savings, ya que son por usuario)
  let projectId = await getCurrentProjectId();
  if (!projectId) {
    const latestProject = await getLatestProject(session.user.id);
    if (latestProject) {
      projectId = latestProject.id;
    }
  }

  const showArchived = params.archived === 'true';

  // Cargar datos en paralelo
  const [funds, summary, currencies] = await Promise.all([
    getSavingsFundsWithProgress(session.user.id, undefined, showArchived),
    getSavingsSummary(session.user.id),
    getAllCurrencies(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ahorros</h1>
        <p className="text-muted-foreground">
          Administra tus fondos de ahorro y alcanza tus metas financieras.
        </p>
      </div>

      <SavingsList
        funds={funds}
        currencies={currencies}
        summary={summary}
        projectId={projectId ?? undefined}
        userId={session.user.id}
        showArchived={showArchived}
      />
    </div>
  );
}
