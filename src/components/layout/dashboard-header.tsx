'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { LayoutDashboard, Wallet, PiggyBank, Target, CreditCard, Receipt, FileText, Calendar, ArrowRightLeft, Settings, LogOut, ShieldCheck, X } from 'lucide-react';
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
import { ClientOnly } from '@/components/client-only';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import { setCurrentProjectId } from '@/features/projects/actions';
import type { Project, Currency } from '@/features/projects/types';

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
}

export function DashboardHeader({ user, projects, currentProjectId, currencies, isAdmin }: DashboardHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

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
              onProjectChange={handleProjectChange}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
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
