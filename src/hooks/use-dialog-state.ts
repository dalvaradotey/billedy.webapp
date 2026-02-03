'use client';

import { useState, useCallback } from 'react';

/**
 * Estado genérico para manejar diálogos de crear/editar
 * Reemplaza el patrón repetido de useState + handlers en ~40 lugares
 */
interface DialogState<T> {
  /** Si el diálogo está abierto */
  isOpen: boolean;
  /** Item siendo editado (null si es creación) */
  editingItem: T | null;
  /** Abre el diálogo en modo creación */
  openCreate: () => void;
  /** Abre el diálogo en modo edición con el item */
  openEdit: (item: T) => void;
  /** Cierra el diálogo y limpia el item */
  close: () => void;
  /** Setter directo para isOpen (para onOpenChange de Dialog) */
  setIsOpen: (open: boolean) => void;
}

/**
 * Hook para manejar estado de diálogos de crear/editar
 *
 * @example
 * ```tsx
 * const dialog = useDialogState<Transaction>();
 *
 * // En el componente
 * <Button onClick={dialog.openCreate}>Crear</Button>
 * <Button onClick={() => dialog.openEdit(item)}>Editar</Button>
 *
 * <Dialog open={dialog.isOpen} onOpenChange={dialog.setIsOpen}>
 *   <TransactionForm
 *     defaultValues={dialog.editingItem}
 *     onSuccess={dialog.close}
 *   />
 * </Dialog>
 * ```
 */
export function useDialogState<T = unknown>(): DialogState<T> {
  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setIsOpen(true);
  }, []);

  const openEdit = useCallback((item: T) => {
    setEditingItem(item);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Pequeño delay para que la animación de cierre termine
    // antes de limpiar el item (evita parpadeo)
    setTimeout(() => setEditingItem(null), 150);
  }, []);

  return {
    isOpen,
    editingItem,
    openCreate,
    openEdit,
    close,
    setIsOpen,
  };
}
