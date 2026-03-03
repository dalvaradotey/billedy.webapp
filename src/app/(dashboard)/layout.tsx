import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { NoProjectsMessage } from '@/components/layout/no-projects-message';
import {
  getActiveProjects,
  getCurrentProjectId,
  getLatestProject,
  getCurrencies,
  getProjectMembers,
  isProjectOwner,
  getPendingInvitations,
} from '@/features/projects';
import { isUserAdmin } from '@/features/entities';
import { BottomNavActionProvider } from '@/components/layout/bottom-nav-context';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';

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

  // Obtener proyectos del usuario
  const projects = await getActiveProjects(session.user.id);

  // Obtener proyecto actual o usar el más reciente
  let currentProjectId = await getCurrentProjectId();

  // Si no hay proyecto en cookie o no existe, usar el más reciente
  // La cookie se actualizará cuando el usuario cambie de proyecto manualmente
  if (!currentProjectId || !projects.find((p) => p.id === currentProjectId)) {
    const latestProject = await getLatestProject(session.user.id);
    currentProjectId = latestProject?.id ?? null;
  }

  // Si el usuario no tiene proyectos, mostrar mensaje para crear uno
  const hasNoProjects = projects.length === 0;

  // Obtener datos en paralelo
  const [currencies, isAdmin, members, isOwner, pendingInvitations] = await Promise.all([
    getCurrencies(),
    isUserAdmin(session.user.id),
    currentProjectId ? getProjectMembers(currentProjectId, session.user.id) : Promise.resolve([]),
    currentProjectId ? isProjectOwner(currentProjectId, session.user.id) : Promise.resolve(false),
    getPendingInvitations(session.user.id),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        user={session.user}
        projects={projects}
        currentProjectId={currentProjectId}
        currencies={currencies}
        isAdmin={isAdmin}
        members={members}
        isOwner={isOwner}
        pendingInvitations={pendingInvitations}
      />
      <BottomNavActionProvider>
        <main className="container mx-auto px-4 py-6 pb-20 md:pb-6">
          {hasNoProjects ? (
            <NoProjectsMessage userId={session.user.id} currencies={currencies} />
          ) : (
            children
          )}
        </main>
        <MobileBottomNav
          user={session.user}
          pendingInvitations={pendingInvitations}
          isAdmin={isAdmin}
        />
      </BottomNavActionProvider>
    </div>
  );
}
