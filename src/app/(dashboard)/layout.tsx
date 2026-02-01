import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { NoProjectsMessage } from '@/components/layout/no-projects-message';
import {
  getActiveProjects,
  getCurrentProjectId,
  getLatestProject,
  getCurrencies,
} from '@/features/projects';
import { isUserAdmin } from '@/features/entities';

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

  // Obtener monedas disponibles
  const currencies = await getCurrencies();

  // Verificar si el usuario es admin
  const isAdmin = await isUserAdmin(session.user.id);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        user={session.user}
        projects={projects}
        currentProjectId={currentProjectId}
        currencies={currencies}
        isAdmin={isAdmin}
      />
      <main className="container mx-auto px-4 py-6">
        {hasNoProjects ? (
          <NoProjectsMessage userId={session.user.id} currencies={currencies} />
        ) : (
          children
        )}
      </main>
    </div>
  );
}
