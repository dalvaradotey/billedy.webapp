'use client';

import { useState, useTransition } from 'react';
import { useIsMobile } from '@/hooks';
import { toast } from 'sonner';
import { toastActions } from '@/lib/toast-messages';
import {
  Plus,
  Pencil,
  Trash2,
  Archive,
  ChevronDown,
  ChevronRight,
  Power,
  PowerOff,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ResponsiveDrawer } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CardActions } from '@/components/card-actions';

import { formatCurrency } from '@/lib/formatting';
import { deleteTemplate, archiveTemplate, toggleTemplateActive } from '../actions';
import type { TemplateWithItems, TemplateItemWithDetails } from '../types';
import type { AccountWithEntity } from '@/features/accounts/types';
import { CONFIRM_DELETE_TEXT } from './constants';
import { TemplateItemRow } from './template-item-row';
import { TemplateItemDialogContent } from './template-item-dialog';

interface TemplateCardProps {
  template: TemplateWithItems;
  categories: { id: string; name: string; color: string }[];
  accounts: AccountWithEntity[];
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
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<TemplateItemWithDetails | null>(null);
  const [showActionsDrawer, setShowActionsDrawer] = useState(false);
  const [showInlineActions, setShowInlineActions] = useState(false);
  const isMobile = useIsMobile();

  const handleDelete = () => {
    const { onSuccess, onError } = toastActions.deleting('plantilla');
    startTransition(async () => {
      const result = await deleteTemplate(template.id, userId);
      setShowDeleteDialog(false);
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

  const actions = [
    {
      key: 'edit',
      label: 'Editar',
      icon: <Pencil />,
      onClick: onEdit,
    },
    {
      key: 'toggle',
      label: template.isActive ? 'Desactivar' : 'Activar',
      icon: template.isActive ? <PowerOff /> : <Power />,
      onClick: handleToggleActive,
    },
    {
      key: 'archive',
      label: 'Archivar',
      icon: <Archive />,
      onClick: handleArchive,
    },
    {
      key: 'delete',
      label: 'Eliminar',
      icon: <Trash2 />,
      onClick: () => setShowDeleteDialog(true),
      variant: 'destructive' as const,
    },
  ];

  return (
    <>
      <div
        className={`rounded-2xl border bg-card transition-colors ${template.isArchived ? 'opacity-60' : ''} ${
          !template.isActive && !template.isArchived ? 'border-dashed' : ''
        }`}
      >
        {/* Header - clickable for expand/collapse */}
        <div
          className="p-4 flex items-center justify-between cursor-pointer active:bg-muted/50 transition-colors rounded-2xl"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Chevron */}
            <div className="shrink-0 text-muted-foreground">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </div>

            {/* Name + badges */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-base truncate">{template.name}</p>
                {!template.isActive && !template.isArchived && (
                  <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">Inactiva</Badge>
                )}
                {template.isArchived && (
                  <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">Archivada</Badge>
                )}
              </div>
              {template.description && (
                <p className="text-sm text-muted-foreground truncate">{template.description}</p>
              )}

              {/* Mobile: income/expense row */}
              <div className="flex items-center gap-3 mt-1 sm:hidden text-xs">
                <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +{formatCurrency(template.totalIncome, baseCurrency)}
                </span>
                <span className="text-red-600 dark:text-red-400 tabular-nums">
                  -{formatCurrency(template.totalExpense, baseCurrency)}
                </span>
                <span
                  className={`font-medium tabular-nums ${
                    netAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  = {formatCurrency(netAmount, baseCurrency)}
                </span>
              </div>
            </div>
          </div>

          {/* Right side: totals + badge + actions */}
          <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* Desktop: income/expense */}
            <div className="text-right hidden sm:block">
              <p className="text-sm tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400">
                  +{formatCurrency(template.totalIncome, baseCurrency)}
                </span>
                {' / '}
                <span className="text-red-600 dark:text-red-400">
                  -{formatCurrency(template.totalExpense, baseCurrency)}
                </span>
              </p>
              <p
                className={`text-sm font-medium tabular-nums ${
                  netAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                Neto: {formatCurrency(netAmount, baseCurrency)}
              </p>
            </div>

            <Badge variant="outline" className="tabular-nums">{template.itemsCount} items</Badge>

            <CardActions
              actions={actions}
              title={template.name}
              description={template.description ?? undefined}
              isPending={isPending}
              showInline={showInlineActions}
              onToggleInline={() => setShowInlineActions(!showInlineActions)}
              drawerOpen={showActionsDrawer}
              onDrawerOpenChange={setShowActionsDrawer}
            />
          </div>
        </div>

        {/* Expanded Items */}
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        icon={<Trash2 className="h-7 w-7" />}
        iconVariant="destructive"
        title="Eliminar plantilla"
        description={
          <>
            ¿Eliminar <span className="font-medium text-foreground">{template.name}</span> permanentemente?
            Se eliminarán los <strong>{template.itemsCount} items</strong> asociados.
          </>
        }
        confirmText={isPending ? 'Eliminando...' : 'Eliminar plantilla'}
        variant="destructive"
        size="sm"
        requireConfirmText={CONFIRM_DELETE_TEXT}
        isPending={isPending}
        onConfirm={handleDelete}
      />

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
