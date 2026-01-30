import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getTransactions, getTransactionSummary } from '@/features/transactions/queries';
import { getActiveCategories } from '@/features/categories/queries';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject } from '@/features/projects/queries';
import { TransactionList } from '@/features/transactions/components';
import type { TransactionFilters } from '@/features/transactions/types';

interface TransactionsPageProps {
  searchParams: Promise<{
    type?: string;
    category?: string;
    paid?: string;
    search?: string;
  }>;
}

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;

  // Obtener proyecto actual
  let projectId = await getCurrentProjectId();
  if (!projectId) {
    const latestProject = await getLatestProject(session.user.id);
    if (!latestProject) {
      redirect('/dashboard');
    }
    projectId = latestProject.id;
  }

  // Construir filtros desde searchParams
  const filters: TransactionFilters = {};

  if (params.type === 'income' || params.type === 'expense') {
    filters.type = params.type;
  }

  if (params.category) {
    filters.categoryId = params.category;
  }

  if (params.paid === 'true') {
    filters.isPaid = true;
  } else if (params.paid === 'false') {
    filters.isPaid = false;
  }

  if (params.search) {
    filters.search = params.search;
  }

  // Cargar datos en paralelo
  const [transactions, summary, categories] = await Promise.all([
    getTransactions(projectId, session.user.id, filters),
    getTransactionSummary(projectId, session.user.id),
    getActiveCategories(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transacciones</h1>
        <p className="text-muted-foreground">
          Administra tus ingresos y gastos del período.
        </p>
      </div>

      <TransactionList
        transactions={transactions}
        categories={categories}
        summary={summary}
        projectId={projectId}
        userId={session.user.id}
      />
    </div>
  );
}
