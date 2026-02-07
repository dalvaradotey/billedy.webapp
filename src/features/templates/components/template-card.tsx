'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { toastActions } from '@/lib/toast-messages';
import {
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
  Archive,
  ChevronDown,
  ChevronRight,
  Power,
  PowerOff,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ResponsiveDrawer } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { formatCurrency } from '@/lib/formatting';
import { deleteTemplate, archiveTemplate, toggleTemplateActive } from '../actions';
import type { TemplateWithItems, TemplateItemWithDetails } from '../types';
import { CONFIRM_DELETE_TEXT } from './constants';
import { TemplateItemRow } from './template-item-row';
import { TemplateItemDialogContent } from './template-item-dialog';

interface TemplateCardProps {
  template: TemplateWithItems;
  categories: { id: string; name: string; color: string }[];
  accounts: { id: string; name: string }[];
  entities: { id: string; name: string; type: string; imageUrl: string | null }[];
  projectId: string;
  userId: string;
  baseCurrency: string;
  onEdit: () => void;
}

export function TemplateCard({
  template,
  categories,
  accounts,
  entities,
  projectId,
  userId,
  baseCurrency,
  onEdit,
}: TemplateCardProps) {
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<TemplateItemWithDetails | null>(null);

  const canDelete = confirmText === CONFIRM_DELETE_TEXT;

  const handleCloseDeleteDialog = (open: boolean) => {
    setShowDeleteDialog(open);
    if (!open) {
      setConfirmText('');
    }
  };

  const handleDelete = () => {
    if (!canDelete) return;
    const { onSuccess, onError } = toastActions.deleting('plantilla');
    startTransition(async () => {
      const result = await deleteTemplate(template.id, userId);
      setShowDeleteDialog(false);
      setConfirmText('');
      if (result.success) {
        onSuccess();
      } else {
        onError(result.error);
      }
    });
  };

  const handleArchive = () => {
    const { onSuccess, onError } = toastActions.archiving('plantilla');
    startTransition(async () => {
      const result = await archiveTemplate(template.id, userId);
      if (result.success) {
        onSuccess();
      } else {
        onError(result.error);
      }
    });
  };

  const handleToggleActive = () => {
    const toastId = toast.loading(
      template.isActive ? 'Desactivando plantilla...' : 'Activando plantilla...'
    );
    startTransition(async () => {
      const result = await toggleTemplateActive(template.id, userId);
      if (result.success) {
        toast.success(result.isActive ? 'Plantilla activada' : 'Plantilla desactivada', {
          id: toastId,
        });
      } else {
        toast.error(result.error, { id: toastId });
      }
    });
  };

  const handleAddItem = () => {
    setEditingItem(null);
    setShowItemDialog(true);
  };

  const handleEditItem = (item: TemplateItemWithDetails) => {
    setEditingItem(item);
    setShowItemDialog(true);
  };

  const handleItemDialogClose = () => {
    setShowItemDialog(false);
    setEditingItem(null);
  };

  const netAmount = template.totalIncome - template.totalExpense;

  return (
    <>
      <div
        className={`rounded-lg border ${template.isArchived ? 'opacity-60' : ''} ${
          !template.isActive && !template.isArchived ? 'border-dashed' : ''
        }`}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{template.name}</p>
                {!template.isActive && !template.isArchived && (
                  <Badge variant="secondary">Inactiva</Badge>
                )}
                {template.isArchived && <Badge variant="outline">Archivada</Badge>}
              </div>
              {template.description && (
                <p className="text-sm text-muted-foreground">{template.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm">
                <span className="text-emerald-600 dark:text-emerald-400">
                  +{formatCurrency(template.totalIncome, baseCurrency)}
                </span>
                {' / '}
                <span className="text-red-600 dark:text-red-400">
                  -{formatCurrency(template.totalExpense, baseCurrency)}
                </span>
              </p>
              <p
                className={`text-sm font-medium ${
                  netAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                Neto: {formatCurrency(netAmount, baseCurrency)}
              </p>
            </div>
            <Badge variant="outline">{template.itemsCount} items</Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleActive}>
                  {template.isActive ? (
                    <>
                      <PowerOff className="mr-2 h-4 w-4" />
                      Desactivar
                    </>
                  ) : (
                    <>
                      <Power className="mr-2 h-4 w-4" />
                      Activar
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleArchive}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archivar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Items */}
        {isExpanded && (
          <div className="border-t px-4 py-3 space-y-2">
            {template.items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay items en esta plantilla
              </p>
            ) : (
              template.items.map((item) => (
                <TemplateItemRow
                  key={item.id}
                  item={item}
                  userId={userId}
                  baseCurrency={baseCurrency}
                  onEdit={() => handleEditItem(item)}
                />
              ))
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={handleAddItem}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar item
            </Button>
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={handleCloseDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              ¿Eliminar plantilla permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                Esta acción <strong>no se puede deshacer</strong>. Se eliminará la plantilla
                &quot;{template.name}&quot; junto con todos sus{' '}
                <strong>{template.itemsCount} items</strong>.
              </span>
              <span className="block">
                Para confirmar, escribe <strong>{CONFIRM_DELETE_TEXT}</strong> a continuación:
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              placeholder={`Escribe ${CONFIRM_DELETE_TEXT} para confirmar`}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              className={confirmText && !canDelete ? 'border-destructive' : ''}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!canDelete || isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {isPending ? 'Eliminando...' : 'Eliminar plantilla'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Item Dialog */}
      <ResponsiveDrawer open={showItemDialog} onOpenChange={setShowItemDialog}>
        <TemplateItemDialogContent
          templateId={template.id}
          projectId={projectId}
          userId={userId}
          baseCurrency={baseCurrency}
          categories={categories}
          accounts={accounts}
          entities={entities}
          item={editingItem}
          onSuccess={handleItemDialogClose}
        />
      </ResponsiveDrawer>
    </>
  );
}
