'use client';

import { signOut } from 'next-auth/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { ProjectSelector } from '@/features/projects/components';
import { setCurrentProjectId } from '@/features/projects/actions';
import type { Project, Currency } from '@/features/projects/types';

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
          <a href="/dashboard" className="font-bold text-xl">
            Billedy
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
          <nav className="hidden md:flex items-center gap-4 text-sm">
            <a
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Resumen
            </a>
            <a
              href="/dashboard/accounts"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Cuentas
            </a>
            <a
              href="/dashboard/budgets"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Presupuestos
            </a>
            <a
              href="/dashboard/savings"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Ahorros
            </a>
            <a
              href="/dashboard/card-purchases"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Compra en cuotas
            </a>
            <a
              href="/dashboard/credits"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Créditos
            </a>
            <a
              href="/dashboard/templates"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Plantillas
            </a>
            <a
              href="/dashboard/cycles"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Ciclos
            </a>
            <a
              href="/dashboard/transactions"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Transacciones
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
                <AvatarFallback>{initials ?? 'U'}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/dashboard/settings">Configuración</a>
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/admin/entities">Administrar entidades</a>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-red-600 focus:text-red-600"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
