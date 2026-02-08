'use client';

import { useCallback } from 'react';

/**
 * Hook para manejar errores de validación en formularios.
 * Hace scroll al primer campo con error y aplica animación shake.
 *
 * Requiere que cada FormItem tenga el atributo data-field="fieldName"
 *
 * @example
 * const { onInvalid } = useFormValidation();
 * <form onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
 */
export function useFormValidation() {
  const onInvalid = useCallback((errors: Record<string, unknown>) => {
    const firstErrorKey = Object.keys(errors)[0];
    if (firstErrorKey) {
      const element = document.querySelector(`[data-field="${firstErrorKey}"]`);
      if (element) {
        // Scroll to element
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add shake animation
        element.classList.add('animate-shake');
        // Remove animation class after it completes
        setTimeout(() => {
          element.classList.remove('animate-shake');
        }, 500);
      }
    }
  }, []);

  return { onInvalid };
}
