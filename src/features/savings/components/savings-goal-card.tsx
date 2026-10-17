'use client';

import { useState, useTransition } from 'react';
import { useIsMobile } from '@/hooks';
import { toast } from 'sonner';
import {
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  CheckCircle,
  RotateCcw,
  MoreVertical,
  X,
  PartyPopper,
  ChevronDown,
} from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { cardStyles } from '@/components/card-styles';

import { formatCurrency } from '@/lib/formatting';
import { archiveSavingsGoal, completeSavingsGoal, deleteSavingsGoal } from '../actions';
import type { SavingsGoalWithProgress } from '../types';
import { GOAL_TYPE_LABELS, GOAL_TYPE_ICONS } from './constants';
import { SavingsGoalTransactions } from './savings-goal-transactions';

// ============================================================================
// SAVINGS GOAL CARD
// ============================================================================

interface SavingsGoalCardProps {
  goal: SavingsGoalWithProgress;
  userId: string;
  onEdit: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

export function SavingsGoalCard({
  goal,
  userId,
  onEdit,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: SavingsGoalCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showActionsDrawer, setShowActionsDrawer] = useState(false);
  const [showInlineActions, setShowInlineActions] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const isMobile = useIsMobile();

  const handleDelete = () => {
    const toastId = toast.loading('Eliminando meta...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await deleteSavingsGoal(goal.id, userId);
      setShowDeleteDialog(false);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Meta eliminada');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleArchive = () => {
    setShowArchiveDialog(false);
    const toastId = toast.loading('Archivando meta...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await archiveSavingsGoal(goal.id, userId, true);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Meta archivada');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleRestore = () => {
    const toastId = toast.loading('Restaurando meta...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await archiveSavingsGoal(goal.id, userId, false);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Meta restaurada');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleComplete = () => {
    const toastId = toast.loading('Completando meta...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await completeSavingsGoal(goal.id, userId, true);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Meta completada');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleReopen = () => {
    const toastId = toast.loading('Reabriendo meta...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await completeSavingsGoal(goal.id, userId, false);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Meta reabierta');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const targetAmount = parseFloat(goal.targetAmount);
  const isCompleted = goal.isCompleted;
  const reachedTarget = goal.progressPercentage >= 100;
  const showCompletionSuggestion = reachedTarget && !isCompleted;
  const useCompletedStyle = isCompleted || reachedTarget;

  const description = GOAL_TYPE_LABELS[goal.type];

  const actions = [
    {
      key: 'edit',
      label: 'Editar',
      icon: <Pencil />,
      onClick: onEdit,
    },
    goal.isCompleted
      ? {
          key: 'reopen',
          label: 'Reabrir meta',
          icon: <RotateCcw />,
          onClick: handleReopen,
        }
      : {
          key: 'complete',
          label: 'Marcar completada',
          icon: <CheckCircle />,
          onClick: handleComplete,
        },
    goal.isArchived
      ? {
          key: 'restore',
          label: 'Restaurar',
          icon: <ArchiveRestore />,
          onClick: handleRestore,
        }
      : {
          key: 'archive',
          label: 'Archivar',
          icon: <Archive />,
          onClick: () => setShowArchiveDialog(true),
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
      {/* Card */}
      <div
        onClick={() => {
          if (isMobile) {
            setShowActionsDrawer(true);
          }
        }}
        className={cn(
          cardStyles.base,
          isMobile && 'cursor-pointer',
          goal.isArchived && cardStyles.inactive
        )}
      >
        {/* Top row: Icon + Info + Actions */}
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            'flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-[13px] flex-shrink-0',
            isCompleted
              ? 'bg-jade-soft text-jade dark:bg-jade-soft dark:text-jade'
              : 'bg-sky-soft text-sky dark:bg-sky-soft dark:text-sky'
          )}>
            {GOAL_TYPE_ICONS[goal.type]}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            {/* Row 1: Title + badges + Amount + actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-[15px] truncate">{goal.name}</p>
                  {isCompleted && (
                    <Badge className="shrink-0 text-[10px] px-1.5 py-0 bg-jade-soft text-jade">
                      Completada
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{description}</p>
              </div>

              {/* Desktop: Amount */}
              <p className="hidden sm:block num text-[22px] font-extrabold text-jade shrink-0">
                {formatCurrency(goal.currentBalance, goal.currencyCode)}
              </p>
              {/* Actions toggle (mobile: opens drawer, desktop: toggles inline) */}
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

            {/* Mobile: Amount below description */}
            <p className="num text-[22px] font-extrabold text-jade mt-1 sm:hidden">
              {formatCurrency(goal.currentBalance, goal.currencyCode)}
            </p>

            {/* Mobile actions drawer */}
            <Drawer open={showActionsDrawer} onOpenChange={setShowActionsDrawer}>
              <DrawerContent>
                <DrawerHeader className="text-left pb-2">
                  <DrawerTitle>{goal.name}</DrawerTitle>
                  {description && <DrawerDescription>{description}</DrawerDescription>}
                </DrawerHeader>
                <div className="px-2 pb-2">
                  {actions.map((action) => (
                    <DrawerClose key={action.key} asChild>
                      <button
                        onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                        disabled={isPending}
                        className={cn(
                          cardStyles.drawerAction,
                          action.variant === 'destructive' ? 'active:bg-coral-soft' : 'active:bg-surface-3'
                        )}
                      >
                        <div className={cn(
                          cardStyles.drawerActionIconBox,
                          action.variant === 'destructive' ? 'bg-coral-soft' : 'bg-surface-3'
                        )}>
                          <span className={cn(
                            '[&>svg]:h-5 [&>svg]:w-5',
                            action.variant === 'destructive' ? 'text-coral-text' : 'text-muted-foreground'
                          )}>
                            {action.icon}
                          </span>
                        </div>
                        <span className={cn(
                          'text-base font-medium',
                          action.variant === 'destructive' && 'text-coral-text'
                        )}>
                          {action.label}
                        </span>
                      </button>
                    </DrawerClose>
                  ))}
                </div>
                <div className="px-4 pb-4 pt-2 border-t border-line">
                  <DrawerClose asChild>
                    <button className={cardStyles.drawerCancelButton}>
                      Cancelar
                    </button>
                  </DrawerClose>
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </div>

        {/* Swappable content: Progress ↔ Actions (desktop) */}
        <div className={cn('mt-3', cardStyles.overlayGrid)}>
          {/* Details panel */}
          <div className={cn(
            'transition-all duration-300',
            showInlineActions ? 'opacity-0 scale-95 pointer-events-none h-0 overflow-hidden' : 'opacity-100 scale-100'
          )}>
            {/* Progress section */}
            <div className={useCompletedStyle ? cardStyles.progressSectionCompleted : cardStyles.progressSection}>
              <div className="flex items-baseline justify-between mb-2.5">
                <p className="text-sm">
                  <span className={cn(useCompletedStyle ? cardStyles.progressLabelCompleted : cardStyles.progressLabel, 'font-semibold')}>
                    {formatCurrency(goal.currentBalance, goal.currencyCode)}
                  </span>
                  <span className={useCompletedStyle ? cardStyles.progressSecondaryCompleted : cardStyles.progressSecondary}> / {formatCurrency(targetAmount, goal.currencyCode)}</span>
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <Progress value={Math.min(goal.progressPercentage, 100)} className={cardStyles.progressBar} indicatorClassName={useCompletedStyle ? cardStyles.progressIndicatorCompleted : cardStyles.progressIndicator} />
                <span className={cn('text-sm', useCompletedStyle ? cardStyles.progressPercentageCompleted : cardStyles.progressPercentage)}>
                  {goal.progressPercentage}%
                </span>
              </div>
            </div>
            {/* Completion suggestion banner */}
            {showCompletionSuggestion && (
              <button
                onClick={(e) => { e.stopPropagation(); handleComplete(); }}
                disabled={isPending}
                className="mt-3 w-full flex items-center gap-3 rounded-xl bg-jade-soft px-4 py-3 ring-1 ring-jade/20 transition-colors hover:bg-jade-soft disabled:opacity-50"
              >
                <PartyPopper className="h-5 w-5 text-jade shrink-0" />
                <span className="text-sm font-medium text-jade-text">Meta alcanzada</span>
                <span className="ml-auto text-xs font-medium text-jade">Marcar completada</span>
              </button>
            )}
            {/* Details toggle */}
            <div className="mt-3">
              <button
                onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
                className={cardStyles.toggleButton}
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', showDetails && 'rotate-180')} />
                <span>{showDetails ? 'Ocultar detalle' : 'Ver detalle'}</span>
              </button>
            </div>
            {/* Collapsible transactions */}
            {showDetails && (
              <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <SavingsGoalTransactions goalId={goal.id} userId={userId} currencyCode={goal.currencyCode} />
              </div>
            )}
          </div>

          {/* Actions panel */}
          <div className={cn(
            'transition-all duration-300 flex items-center',
            showInlineActions ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none h-0 overflow-hidden'
          )}>
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
                      ? 'text-coral-text'
                      : 'text-muted-foreground'
                  )}>
                    {action.icon}
                  </span>
                  <span className="text-sm font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile-only: Progress */}
        <div className="mt-3 sm:hidden">
          <div className={useCompletedStyle ? cardStyles.progressSectionCompleted : cardStyles.progressSection}>
            <div className="flex items-baseline justify-between mb-2.5">
              <p className="text-base">
                <span className={cn(useCompletedStyle ? cardStyles.progressLabelCompleted : cardStyles.progressLabel, 'font-semibold')}>
                  {formatCurrency(goal.currentBalance, goal.currencyCode)}
                </span>
                <span className={useCompletedStyle ? cardStyles.progressSecondaryCompleted : cardStyles.progressSecondary}> / {formatCurrency(targetAmount, goal.currencyCode)}</span>
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Progress value={Math.min(goal.progressPercentage, 100)} className={cardStyles.progressBar} indicatorClassName={useCompletedStyle ? cardStyles.progressIndicatorCompleted : cardStyles.progressIndicator} />
              <span className={cn('text-xl', useCompletedStyle ? cardStyles.progressPercentageCompleted : cardStyles.progressPercentage)}>
                {goal.progressPercentage}%
              </span>
            </div>
          </div>
          {/* Completion suggestion banner (mobile) */}
          {showCompletionSuggestion && (
            <button
              onClick={(e) => { e.stopPropagation(); handleComplete(); }}
              disabled={isPending}
              className="mt-3 w-full flex items-center gap-3 rounded-xl bg-jade-soft px-4 py-3 ring-1 ring-jade/20 transition-colors active:bg-jade-soft disabled:opacity-50"
            >
              <PartyPopper className="h-5 w-5 text-jade shrink-0" />
              <span className="text-sm font-medium text-jade-text">Meta alcanzada</span>
              <span className="ml-auto text-xs font-medium text-jade">Marcar completada</span>
            </button>
          )}
          {/* Details toggle (mobile) */}
          <div className="mt-3">
            <button
              onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
              className={cardStyles.toggleButton}
            >
              <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', showDetails && 'rotate-180')} />
              <span>{showDetails ? 'Ocultar detalle' : 'Ver detalle'}</span>
            </button>
          </div>
          {/* Collapsible transactions (mobile) */}
          {showDetails && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <SavingsGoalTransactions goalId={goal.id} userId={userId} currencyCode={goal.currencyCode} />
            </div>
          )}
        </div>
      </div>

      {/* Archive Confirmation */}
      <ConfirmDialog
        open={showArchiveDialog}
        onOpenChange={setShowArchiveDialog}
        icon={<Archive className="h-7 w-7" />}
        iconVariant="default"
        title="Archivar meta"
        description={
          <>
            ¿Archivar <span className="font-medium text-foreground">{goal.name}</span>?
            La meta no aparecerá en tus listados activos pero podrás restaurarla en cualquier momento.
          </>
        }
        confirmText={isPending ? 'Archivando...' : 'Archivar'}
        size="sm"
        isPending={isPending}
        onConfirm={handleArchive}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        icon={<Trash2 className="h-7 w-7" />}
        iconVariant="destructive"
        title="Eliminar meta de ahorro"
        description={
          <>
            ¿Eliminar <span className="font-medium text-foreground">{goal.name}</span> permanentemente?
            Las transacciones vinculadas no se eliminarán, solo perderán la asociación a esta meta.
          </>
        }
        confirmText={isPending ? 'Eliminando...' : 'Eliminar'}
        variant="destructive"
        size="sm"
        requireConfirmText="ELIMINAR"
        isPending={isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
