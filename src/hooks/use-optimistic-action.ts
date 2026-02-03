'use client';

import { useTransition, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Resultado estándar de Server Actions
 */
interface ActionResult<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Opciones para ejecutar una acción
 */
interface ExecuteOptions {
  /** Mensaje mientras se ejecuta la acción */
  loadingMessage?: string;
  /** Mensaje de éxito */
  successMessage?: string;
  /** Mensaje de error (si no viene del servidor) */
  errorMessage?: string;
  /** Callback después de éxito */
  onSuccess?: () => void;
  /** Callback después de error */
  onError?: (error: string) => void;
}

/**
 * Hook para ejecutar Server Actions con feedback de toast
 * Reemplaza el patrón repetido de useTransition + toast en ~76 lugares
 *
 * @example
 * ```tsx
 * const { isPending, execute } = useServerAction();
 *
 * const handleCreate = async (data: FormData) => {
 *   await execute(
 *     () => createTransaction(data),
 *     {
 *       loadingMessage: 'Creando transacción...',
 *       successMessage: 'Transacción creada',
 *       onSuccess: () => dialog.close(),
 *     }
 *   );
 * };
 * ```
 */
export function useServerAction() {
  const [isPending, startTransition] = useTransition();

  const execute = useCallback(
    async <T>(
      action: () => Promise<ActionResult<T>>,
      options: ExecuteOptions = {}
    ): Promise<ActionResult<T> | undefined> => {
      const {
        loadingMessage = 'Procesando...',
        successMessage = 'Operación exitosa',
        errorMessage = 'Error en la operación',
        onSuccess,
        onError,
      } = options;

      const toastId = toast.loading(loadingMessage);

      return new Promise((resolve) => {
        startTransition(async () => {
          try {
            const result = await action();

            if (result.success) {
              toast.success(successMessage, { id: toastId });
              onSuccess?.();
            } else {
              toast.error(result.error || errorMessage, { id: toastId });
              onError?.(result.error || errorMessage);
            }

            resolve(result);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : errorMessage;
            toast.error(message, { id: toastId });
            onError?.(message);
            resolve({ success: false, error: message });
          }
        });
      });
    },
    []
  );

  return { isPending, execute };
}

/**
 * Hook para manejar confirmaciones con acción
 * Útil para eliminar, archivar, etc.
 *
 * @example
 * ```tsx
 * const { isPending, confirm } = useConfirmAction();
 *
 * <AlertDialog>
 *   <AlertDialogAction
 *     disabled={isPending}
 *     onClick={() => confirm(
 *       () => deleteTransaction(id),
 *       {
 *         loadingMessage: 'Eliminando...',
 *         successMessage: 'Transacción eliminada',
 *         onSuccess: () => setOpen(false),
 *       }
 *     )}
 *   >
 *     {isPending ? 'Eliminando...' : 'Eliminar'}
 *   </AlertDialogAction>
 * </AlertDialog>
 * ```
 */
export function useConfirmAction() {
  const { isPending, execute } = useServerAction();

  const confirm = useCallback(
    async <T>(
      action: () => Promise<ActionResult<T>>,
      options: ExecuteOptions = {}
    ) => {
      return execute(action, options);
    },
    [execute]
  );

  return { isPending, confirm };
}
