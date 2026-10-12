'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { setCurrentProjectId } from '@/features/projects/actions';
import type { Project, Currency, ProjectMemberWithUser, PendingInvitation } from '@/features/projects/types';
import { BrandMark } from './brand-mark';
import { NotificationsButton } from './notifications-button';

// Import dinámico para evitar diferencias de IDs de Radix al hidratar
const ProjectSelector = dynamic(
  () => import('@/features/projects/components').then((mod) => mod.ProjectSelector),
  { ssr: false, loading: () => <Skeleton className="h-11 w-[180px] rounded-full" /> }
);

interface DashboardHeaderProps {
  user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  projects: Project[];
  currentProjectId: string | null;
  currencies: Currency[];
  members?: ProjectMemberWithUser[];
  isOwner?: boolean;
  pendingInvitations?: PendingInvitation[];
}

/** Encabezado móvil: marca, proyecto y notificaciones. En desktop lo reemplaza la barra lateral. */
export function DashboardHeader({
  user,
  projects,
  currentProjectId,
  currencies,
  members = [],
  isOwner = false,
  pendingInvitations = [],
}: DashboardHeaderProps) {
  const router = useRouter();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-sm md:hidden">
      <div className="flex h-16 items-center gap-2.5 px-4">
        <a href="/dashboard" aria-label="Ir al inicio" className="flex-none">
          <BrandMark withName={false} />
        </a>

        {projects.length > 0 && currentProjectId && (
          <ProjectSelector
            projects={projects}
            currentProjectId={currentProjectId}
            userId={user.id}
            currencies={currencies}
            members={members}
            isOwner={isOwner}
            onProjectChange={(projectId: string) => setCurrentProjectId(projectId)}
            className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4"
          />
        )}

        <NotificationsButton
          invitations={pendingInvitations}
          userId={user.id}
          isOpen={isNotificationsOpen}
          onOpenChange={setIsNotificationsOpen}
          onAction={() => router.refresh()}
          direction="bottom"
          className="ml-auto flex-none"
        />
      </div>
    </header>
  );
}
