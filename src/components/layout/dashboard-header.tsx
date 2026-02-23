'use client';

import { useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { toast } from 'sonner';
import { LayoutDashboard, Wallet, PiggyBank, Target, CreditCard, Receipt, FileText, Calendar, ArrowRightLeft, Settings, LogOut, ShieldCheck, X, Bell, Check, XIcon, Crown, Pencil, Eye } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/theme-toggle';
import { ProcessingOverlay, type ProcessingStatus } from '@/components/processing-overlay';
import { ClientOnly } from '@/components/client-only';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import { setCurrentProjectId, acceptInvitation, rejectInvitation } from '@/features/projects/actions';
import type { Project, Currency, ProjectMemberWithUser, PendingInvitation } from '@/features/projects/types';
import type { ProjectRole } from '@/features/projects/schemas';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { href: '/dashboard/accounts', label: 'Cuentas', icon: Wallet },
  { href: '/dashboard/budgets', label: 'Presupuestos', icon: Target },
  { href: '/dashboard/savings', label: 'Ahorros', icon: PiggyBank },
  { href: '/dashboard/card-purchases', label: 'Compra en cuotas', icon: CreditCard },
  { href: '/dashboard/credits', label: 'Créditos', icon: Receipt },
  { href: '/dashboard/templates', label: 'Plantillas', icon: FileText },
  { href: '/dashboard/cycles', label: 'Ciclos', icon: Calendar },
  { href: '/dashboard/transactions', label: 'Transacciones', icon: ArrowRightLeft },
];

// Dynamic import to avoid hydration mismatch with Radix UI IDs
const ProjectSelector = dynamic(
  () => import('@/features/projects/components').then((mod) => mod.ProjectSelector),
  {
    ssr: false,
    loading: () => <Skeleton className="w-[180px] h-9" />,
  }
);

interface DashboardHeaderProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  projects: Project[];
  currentProjectId: string | null;
  currencies: Currency[];
  isAdmin?: boolean;
  members?: ProjectMemberWithUser[];
  isOwner?: boolean;
  pendingInvitations?: PendingInvitation[];
}

export function DashboardHeader({
  user,
  projects,
  currentProjectId,
  currencies,
  isAdmin,
  members = [],
  isOwner = false,
  pendingInvitations = [],
}: DashboardHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleProjectChange = async (projectId: string) => {
    await setCurrentProjectId(projectId);
  };

  const initials = user.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 flex h-14 items-center justify-between">
        <div className="flex items-center gap-4 md:gap-6">
          <a href="/dashboard" className="flex items-center">
            <div className="p-1 rounded-lg bg-gradient-to-tl from-emerald-500 to-blue-600 [color:white]">
              <Logo className="h-9 w-auto" />
            </div>
          </a>
          {projects.length > 0 && currentProjectId && (
            <ProjectSelector
              projects={projects}
              currentProjectId={currentProjectId}
              userId={user.id}
              currencies={currencies}
              members={members}
              isOwner={isOwner}
              onProjectChange={handleProjectChange}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Notificaciones */}
          <NotificationsButton
            invitations={pendingInvitations}
            userId={user.id}
            isOpen={isNotificationsOpen}
            onOpenChange={setIsNotificationsOpen}
            onAction={() => router.refresh()}
          />
          <ThemeToggle />
          <ClientOnly fallback={<Skeleton className="h-8 w-8 rounded-full" />}>
            <Drawer open={isMenuOpen} onOpenChange={setIsMenuOpen} direction="right">
              <Button
                variant="ghost"
                className="relative h-8 w-8 rounded-full"
                onClick={() => setIsMenuOpen(true)}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
                  <AvatarFallback>{initials ?? 'U'}</AvatarFallback>
                </Avatar>
              </Button>
              <DrawerContent>
                <div className="flex flex-col h-full">
                  {/* User info header */}
                  <DrawerHeader className="border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
                          <AvatarFallback className="text-lg">{initials ?? 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <DrawerTitle className="text-left">{user.name}</DrawerTitle>
                          <DrawerDescription className="text-left">{user.email}</DrawerDescription>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <X className="h-5 w-5" />
                        <span className="sr-only">Cerrar menú</span>
                      </Button>
                    </div>
                  </DrawerHeader>

                  {/* Navigation */}
                  <nav className="flex-1 overflow-y-auto py-4">
                    <div className="px-2 space-y-1">
                      {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.href ||
                          (item.href !== '/dashboard' && pathname.startsWith(item.href));
                        const Icon = item.icon;
                        return (
                          <a
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsMenuOpen(false)}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                              isActive
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            {item.label}
                          </a>
                        );
                      })}
                    </div>
                  </nav>

                  {/* Actions footer */}
                  <div className="border-t p-4 space-y-1">
                    <a
                      href="/dashboard/settings"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Settings className="h-5 w-5" />
                      Configuración
                    </a>
                    {isAdmin && (
                      <a
                        href="/admin/entities"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <ShieldCheck className="h-5 w-5" />
                        Administrar entidades
                      </a>
                    )}
                    <button
                      onClick={() => signOut({ callbackUrl: '/login' })}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors w-full"
                    >
                      <LogOut className="h-5 w-5" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>
          </ClientOnly>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// NOTIFICATIONS BUTTON
// ============================================================================

const roleLabels: Record<ProjectRole, { label: string; icon: typeof Crown }> = {
  owner: { label: 'Dueño', icon: Crown },
  editor: { label: 'Editor', icon: Pencil },
  viewer: { label: 'Lector', icon: Eye },
};

interface NotificationsButtonProps {
  invitations: PendingInvitation[];
  userId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: () => void;
}

function NotificationsButton({
  invitations,
  userId,
  isOpen,
  onOpenChange,
  onAction,
}: NotificationsButtonProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [overlayStatus, setOverlayStatus] = useState<ProcessingStatus>(null);
  const [processingProject, setProcessingProject] = useState<string | null>(null);

  const handleAccept = (invitation: PendingInvitation) => {
    setProcessingId(invitation.id);
    setProcessingProject(invitation.projectName);
    setOverlayStatus('loading');

    startTransition(async () => {
      const result = await acceptInvitation(invitation.id, userId);
      if (result.success) {
        // Cambiar al proyecto aceptado (en segundo plano)
        await setCurrentProjectId(invitation.projectId);
        // Refrescar datos
        onAction();
        // Mostrar éxito
        setOverlayStatus('success');
        // Después de mostrar el éxito, cerrar todo
        setTimeout(() => {
          setOverlayStatus(null);
          setProcessingProject(null);
          setProcessingId(null);
          onOpenChange(false);
        }, 3000);
      } else {
        toast.error(result.error);
        setOverlayStatus(null);
        setProcessingProject(null);
        setProcessingId(null);
      }
    });
  };

  const handleReject = (invitation: PendingInvitation) => {
    setProcessingId(invitation.id);
    const toastId = toast.loading('Rechazando invitación...');

    startTransition(async () => {
      const result = await rejectInvitation(invitation.id, userId);
      if (result.success) {
        toast.success('Invitación rechazada', { id: toastId });
        onAction();
      } else {
        toast.error(result.error, { id: toastId });
      }
      setProcessingId(null);
    });
  };

  const hasInvitations = invitations.length > 0;

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange} direction="right">
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8"
        onClick={() => onOpenChange(true)}
      >
        <Bell className="h-5 w-5" />
        {hasInvitations && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-500 text-[10px] font-medium text-white flex items-center justify-center">
            {invitations.length}
          </span>
        )}
      </Button>
      <DrawerContent>
        <ProcessingOverlay
          status={overlayStatus}
          loadingText={`Cargando ${processingProject}...`}
          successText={`Bienvenido a ${processingProject}`}
        />
        <div className="flex flex-col h-full">
          <DrawerHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle>Notificaciones</DrawerTitle>
                <DrawerDescription>
                  {hasInvitations
                    ? `${invitations.length} invitación${invitations.length > 1 ? 'es' : ''} pendiente${invitations.length > 1 ? 's' : ''}`
                    : 'No tienes notificaciones'}
                </DrawerDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Cerrar</span>
              </Button>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-4">
            {hasInvitations ? (
              <div className="space-y-3">
                {invitations.map((invitation) => {
                  const roleInfo = roleLabels[invitation.role];
                  const RoleIcon = roleInfo.icon;
                  const isProcessing = processingId === invitation.id;

                  return (
                    <div
                      key={invitation.id}
                      className="p-4 rounded-lg border bg-card space-y-3"
                    >
                      <div>
                        <p className="font-medium">
                          Te han invitado a{' '}
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {invitation.projectName}
                          </span>
                        </p>
                        {invitation.invitedByName && (
                          <p className="text-sm text-muted-foreground">
                            Invitado por {invitation.invitedByName}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <RoleIcon className="h-3.5 w-3.5" />
                        <span>Rol: {roleInfo.label}</span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 h-9"
                          disabled={isPending}
                          onClick={() => handleAccept(invitation)}
                        >
                          {isProcessing ? (
                            'Aceptando...'
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Aceptar
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-9"
                          disabled={isPending}
                          onClick={() => handleReject(invitation)}
                        >
                          {isProcessing ? (
                            'Rechazando...'
                          ) : (
                            <>
                              <XIcon className="h-4 w-4 mr-1" />
                              Rechazar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No tienes notificaciones</p>
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
