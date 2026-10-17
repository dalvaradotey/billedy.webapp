'use client';

import { useState, useCallback } from 'react';

interface UseSuccessAnimationOptions {
  duration?: number;
  onComplete?: () => void;
}

/**
 * Hook para manejar la animación de éxito en formularios.
 * Muestra el overlay por un tiempo determinado y luego ejecuta el callback.
 *
 * @param options.duration - Duración en ms del overlay (default: 1500)
 * @param options.onComplete - Callback a ejecutar cuando termina la animación
 *
 * @example
 * const { showSuccess, triggerSuccess } = useSuccessAnimation({
 *   onComplete: () => onSuccess(),
 * });
 *
 * // En el submit exitoso:
 * triggerSuccess();
 *
 * // Opcional: callback puntual con datos del submit (corre después de onComplete)
 * triggerSuccess(() => onCreated(nuevo));
 */
export function useSuccessAnimation(options: UseSuccessAnimationOptions = {}) {
  const { duration = 1500, onComplete } = options;
  const [showSuccess, setShowSuccess] = useState(false);

  const triggerSuccess = useCallback((then?: () => void) => {
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onComplete?.();
      then?.();
    }, duration);
  }, [duration, onComplete]);

  return { showSuccess, triggerSuccess };
}
