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
import { AppSidebar } from '@/components/layout/app-sidebar';

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
      <BottomNavActionProvider>
        <AppSidebar
          user={session.user}
          projects={projects}
          currentProjectId={currentProjectId}
          currencies={currencies}
          isAdmin={isAdmin}
          members={members}
          isOwner={isOwner}
          pendingInvitations={pendingInvitations}
        />
        <div className="md:pl-[248px]">
          <DashboardHeader
            user={session.user}
            projects={projects}
            currentProjectId={currentProjectId}
            currencies={currencies}
            members={members}
            isOwner={isOwner}
            pendingInvitations={pendingInvitations}
          />
          <main className="mx-auto w-full max-w-[1200px] px-4 pb-28 pt-2 md:px-8 md:pb-10 md:pt-6">
            {hasNoProjects ? (
              <NoProjectsMessage userId={session.user.id} currencies={currencies} />
            ) : (
              children
            )}
          </main>
        </div>
        <MobileBottomNav user={session.user} isAdmin={isAdmin} />
      </BottomNavActionProvider>
    </div>
  );
}
