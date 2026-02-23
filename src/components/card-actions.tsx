'use client';

import { useState, ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';
import { useIsMobile } from '@/hooks';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

export interface CardAction {
  /** Unique key for the action */
  key: string;
  /** Display label */
  label: string;
  /** Icon component */
  icon: ReactNode;
  /** Click handler */
  onClick: () => void;
  /** Visual variant */
  variant?: 'default' | 'destructive';
  /** Whether to close drawer/inline after click (default: true for default, false for destructive) */
  closeOnClick?: boolean;
  /** Disable this action */
  disabled?: boolean;
  /** Hide this action */
  hidden?: boolean;
}

interface CardActionsProps {
  /** List of actions to display */
  actions: CardAction[];
  /** Title for mobile drawer */
  title: string;
  /** Description for mobile drawer (optional) */
  description?: string;
  /** Whether any action is pending */
  isPending?: boolean;
  /** Show inline actions (desktop) */
  showInline: boolean;
  /** Toggle inline actions visibility */
  onToggleInline: () => void;
  /** Controlled drawer state (optional) */
  drawerOpen?: boolean;
  /** Controlled drawer change handler (optional) */
  onDrawerOpenChange?: (open: boolean) => void;
  /** Custom class for the inline actions container */
  className?: string;
  /** Content to render between inline actions and toggle button (e.g., amount) */
  children?: React.ReactNode;
}

/**
 * CardActions - Responsive action menu for cards
 *
 * - Mobile: Bottom drawer with large touch targets
 * - Desktop: Inline buttons with slide animation
 *
 * @example
 * ```tsx
 * const [showActions, setShowActions] = useState(false);
 * const isMobile = useIsMobile();
 *
 * <div onClick={() => isMobile ? openDrawer() : setShowActions(!showActions)}>
 *   <CardActions
 *     actions={[
 *       { key: 'edit', label: 'Editar', icon: <Pencil />, onClick: handleEdit },
 *       { key: 'delete', label: 'Eliminar', icon: <Trash2 />, onClick: handleDelete, variant: 'destructive' },
 *     ]}
 *     title="Mi Item"
 *     showInline={showActions}
 *     onToggleInline={() => setShowActions(!showActions)}
 *   />
 * </div>
 * ```
 */
export function CardActions({
  actions,
  title,
  description,
  isPending = false,
  showInline,
  onToggleInline,
  drawerOpen,
  onDrawerOpenChange,
  className,
  children,
}: CardActionsProps) {
  const [internalDrawerOpen, setInternalDrawerOpen] = useState(false);
  const isMobile = useIsMobile();

  // Use controlled state if provided, otherwise use internal state
  const isControlled = drawerOpen !== undefined && onDrawerOpenChange !== undefined;
  const showDrawer = isControlled ? drawerOpen : internalDrawerOpen;
  const setShowDrawer = isControlled ? onDrawerOpenChange : setInternalDrawerOpen;

  const visibleActions = actions.filter(a => !a.hidden);

  const handleActionClick = (action: CardAction, e?: React.MouseEvent) => {
    e?.stopPropagation();

    // Determine if we should close
    const shouldClose = action.closeOnClick ?? (action.variant !== 'destructive');

    if (shouldClose) {
      setShowDrawer(false);
      if (showInline) onToggleInline();
    }

    action.onClick();
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMobile) {
      setShowDrawer(true);
    } else {
      onToggleInline();
    }
  };

  return (
    <>
      {/* Inline Actions (Desktop) */}
      <div
        className={cn(
          'hidden sm:flex items-center gap-2 transition-all duration-300 ease-out overflow-hidden',
          showInline
            ? 'opacity-100 translate-x-0'
            : 'opacity-0 translate-x-4 pointer-events-none w-0',
          className
        )}
      >
        {visibleActions.map((action) => (
          <button
            key={action.key}
            onClick={(e) => handleActionClick(action, e)}
            disabled={isPending || action.disabled}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50',
              action.variant === 'destructive'
                ? 'bg-red-500/10 hover:bg-red-500/20'
                : 'bg-muted/50 hover:bg-muted'
            )}
          >
            <span className={cn(
              action.variant === 'destructive'
                ? 'text-red-500 dark:text-red-400'
                : 'text-muted-foreground',
              '[&>svg]:h-4 [&>svg]:w-4'
            )}>
              {action.icon}
            </span>
            <span className={cn(
              'text-sm font-medium',
              action.variant === 'destructive' && 'text-red-500 dark:text-red-400'
            )}>
              {action.label}
            </span>
          </button>
        ))}
      </div>

      {/* Content slot (e.g., amount) - rendered between inline actions and toggle */}
      {children}

      {/* Mobile indicator (visible only on mobile) */}
      <button
        onClick={handleToggleClick}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-muted/50 sm:hidden"
      >
        <MoreVertical className="h-4 w-4 text-muted-foreground" />
        <span className="sr-only">Acciones</span>
      </button>

      {/* Desktop toggle button */}
      <button
        onClick={handleToggleClick}
        disabled={isPending}
        className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-muted/50 hover:bg-muted transition-colors disabled:opacity-50"
      >
        <MoreVertical className="h-4 w-4 text-muted-foreground" />
        <span className="sr-only">Acciones</span>
      </button>

      {/* Mobile Drawer */}
      <Drawer open={showDrawer} onOpenChange={setShowDrawer}>
        <DrawerContent>
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div className="px-2 pb-2">
            {visibleActions.map((action) => {
              const shouldClose = action.closeOnClick ?? (action.variant !== 'destructive');

              const button = (
                <button
                  key={action.key}
                  onClick={() => handleActionClick(action)}
                  disabled={isPending || action.disabled}
                  className={cn(
                    'w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors disabled:opacity-50',
                    action.variant === 'destructive'
                      ? 'active:bg-red-500/10'
                      : 'active:bg-muted'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    action.variant === 'destructive'
                      ? 'bg-red-500/10'
                      : 'bg-muted'
                  )}>
                    <span className={cn(
                      action.variant === 'destructive'
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-muted-foreground',
                      '[&>svg]:h-5 [&>svg]:w-5'
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
              );

              if (shouldClose) {
                return (
                  <DrawerClose key={action.key} asChild>
                    {button}
                  </DrawerClose>
                );
              }

              return button;
            })}
          </div>
          <div className="px-4 pb-4 pt-2 border-t">
            <DrawerClose asChild>
              <button className="w-full py-3 text-base font-medium text-muted-foreground active:text-foreground transition-colors">
                Cancelar
              </button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

/**
 * Hook to create card click handler that works with CardActions
 */
export function useCardClick(
  isMobile: boolean | undefined,
  showInline: boolean,
  setShowInline: (show: boolean) => void
) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleCardClick = () => {
    if (isMobile) {
      setDrawerOpen(true);
    } else {
      setShowInline(!showInline);
    }
  };

  return {
    handleCardClick,
    drawerOpen,
    setDrawerOpen,
  };
}
