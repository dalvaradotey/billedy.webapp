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
  MoreVertical,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  ResponsiveDrawer,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { cardStyles } from '@/components/card-styles';

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

  const netColor = netAmount >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <>
      <div
        className={cn(
          cardStyles.base,
          'p-0',
          template.isArchived && cardStyles.inactive,
          !template.isActive && !template.isArchived && 'ring-1 ring-dashed ring-border'
        )}
      >
        {/* Header - clickable for expand/collapse */}
        <div
          className="p-4 cursor-pointer active:bg-muted/50 transition-colors rounded-2xl space-y-1"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Top row: Chevron + Title + amounts + actions (centered) */}
          <div className="flex items-center gap-3">
            {/* Chevron */}
            <div className="shrink-0 text-muted-foreground">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </div>

            {/* Title + badges */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-base sm:text-lg truncate">{template.name}</p>
                {!template.isActive && !template.isArchived && (
                  <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">Inactiva</Badge>
                )}
                {template.isArchived && (
                  <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">Archivada</Badge>
                )}
                <Badge variant="outline" className="shrink-0 tabular-nums text-[10px] px-1.5 py-0">
                  {template.itemsCount} items
                </Badge>
              </div>
              {template.description && (
                <p className="text-sm text-muted-foreground truncate">{template.description}</p>
              )}
            </div>

            {/* Desktop: Net amount */}
            <div className="text-right hidden sm:block shrink-0">
              <p className={cn('text-2xl font-bold tabular-nums', netColor)}>
                {formatCurrency(netAmount, baseCurrency)}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400">
                  +{formatCurrency(template.totalIncome, baseCurrency)}
                </span>
                {' / '}
                <span className="text-red-600 dark:text-red-400">
                  -{formatCurrency(template.totalExpense, baseCurrency)}
                </span>
              </p>
            </div>

            {/* Actions toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isMobile) {
                  setShowActionsDrawer(true);
                } else {
                  setShowInlineActions(!showInlineActions);
                }
              }}
              disabled={isPending}
              className={cn(
                cardStyles.actionsButton,
                showInlineActions && 'sm:rotate-90'
              )}
            >
              {showInlineActions && !isMobile ? (
                <X className="h-4 w-4 text-muted-foreground" />
              ) : (
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="sr-only">Acciones</span>
            </button>
          </div>

          {/* Mobile: Compact totals row */}
          <div className="pl-8 flex items-center gap-2 text-sm sm:hidden">
            <span className="text-emerald-600 dark:text-emerald-400 tabular-nums font-medium">
              +{formatCurrency(template.totalIncome, baseCurrency)}
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-red-600 dark:text-red-400 tabular-nums font-medium">
              -{formatCurrency(template.totalExpense, baseCurrency)}
            </span>
            <span className="text-muted-foreground/40">=</span>
            <span className={cn('tabular-nums font-bold', netColor)}>
              {formatCurrency(netAmount, baseCurrency)}
            </span>
          </div>

          {/* Mobile actions drawer */}
          <Drawer open={showActionsDrawer} onOpenChange={setShowActionsDrawer}>
            <DrawerContent>
              <DrawerHeader className="text-left pb-2">
                <DrawerTitle>{template.name}</DrawerTitle>
                {template.description && <DrawerDescription>{template.description}</DrawerDescription>}
              </DrawerHeader>
              <div className="px-2 pb-2">
                {actions.map((action) => (
                  <DrawerClose key={action.key} asChild>
                    <button
                      onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                      disabled={isPending}
                      className={cn(
                        cardStyles.drawerAction,
                        action.variant === 'destructive' ? 'active:bg-red-500/10' : 'active:bg-muted'
                      )}
                    >
                      <div className={cn(
                        cardStyles.drawerActionIconBox,
                        action.variant === 'destructive' ? 'bg-red-500/10' : 'bg-muted'
                      )}>
                        <span className={cn(
                          '[&>svg]:h-5 [&>svg]:w-5',
                          action.variant === 'destructive' ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'
                        )}>
                          {action.icon}
                        </span>
                      </div>
                      <span className={cn(
                        'text-base font-medium',
                        action.variant === 'destructive' && 'text-red-500 dark:text-red-400'
                      )}>
                        {action.label}
                      </span>
                    </button>
                  </DrawerClose>
                ))}
              </div>
              <div className="px-4 pb-4 pt-2 border-t">
                <DrawerClose asChild>
                  <button className={cardStyles.drawerCancelButton}>
                    Cancelar
                  </button>
                </DrawerClose>
              </div>
            </DrawerContent>
          </Drawer>
        </div>

        {/* Desktop: Inline actions */}
        {showInlineActions && (
          <div className="px-4 pb-4 hidden sm:block animate-in fade-in slide-in-from-top-2 duration-200">
            <div className={cardStyles.inlineActionsGrid}>
              {actions.map((action) => (
                <button
                  key={action.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                  }}
                  disabled={isPending}
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-colors disabled:opacity-50',
                    action.variant === 'destructive'
                      ? cardStyles.inlineActionDestructive
                      : cardStyles.inlineActionDefault
                  )}
                >
                  <span className={cn(
                    '[&>svg]:h-5 [&>svg]:w-5',
                    action.variant === 'destructive'
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-muted-foreground'
                  )}>
                    {action.icon}
                  </span>
                  <span className="text-sm font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Expanded Items */}
        {isExpanded && (
          <div className="border-t border-border/50 px-4 py-3 space-y-2">
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
