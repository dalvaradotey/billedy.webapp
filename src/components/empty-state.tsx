'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** Icono de Lucide a mostrar */
  icon?: LucideIcon;
  /** Título principal */
  title: string;
  /** Descripción opcional */
  description?: string;
  /** Acción primaria (botón) */
  action?: React.ReactNode;
  /** Clases adicionales para el contenedor */
  className?: string;
  /** Mostrar partículas animadas alrededor del ícono */
  showParticles?: boolean;
}

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Partículas grandes - más difusas */}
      <div
        className="absolute w-6 h-6 rounded-full bg-emerald-500/15 blur-md animate-float-particle"
        style={{ left: '15%', top: '20%', animationDelay: '0s' }}
      />
      <div
        className="absolute w-8 h-8 rounded-full bg-blue-400/12 blur-lg animate-float-particle"
        style={{ right: '12%', top: '35%', animationDelay: '1.4s' }}
      />
      <div
        className="absolute w-7 h-7 rounded-full bg-teal-400/15 blur-md animate-float-particle"
        style={{ left: '20%', bottom: '25%', animationDelay: '0.8s' }}
      />
      <div
        className="absolute w-6 h-6 rounded-full bg-emerald-400/12 blur-lg animate-float-particle"
        style={{ right: '18%', bottom: '30%', animationDelay: '2.2s' }}
      />

      {/* Partículas medianas */}
      <div
        className="absolute w-4 h-4 rounded-full bg-blue-500/18 blur-sm animate-float-particle"
        style={{ left: '35%', top: '15%', animationDelay: '0.5s' }}
      />
      <div
        className="absolute w-3 h-3 rounded-full bg-emerald-500/20 blur-sm animate-float-particle"
        style={{ right: '35%', top: '25%', animationDelay: '1.8s' }}
      />
      <div
        className="absolute w-4 h-4 rounded-full bg-teal-500/15 blur-sm animate-float-particle"
        style={{ left: '8%', top: '50%', animationDelay: '2.5s' }}
      />
      <div
        className="absolute w-3 h-3 rounded-full bg-blue-400/18 blur-sm animate-float-particle"
        style={{ right: '8%', bottom: '45%', animationDelay: '1.1s' }}
      />

      {/* Partículas pequeñas - acentos */}
      <div
        className="absolute w-2 h-2 rounded-full bg-emerald-400/25 blur-[2px] animate-float-particle"
        style={{ left: '45%', top: '22%', animationDelay: '0.3s' }}
      />
      <div
        className="absolute w-2 h-2 rounded-full bg-blue-500/22 blur-[2px] animate-float-particle"
        style={{ right: '42%', bottom: '20%', animationDelay: '1.6s' }}
      />
      <div
        className="absolute w-2.5 h-2.5 rounded-full bg-teal-400/20 blur-[3px] animate-float-particle"
        style={{ left: '28%', bottom: '35%', animationDelay: '2.8s' }}
      />
      <div
        className="absolute w-2 h-2 rounded-full bg-emerald-500/22 blur-[2px] animate-float-particle"
        style={{ right: '28%', top: '48%', animationDelay: '0.9s' }}
      />
    </div>
  );
}

/**
 * Componente para mostrar estados vacíos de forma consistente
 *
 * @example
 * ```tsx
 * // Estado vacío básico
 * <EmptyState
 *   icon={Wallet}
 *   title="No hay transacciones registradas"
 * />
 *
 * // Con descripción y acción
 * <EmptyState
 *   icon={CreditCard}
 *   title="No hay créditos activos"
 *   description="Agrega un crédito para comenzar a trackear tus cuotas"
 *   action={
 *     <Button onClick={handleCreate}>
 *       <Plus className="mr-2 h-4 w-4" />
 *       Agregar crédito
 *     </Button>
 *   }
 * />
 * ```
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  showParticles = true,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center py-12 text-center',
        'border border-dashed rounded-lg bg-muted/30',
        className
      )}
    >
      {showParticles && <FloatingParticles />}
      {Icon && (
        <div className="relative mb-4 rounded-xl bg-muted p-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Variante compacta para espacios pequeños (ej: dentro de cards)
 */
export function EmptyStateCompact({
  icon: Icon,
  title,
  className,
}: Pick<EmptyStateProps, 'icon' | 'title' | 'className'>) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-8 text-center',
        className
      )}
    >
      {Icon && <Icon className="mb-2 h-6 w-6 text-muted-foreground/50" />}
      <p className="text-sm text-muted-foreground">{title}</p>
    </div>
  );
}
