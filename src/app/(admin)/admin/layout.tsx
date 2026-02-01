import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isUserAdmin } from '@/features/entities';
import Link from 'next/link';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const isAdmin = await isUserAdmin(session.user.id);

  if (!isAdmin) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-bold text-xl">
              Billedy
            </Link>
            <span className="text-sm text-muted-foreground">Admin</span>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/admin/entities"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Entidades
              </Link>
            </nav>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Volver al dashboard
          </Link>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
