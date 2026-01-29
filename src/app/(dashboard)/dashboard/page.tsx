import { auth } from '@/lib/auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Hola, {session?.user?.name?.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground">
          Aquí está el resumen de tus finanzas este mes.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">$0</div>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">$0</div>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0</div>
            <p className="text-xs text-muted-foreground">Disponible</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ahorros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">$0</div>
            <p className="text-xs text-muted-foreground">Total acumulado</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Transacciones Recientes</CardTitle>
            <CardDescription>
              Tus últimos movimientos financieros
            </CardDescription>
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
            <CardDescription>Estado de tus presupuestos del mes</CardDescription>
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
