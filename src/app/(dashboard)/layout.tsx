import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { runOnboarding } from '@/features/onboarding';
import {
  getActiveProjects,
  getCurrentProjectId,
  getLatestProject,
} from '@/features/projects';

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

  // Ejecutar onboarding si el usuario es nuevo
  await runOnboarding(session.user.id);

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

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        user={session.user}
        projects={projects}
        currentProjectId={currentProjectId}
      />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
