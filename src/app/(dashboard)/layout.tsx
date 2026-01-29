import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { DashboardHeader } from '@/components/layout/dashboard-header';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DashboardHeader user={session.user} />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
