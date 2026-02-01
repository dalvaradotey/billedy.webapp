import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAllEntities } from '@/features/entities';
import { EntitiesList } from './entities-list';

export default async function EntitiesAdminPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const entities = await getAllEntities();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestión de Entidades</h1>
        <p className="text-muted-foreground">
          Administra las entidades globales (bancos, supermercados, etc.)
        </p>
      </div>

      <EntitiesList entities={entities} userId={session.user.id} />
    </div>
  );
}
