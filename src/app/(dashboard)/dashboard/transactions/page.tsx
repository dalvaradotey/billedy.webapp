import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getTransactions, getTransactionSummary } from '@/features/transactions/queries';
import { getActiveCategories } from '@/features/categories/queries';
import { getAccounts } from '@/features/accounts/queries';
import { getActiveBudgets } from '@/features/budgets/queries';
import { getEntities } from '@/features/entities/queries';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject, getProjectById } from '@/features/projects/queries';
import { getBillingCycles } from '@/features/billing-cycles/queries';
import { TransactionList } from '@/features/transactions/components';
import type { TransactionFilters } from '@/features/transactions/types';

interface TransactionsPageProps {
  searchParams: Promise<{
    type?: string;
    category?: string;
    paid?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    cycleId?: string;
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

  // Obtener ciclos de facturación
  const cycles = await getBillingCycles(projectId, session.user.id);
  const hasCycles = cycles.length > 0;

  // Encontrar ciclo actual (abierto) o el seleccionado por parámetro
  let selectedCycle = params.cycleId
    ? cycles.find((c) => c.id === params.cycleId)
    : cycles.find((c) => c.status === 'open');

  // Si no hay ciclo abierto pero hay ciclos, usar el más reciente
  if (!selectedCycle && hasCycles) {
    selectedCycle = cycles[0];
  }

  // Calcular fechas por defecto
  let defaultStartDate: string;
  let defaultEndDate: string;

  if (params.startDate && params.endDate) {
    // Usuario especificó fechas manualmente
    defaultStartDate = params.startDate;
    defaultEndDate = params.endDate;
  } else if (selectedCycle) {
    // Usar fechas del ciclo seleccionado
    defaultStartDate = new Date(selectedCycle.startDate).toISOString().split('T')[0];
    defaultEndDate = new Date(selectedCycle.endDate).toISOString().split('T')[0];
  } else {
    // Sin ciclos: últimos 30 días
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    defaultStartDate = thirtyDaysAgo.toISOString().split('T')[0];
    defaultEndDate = today.toISOString().split('T')[0];
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

  // Aplicar filtros de fecha
  filters.startDate = new Date(defaultStartDate + 'T00:00:00');
  filters.endDate = new Date(defaultEndDate + 'T23:59:59');

  // Cargar datos en paralelo
  const [transactions, summary, categories, accounts, budgets, entities, project] = await Promise.all([
    getTransactions(projectId, session.user.id, filters),
    getTransactionSummary(projectId, session.user.id),
    getActiveCategories(projectId, session.user.id),
    getAccounts(session.user.id),
    getActiveBudgets(projectId, session.user.id),
    getEntities(),
    getProjectById(projectId, session.user.id),
  ]);

  const defaultCurrency = project?.currency ?? 'CLP';

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
        accounts={accounts}
        budgets={budgets}
        entities={entities}
        summary={summary}
        projectId={projectId}
        userId={session.user.id}
        defaultCurrency={defaultCurrency}
        defaultStartDate={defaultStartDate}
        defaultEndDate={defaultEndDate}
        cycles={cycles.map((c) => ({
          id: c.id,
          name: c.name,
          startDate: new Date(c.startDate).toISOString().split('T')[0],
          endDate: new Date(c.endDate).toISOString().split('T')[0],
          status: c.status,
        }))}
        selectedCycleId={selectedCycle?.id}
      />
    </div>
  );
}
