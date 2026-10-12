'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { LayoutGrid, Plus, X, LogOut, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { ActionsPopover } from './actions-popover';
import { PRIMARY_NAV, SECONDARY_NAV, isNavActive } from './nav-items';

interface MobileBottomNavProps {
  user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  isAdmin?: boolean;
}

/**
 * Navegación móvil: una cápsula flotante. La pestaña activa muestra su nombre
 * en una pastilla jade suave; las demás son íconos. El "+" cierra la cápsula.
 */
export function MobileBottomNav({ user, isAdmin = false }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const moreActive = SECONDARY_NAV.some((item) => isNavActive(pathname, item.href));
  const initials = user.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <>
      <nav
        aria-label="Principal"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 md:hidden"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="pointer-events-auto flex items-center justify-between rounded-full border border-line-strong bg-surface-2 p-1.5 shadow-[0_8px_24px_rgba(8,6,12,0.45)]">
          {PRIMARY_NAV.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return active ? (
              <a
                key={item.href}
                href={item.href}
                aria-current="page"
                className="flex min-h-12 items-center gap-2 rounded-full bg-jade-soft pl-3.5 pr-4 text-[13px] font-extrabold text-jade-text"
              >
                <Icon className="h-5 w-5 text-jade" strokeWidth={2.2} />
                {item.label}
              </a>
            ) : (
              <a
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className="flex h-12 w-12 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-surface-3"
              >
                <Icon className="h-5 w-5" strokeWidth={1.9} />
              </a>
            );
          })}

          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            aria-label="Más opciones"
            className={cn(
              'flex min-h-12 items-center justify-center gap-2 rounded-full transition-colors',
              moreActive
                ? 'bg-jade-soft pl-3.5 pr-4 text-[13px] font-extrabold text-jade-text'
                : 'w-12 text-muted-foreground active:bg-surface-3'
            )}
          >
            <LayoutGrid className={cn('h-5 w-5', moreActive && 'text-jade')} strokeWidth={moreActive ? 2.2 : 1.9} />
            {moreActive && 'Más'}
          </button>

          <ActionsPopover side="top" sideOffset={14} align="end">
            {({ isOpen, hasActions }) => (
              <button
                type="button"
                aria-label="Registrar"
                disabled={!hasActions}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-jade text-jade-ink transition-opacity disabled:opacity-40"
              >
                <Plus className={cn('h-[22px] w-[22px] transition-transform', isOpen && 'rotate-45')} strokeWidth={2.6} />
              </button>
            )}
          </ActionsPopover>
        </div>
      </nav>

      <Drawer open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <DrawerContent>
          <div className="flex max-h-[85dvh] flex-col">
            <DrawerHeader className="border-b border-line">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={user.image ?? undefined} alt="" />
                    <AvatarFallback className="bg-violet-soft font-extrabold text-violet-text">{initials ?? 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col text-left">
                    <DrawerTitle className="text-left">{user.name}</DrawerTitle>
                    <DrawerDescription className="text-left">{user.email}</DrawerDescription>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMoreOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-3 text-muted-foreground"
                >
                  <X className="h-5 w-5" />
                  <span className="sr-only">Cerrar</span>
                </button>
              </div>
            </DrawerHeader>

            <nav aria-label="Más secciones" className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2">
                {SECONDARY_NAV.map((item) => {
                  const active = isNavActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMoreOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-[72px] flex-col justify-between rounded-[20px] border p-3.5 text-sm font-bold',
                        active ? 'border-jade bg-jade-soft text-jade-text' : 'border-line bg-surface text-foreground'
                      )}
                    >
                      <Icon className={cn('h-5 w-5', active ? 'text-jade' : 'text-muted-foreground')} strokeWidth={2} />
                      {item.label}
                    </a>
                  );
                })}
              </div>

              <div className="mt-4 space-y-1 border-t border-line pt-4">
                {isAdmin && (
                  <a
                    href="/admin/entities"
                    onClick={() => setIsMoreOpen(false)}
                    className="flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  >
                    <ShieldCheck className="h-5 w-5" />
                    Administrar entidades
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-coral-text hover:bg-coral-soft"
                >
                  <LogOut className="h-5 w-5" />
                  Cerrar sesión
                </button>
              </div>
            </nav>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
