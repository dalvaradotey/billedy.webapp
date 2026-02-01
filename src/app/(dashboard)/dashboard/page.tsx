import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { ArrowRight, CalendarDays, Sparkles, Wallet, Building2, PiggyBank, CreditCard } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getCurrentProjectId } from '@/features/projects/actions';
import { getLatestProject } from '@/features/projects/queries';
import { getCurrentCycle } from '@/features/billing-cycles/queries';
import { getAccounts, getAccountsSummary } from '@/features/accounts/queries';
import type { AccountType } from '@/features/accounts/types';
import { ACCOUNT_TYPE_LABELS } from '@/features/accounts/types';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const AccountTypeIcon = ({ type, className }: { type: AccountType; className?: string }) => {
  const icons = {
    checking: Building2,
    savings: PiggyBank,
    cash: Wallet,
    credit_card: CreditCard,
  };
  const Icon = icons[type];
  return <Icon className={className} />;
};

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

  // Obtener ciclo actual y cuentas
  const [currentCycle, accounts, accountsSummary] = await Promise.all([
    getCurrentCycle(projectId, session.user.id),
    getAccounts(session.user.id),
    getAccountsSummary(session.user.id),
  ]);

  const progressPercentage = currentCycle
    ? Math.round((currentCycle.daysElapsed / currentCycle.daysTotal) * 100)
    : 0;

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

      {/* Progreso del ciclo */}
      {currentCycle && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{currentCycle.name}</CardTitle>
              <Link
                href="/dashboard/cycles"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Ver ciclos
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={progressPercentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{currentCycle.daysElapsed} días transcurridos</span>
              <span>{currentCycle.daysRemaining} días restantes</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de resumen */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(currentCycle?.currentIncome ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentCycle ? 'Este ciclo' : 'Sin ciclo activo'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(currentCycle?.currentExpenses ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentCycle ? 'Este ciclo' : 'Sin ciclo activo'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ahorro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(currentCycle?.currentSavings ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentCycle ? 'Este ciclo' : 'Sin ciclo activo'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                (currentCycle?.currentBalance ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatCurrency(currentCycle?.currentBalance ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">Disponible</p>
          </CardContent>
        </Card>
      </div>

      {/* Cuentas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Mis Cuentas</CardTitle>
            <CardDescription>Saldo actual de tus cuentas</CardDescription>
          </div>
          <Link
            href="/dashboard/accounts"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            Ver todas <ArrowRight className="h-4 w-4" />
          </Link>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-6 space-y-3">
              <Wallet className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <div>
                <p className="text-sm text-muted-foreground">No tienes cuentas registradas</p>
                <Button asChild variant="link" size="sm" className="mt-1">
                  <Link href="/dashboard/accounts">Crear mi primera cuenta</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 pb-4 border-b">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Disponible</p>
                  <p className="text-lg font-semibold text-green-600">
                    {formatCurrency(accountsSummary.totalDebitBalance)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Deuda TC</p>
                  <p className="text-lg font-semibold text-red-600">
                    {formatCurrency(accountsSummary.totalCreditBalance)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Patrimonio</p>
                  <p className={`text-lg font-semibold ${accountsSummary.netWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(accountsSummary.netWorth)}
                  </p>
                </div>
              </div>

              {/* Account list */}
              <div className="space-y-2">
                {accounts.slice(0, 4).map((account) => {
                  const balance = parseFloat(account.currentBalance);
                  const isCredit = account.type === 'credit_card';
                  return (
                    <div
                      key={account.id}
                      className="flex items-center justify-between py-2"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            isCredit
                              ? 'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400'
                              : 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                          }`}
                        >
                          <AccountTypeIcon type={account.type as AccountType} className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{account.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {ACCOUNT_TYPE_LABELS[account.type as AccountType]}
                          </p>
                        </div>
                      </div>
                      <p
                        className={`font-semibold ${
                          isCredit
                            ? balance > 0
                              ? 'text-red-600'
                              : 'text-muted-foreground'
                            : balance >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                        }`}
                      >
                        {isCredit && balance > 0 && '-'}
                        {formatCurrency(Math.abs(balance))}
                      </p>
                    </div>
                  );
                })}
                {accounts.length > 4 && (
                  <Button asChild variant="ghost" size="sm" className="w-full">
                    <Link href="/dashboard/accounts">
                      Ver {accounts.length - 4} cuentas más
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Transacciones Recientes</CardTitle>
            <CardDescription>Tus últimos movimientos financieros</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay transacciones registradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Presupuestos</CardTitle>
            <CardDescription>Estado de tus presupuestos del ciclo</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay presupuestos configurados
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
