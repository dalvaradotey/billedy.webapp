import { toast } from 'sonner';

type EntityName =
  | 'transacción'
  | 'cuenta'
  | 'categoría'
  | 'crédito'
  | 'presupuesto'
  | 'plantilla'
  | 'item'
  | 'fondo'
  | 'ciclo'
  | 'compra'
  | 'cuota'
  | 'transferencia'
  | 'pago'
  | 'depósito'
  | 'retiro'
  | 'movimiento';

type ActionType = 'create' | 'update' | 'delete' | 'archive' | 'restore' | 'process';

const LOADING_MESSAGES: Record<ActionType, string> = {
  create: 'Creando',
  update: 'Actualizando',
  delete: 'Eliminando',
  archive: 'Archivando',
  restore: 'Restaurando',
  process: 'Procesando',
};

const SUCCESS_MESSAGES: Record<ActionType, string> = {
  create: 'creado',
  update: 'actualizado',
  delete: 'eliminado',
  archive: 'archivado',
  restore: 'restaurado',
  process: 'procesado',
};

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getGenderedMessage(entity: EntityName, action: string, isFeminine: boolean): string {
  if (isFeminine) {
    return action.replace(/o$/, 'a');
  }
  return action;
}

const FEMININE_ENTITIES: EntityName[] = [
  'transacción',
  'cuenta',
  'categoría',
  'plantilla',
  'compra',
  'cuota',
  'transferencia',
];

/**
 * Shows a loading toast and returns its ID for later update
 */
export function showLoadingToast(action: ActionType, entity: EntityName): string | number {
  const message = `${LOADING_MESSAGES[action]} ${entity}...`;
  return toast.loading(capitalize(message));
}

/**
 * Updates a toast to show success
 */
export function showSuccessToast(
  toastId: string | number,
  action: ActionType,
  entity: EntityName,
  customMessage?: string
): void {
  if (customMessage) {
    toast.success(customMessage, { id: toastId });
    return;
  }

  const isFeminine = FEMININE_ENTITIES.includes(entity);
  const actionMessage = getGenderedMessage(entity, SUCCESS_MESSAGES[action], isFeminine);
  const message = `${capitalize(entity)} ${actionMessage}`;
  toast.success(message, { id: toastId });
}

/**
 * Updates a toast to show error
 */
export function showErrorToast(toastId: string | number, error?: string): void {
  toast.error(error || 'Ocurrió un error', { id: toastId });
}

/**
 * Helper for common CRUD operations with toast notifications
 */
export function createToastAction(action: ActionType, entity: EntityName) {
  const toastId = showLoadingToast(action, entity);

  return {
    toastId,
    onSuccess: (customMessage?: string) => showSuccessToast(toastId, action, entity, customMessage),
    onError: (error?: string) => showErrorToast(toastId, error),
  };
}

/**
 * Convenience functions for common actions
 */
export const toastActions = {
  creating: (entity: EntityName) => createToastAction('create', entity),
  updating: (entity: EntityName) => createToastAction('update', entity),
  deleting: (entity: EntityName) => createToastAction('delete', entity),
  archiving: (entity: EntityName) => createToastAction('archive', entity),
  restoring: (entity: EntityName) => createToastAction('restore', entity),
  processing: (entity: EntityName) => createToastAction('process', entity),
};
