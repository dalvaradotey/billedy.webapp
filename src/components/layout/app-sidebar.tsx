'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Plus, ShieldCheck, LogOut, ChevronsUpDown, Palette } from 'lucide-react';
import { ThemePicker } from '@/components/theme-picker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { setCurrentProjectId } from '@/features/projects/actions';
import type { Project, Currency, ProjectMemberWithUser, PendingInvitation } from '@/features/projects/types';
import { BrandMark } from './brand-mark';
import { NotificationsButton } from './notifications-button';
import { ActionsPopover } from './actions-popover';
import { PRIMARY_NAV, SECONDARY_NAV, isNavActive, type NavItem } from './nav-items';

// Import dinámico para evitar diferencias de IDs de Radix al hidratar
const ProjectSelector = dynamic(
  () => import('@/features/projects/components').then((mod) => mod.ProjectSelector),
  { ssr: false, loading: () => <Skeleton className="h-11 w-full rounded-full" /> }
);

interface AppSidebarProps {
  user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  projects: Project[];
  currentProjectId: string | null;
  currencies: Currency[];
  isAdmin?: boolean;
  members?: ProjectMemberWithUser[];
  isOwner?: boolean;
  pendingInvitations?: PendingInvitation[];
}

/**
 * Barra lateral de desktop: la misma cápsula de la navegación móvil, en vertical.
 * Muestra todos los destinos; el activo va en una pastilla jade suave.
 */
export function AppSidebar({
  user,
  projects,
  currentProjectId,
  currencies,
  isAdmin = false,
  members = [],
  isOwner = false,
  pendingInvitations = [],
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const initials = user.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col gap-3 border-r border-line bg-background px-[18px] py-5 md:flex [@media(max-height:860px)]:gap-2.5 [@media(max-height:860px)]:py-4">
      <div className="flex items-center justify-between px-1.5">
        <a href="/dashboard" aria-label="Ir al inicio">
          <BrandMark />
        </a>
        <NotificationsButton
          invitations={pendingInvitations}
          userId={user.id}
          isOpen={isNotificationsOpen}
          onOpenChange={setIsNotificationsOpen}
          onAction={() => router.refresh()}
          className="h-10 w-10"
        />
      </div>

      {projects.length > 0 && currentProjectId && (
        <ProjectSelector
          projects={projects}
          currentProjectId={currentProjectId}
          userId={user.id}
          currencies={currencies}
          members={members}
          isOwner={isOwner}
          onProjectChange={(projectId: string) => setCurrentProjectId(projectId)}
          className="h-10 rounded-full border border-line bg-surface px-4"
        />
      )}

      <ActionsPopover side="right" align="start" sideOffset={12}>
        {({ isOpen, hasActions }) => (
          <button
            type="button"
            disabled={!hasActions}
            className="flex min-h-10 items-center justify-center gap-2 rounded-full bg-jade text-sm font-extrabold text-jade-ink transition-opacity disabled:opacity-40"
          >
            <Plus className={cn('h-5 w-5 transition-transform', isOpen && 'rotate-45')} strokeWidth={2.6} />
            Registrar
          </button>
        )}
      </ActionsPopover>

      <SidebarNav pathname={pathname} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex shrink-0 items-center gap-2.5 rounded-[20px] border border-line bg-surface p-2 text-left transition-colors hover:bg-surface-2"
          >
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.image ?? undefined} alt="" />
              <AvatarFallback className="bg-violet-soft font-extrabold text-violet-text">{initials ?? 'U'}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-extrabold">{user.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-[212px] rounded-2xl">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Tu cuenta</DropdownMenuLabel>
          {isAdmin && (
            <DropdownMenuItem asChild>
              <a href="/admin/entities"><ShieldCheck className="h-4 w-4" />Administrar entidades</a>
            </DropdownMenuItem>
          )}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Palette className="h-4 w-4" />
              Apariencia
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-[300px] rounded-2xl p-2">
              <ThemePicker />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-coral-text focus:text-coral-text" onSelect={() => signOut({ callbackUrl: '/login' })}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  );
}

const FADE = 28;

/**
 * Lista de destinos. En pantallas bajas no caben todos: hace scroll y los bordes
 * se desvanecen donde hay más, en vez de cortarse en seco.
 */
function SidebarNav({ pathname }: { pathname: string }) {
  const ref = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const measure = (el: HTMLElement) => {
    const max = el.scrollHeight - el.clientHeight;
    setEdges({ top: el.scrollTop > 2, bottom: max > 2 && el.scrollTop < max - 2 });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure(el));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const mask = `linear-gradient(to bottom, ${edges.top ? 'transparent' : '#000'} 0, #000 ${FADE}px, #000 calc(100% - ${FADE}px), ${edges.bottom ? 'transparent' : '#000'} 100%)`;

  return (
    <nav
      ref={ref}
      aria-label="Principal"
      onScroll={(e) => measure(e.currentTarget)}
      className="scrollbar-hide -mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      <SidebarGroup items={PRIMARY_NAV} pathname={pathname} />
      <SidebarGroup items={SECONDARY_NAV} pathname={pathname} />
    </nav>
  );
}

function SidebarGroup({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <div className="flex shrink-0 flex-col gap-0.5 rounded-[22px] border border-line-strong bg-surface-2 p-1">
      {items.map((item) => {
        const active = isNavActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-9 items-center gap-3 rounded-full px-3.5 text-sm transition-colors [@media(max-height:860px)]:min-h-8',
              active
                ? 'bg-jade-soft font-extrabold text-jade-text'
                : 'font-semibold text-subtle hover:bg-surface-3 hover:text-foreground'
            )}
          >
            <Icon
              className={cn('h-5 w-5', active ? 'text-jade' : 'text-muted-foreground')}
              strokeWidth={active ? 2.2 : 1.9}
            />
            {item.label}
          </a>
        );
      })}
    </div>
  );
}
