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
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        'border border-dashed rounded-lg bg-muted/30',
        className
      )}
    >
      {Icon && (
        <div className="mb-4 rounded-full bg-muted p-4">
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
