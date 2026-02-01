import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getAccounts, getAccountsSummary } from '@/features/accounts/queries';
import { getAllCurrencies } from '@/features/savings/queries';
import { getEntities } from '@/features/entities';
import { AccountsList } from '@/features/accounts';

export default async function AccountsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const [accounts, summary, currencies, entities] = await Promise.all([
    getAccounts(session.user.id),
    getAccountsSummary(session.user.id),
    getAllCurrencies(),
    getEntities(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cuentas</h1>
        <p className="text-muted-foreground">
          Administra tus cuentas bancarias, efectivo y tarjetas de crédito.
        </p>
      </div>

      <AccountsList
        accounts={accounts}
        summary={summary}
        userId={session.user.id}
        currencies={currencies.map((c) => ({ id: c.id, code: c.code, name: c.name }))}
        entities={entities}
      />
    </div>
  );
}
