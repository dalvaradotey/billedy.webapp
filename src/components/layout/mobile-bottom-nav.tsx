'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { toast } from 'sonner';
import {
  LayoutDashboard, Bell, Plus, X, Settings, LogOut, ShieldCheck,
  Check, XIcon, Crown, Pencil, Eye,
  Wallet, PiggyBank, Target, CreditCard, Receipt, FileText, Calendar, ArrowRightLeft,
  Sun, Moon, Monitor,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { ProcessingOverlay, type ProcessingStatus } from '@/components/processing-overlay';
import { cn } from '@/lib/utils';
import { setCurrentProjectId, acceptInvitation, rejectInvitation } from '@/features/projects/actions';
import type { PendingInvitation } from '@/features/projects/types';
import type { ProjectRole } from '@/features/projects/schemas';
import { ActionsPopover } from './actions-popover';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { href: '/dashboard/transactions', label: 'Transacciones', icon: ArrowRightLeft },
  { href: '/dashboard/accounts', label: 'Cuentas', icon: Wallet },
  { href: '/dashboard/budgets', label: 'Presupuestos', icon: Target },
  { href: '/dashboard/saving-goals', label: 'Metas de ahorro', icon: PiggyBank },
  { href: '/dashboard/card-purchases', label: 'Compra en cuotas', icon: CreditCard },
  { href: '/dashboard/credits', label: 'Créditos', icon: Receipt },
  { href: '/dashboard/templates', label: 'Plantillas', icon: FileText },
  { href: '/dashboard/cycles', label: 'Ciclos', icon: Calendar },
];

const roleLabels: Record<ProjectRole, { label: string; icon: typeof Crown }> = {
  owner: { label: 'Dueño', icon: Crown },
  editor: { label: 'Editor', icon: Pencil },
  viewer: { label: 'Lector', icon: Eye },
};

interface MobileBottomNavProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  pendingInvitations?: PendingInvitation[];
  isAdmin?: boolean;
}

export function MobileBottomNav({
  user,
  pendingInvitations = [],
  isAdmin = false,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [bellRing, setBellRing] = useState(false);
  const { setTheme, theme } = useTheme();

  const isDashboard = pathname === '/dashboard';
  const hasInvitations = pendingInvitations.length > 0;

  const initials = user.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {/* Bell ring keyframes */}
      <style jsx global>{`
        @keyframes bell-ring {
          0% { transform: rotate(0deg); }
          15% { transform: rotate(14deg); }
          30% { transform: rotate(-12deg); }
          45% { transform: rotate(8deg); }
          60% { transform: rotate(-6deg); }
          75% { transform: rotate(3deg); }
          90% { transform: rotate(-1deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>

      {/* ================================================================ */}
      {/* GLASS BOTTOM NAV BAR                                             */}
      {/* ================================================================ */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 pointer-events-none px-4"
        style={{ paddingBottom: `calc(0.5rem + env(safe-area-inset-bottom))` }}
      >
        <div className="pointer-events-auto relative">
          {/* Ambient glow beneath bar */}
          <div className="absolute inset-x-6 -bottom-1 h-8 bg-emerald-500/[0.07] dark:bg-emerald-500/[0.12] blur-2xl rounded-full" />

          {/* Glass container */}
          <div className="relative rounded-2xl overflow-hidden">
            {/* Layer 1: Frosted glass background */}
            <div className="absolute inset-0 bg-background/75 dark:bg-background/60 backdrop-blur-2xl backdrop-saturate-150" />
            {/* Layer 2: Subtle gradient for depth (light hits from top-left) */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-transparent to-transparent dark:from-white/[0.04]" />
            {/* Layer 3: Inner border ring */}
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08]" />
            {/* Layer 4: Top light refraction line */}
            <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/30 dark:via-white/15 to-transparent" />

            {/* Nav content */}
            <div className="relative flex items-center h-[54px] px-2">
              {/* Dashboard */}
              <a
                href="/dashboard"
                className={cn(
                  'relative flex-1 flex items-center justify-center py-2 rounded-xl transition-all duration-300 active:scale-90',
                  isDashboard ? 'text-emerald-500' : 'text-muted-foreground/60'
                )}
              >
                <LayoutDashboard className="relative h-[22px] w-[22px] transition-all duration-300" />
                {isDashboard && (
                  <div className="absolute bottom-1.5 h-[3px] w-4 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                )}
              </a>

              {/* Notifications */}
              <button
                onClick={() => {
                  setBellRing(true);
                  setIsNotificationsOpen(true);
                  setTimeout(() => setBellRing(false), 600);
                }}
                className="relative flex-1 flex items-center justify-center py-2 rounded-xl text-muted-foreground/60 transition-all duration-300 active:scale-90"
              >
                <div className="relative">
                  <Bell
                    className="h-[22px] w-[22px] transition-all duration-300"
                    style={bellRing ? {
                      animation: 'bell-ring 0.6s ease-in-out',
                      transformOrigin: 'top center',
                    } : undefined}
                  />
                  {hasInvitations && (
                    <span className="absolute -top-1.5 -right-2 h-4 min-w-4 px-0.5 rounded-full bg-emerald-500 text-[10px] font-bold text-white flex items-center justify-center shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-in zoom-in-50 duration-200">
                      {pendingInvitations.length}
                    </span>
                  )}
                </div>
              </button>

              {/* Action Button + Dropdown */}
              <ActionsPopover side="top" sideOffset={12} align="center">
                {({ isOpen, hasActions }) => (
                  <button
                    className={cn(
                      'relative flex-1 flex items-center justify-center py-2 rounded-xl transition-all duration-300 active:scale-90',
                      hasActions
                        ? isOpen ? 'text-emerald-500' : 'text-muted-foreground/60'
                        : 'text-muted-foreground/30'
                    )}
                  >
                    <Plus className={cn(
                      'h-[22px] w-[22px] transition-all duration-300',
                      isOpen && 'rotate-45'
                    )} />
                  </button>
                )}
              </ActionsPopover>

              {/* User Menu */}
              <button
                onClick={() => setIsMenuOpen(true)}
                className="relative flex-1 flex items-center justify-center py-2 rounded-xl text-muted-foreground/60 transition-all duration-300 active:scale-90"
              >
                <Avatar className="h-7 w-7 ring-1 ring-black/[0.06] dark:ring-white/[0.1]">
                  <AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
                  <AvatarFallback className="text-[10px] bg-muted/50">{initials ?? 'U'}</AvatarFallback>
                </Avatar>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ================================================================ */}
      {/* NOTIFICATIONS DRAWER (bottom sheet)                              */}
      {/* ================================================================ */}
      <MobileNotificationsDrawer
        invitations={pendingInvitations}
        userId={user.id}
        isOpen={isNotificationsOpen}
        onOpenChange={setIsNotificationsOpen}
        onAction={() => router.refresh()}
      />

      {/* ================================================================ */}
      {/* MENU DRAWER (right side)                                         */}
      {/* ================================================================ */}
      <Drawer open={isMenuOpen} onOpenChange={setIsMenuOpen} direction="right">
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
                          : 'text-muted-foreground hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-foreground'
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
              {/* Theme Toggle */}
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg">
                <span className="text-sm font-medium text-muted-foreground">Tema</span>
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                  <button
                    onClick={() => setTheme('light')}
                    className={cn(
                      'p-1.5 rounded-md transition-colors',
                      theme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    <Sun className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={cn(
                      'p-1.5 rounded-md transition-colors',
                      theme === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    <Moon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setTheme('system')}
                    className={cn(
                      'p-1.5 rounded-md transition-colors',
                      theme === 'system' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    <Monitor className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <a
                href="/dashboard/settings"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-foreground transition-colors"
              >
                <Settings className="h-5 w-5" />
                Configuración
              </a>
              {isAdmin && (
                <a
                  href="/admin/entities"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-foreground transition-colors"
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

    </>
  );
}

// ============================================================================
// MOBILE NOTIFICATIONS DRAWER
// ============================================================================

function MobileNotificationsDrawer({
  invitations,
  userId,
  isOpen,
  onOpenChange,
  onAction,
}: {
  invitations: PendingInvitation[];
  userId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: () => void;
}) {
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
        await setCurrentProjectId(invitation.projectId);
        onAction();
        setOverlayStatus('success');
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
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        <ProcessingOverlay
          status={overlayStatus}
          loadingText={`Cargando ${processingProject}...`}
          successText={`Bienvenido a ${processingProject}`}
        />
        <div className="flex flex-col max-h-[80dvh]">
          <DrawerHeader className="border-b">
            <DrawerTitle>Notificaciones</DrawerTitle>
            <DrawerDescription>
              {hasInvitations
                ? `${invitations.length} invitación${invitations.length > 1 ? 'es' : ''} pendiente${invitations.length > 1 ? 's' : ''}`
                : 'No tienes notificaciones'}
            </DrawerDescription>
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
              <div className="flex flex-col items-center justify-center text-center py-12">
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
