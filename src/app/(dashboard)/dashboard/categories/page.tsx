import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getCategories, getCategoriesGrouped } from '@/features/categories/queries';
import { CategoryList } from '@/features/categories/components';

interface CategoriesPageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;
  const showArchived = params.view === 'archived';

  const [categories, groupedCategories] = await Promise.all([
    getCategories(session.user.id),
    getCategoriesGrouped(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Categorías</h1>
        <p className="text-muted-foreground">
          Administra las categorías para organizar tus ingresos y gastos.
        </p>
      </div>

      <div className="flex gap-2 border-b">
        <TabLink href="/dashboard/categories" active={!showArchived}>
          Activas
        </TabLink>
        <TabLink href="/dashboard/categories?view=archived" active={showArchived}>
          Archivadas
        </TabLink>
      </div>

      <CategoryList
        categories={categories}
        groupedCategories={groupedCategories}
        userId={session.user.id}
        showArchived={showArchived}
      />
    </div>
  );
}

interface TabLinkProps {
  href: string;
  active: boolean;
  children: React.ReactNode;
}

function TabLink({ href, active, children }: TabLinkProps) {
  return (
    <a
      href={href}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </a>
  );
}
