'use client';

import { forwardRef, ComponentProps } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LoadingButtonProps extends ComponentProps<typeof Button> {
  /** Si el botón está en estado de carga */
  isLoading?: boolean;
  /** Texto a mostrar durante la carga (opcional, usa children si no se especifica) */
  loadingText?: string;
}

/**
 * Botón con estado de carga integrado
 * Muestra un spinner y deshabilita el botón durante la carga
 *
 * @example
 * ```tsx
 * const { isPending } = useServerAction();
 *
 * <LoadingButton
 *   type="submit"
 *   isLoading={isPending}
 *   loadingText="Guardando..."
 * >
 *   Guardar
 * </LoadingButton>
 * ```
 */
export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ children, isLoading, loadingText, disabled, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(className)}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {loadingText || children}
          </>
        ) : (
          children
        )}
      </Button>
    );
  }
);

LoadingButton.displayName = 'LoadingButton';
