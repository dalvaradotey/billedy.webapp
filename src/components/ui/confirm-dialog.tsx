'use client';

import { useState, useTransition, ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ConfirmDialogBaseProps {
  title: string;
  description: string | React.ReactNode;
  /** Optional icon to display above the title */
  icon?: ReactNode;
  /** Icon container styling variant */
  iconVariant?: 'default' | 'destructive' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  /** Visual variant for the confirm button */
  variant?: 'default' | 'destructive';
  /** Size variant - 'sm' centers content and makes dialog compact */
  size?: 'default' | 'sm';
  /**
   * Require user to type this text to confirm (e.g., "ELIMINAR")
   * When set, the confirm button is disabled until the text matches
   */
  requireConfirmText?: string;
  /** Placeholder for the confirmation input */
  confirmInputPlaceholder?: string;
  onConfirm: () => void | Promise<void>;
  isPending?: boolean;
}

interface ConfirmDialogWithTrigger extends ConfirmDialogBaseProps {
  /** Trigger element that opens the dialog */
  trigger: React.ReactNode;
  /** Disable the trigger */
  disabled?: boolean;
  open?: never;
  onOpenChange?: never;
}

interface ConfirmDialogControlled extends ConfirmDialogBaseProps {
  /** Controlled open state */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  trigger?: never;
  disabled?: never;
}

type ConfirmDialogProps = ConfirmDialogWithTrigger | ConfirmDialogControlled;

const iconVariantStyles = {
  default: 'bg-muted text-muted-foreground',
  destructive: 'bg-red-500/10 text-red-500 dark:text-red-400',
  warning: 'bg-amber-500/10 text-amber-500 dark:text-amber-400',
  info: 'bg-blue-500/10 text-blue-500 dark:text-blue-400',
};

const buttonVariantStyles = {
  default: '',
  destructive: '!bg-red-500/10 !text-red-500 dark:!text-red-400 hover:!bg-red-500/20',
};

/**
 * Reusable confirmation dialog component.
 *
 * Supports two modes:
 * 1. **Trigger mode**: Pass a `trigger` prop and the dialog manages its own state
 * 2. **Controlled mode**: Pass `open` and `onOpenChange` for external state control
 *
 * @example Basic usage
 * ```tsx
 * <ConfirmDialog
 *   trigger={<Button variant="destructive">Delete</Button>}
 *   title="Delete item"
 *   description="Are you sure?"
 *   onConfirm={handleDelete}
 * />
 * ```
 *
 * @example With icon and destructive variant
 * ```tsx
 * <ConfirmDialog
 *   open={showDialog}
 *   onOpenChange={setShowDialog}
 *   icon={<Trash2 className="h-7 w-7" />}
 *   iconVariant="destructive"
 *   title="Eliminar cuenta"
 *   description="¿Eliminar esta cuenta permanentemente?"
 *   variant="destructive"
 *   size="sm"
 *   requireConfirmText="ELIMINAR"
 *   onConfirm={handleDelete}
 * />
 * ```
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    title,
    description,
    icon,
    iconVariant = 'default',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'default',
    size = 'default',
    requireConfirmText,
    confirmInputPlaceholder,
    onConfirm,
  } = props;

  // Internal state for trigger mode
  const [internalOpen, setInternalOpen] = useState(false);
  const [internalPending, startTransition] = useTransition();
  const [confirmInput, setConfirmInput] = useState('');

  // Determine if controlled or uncontrolled
  const isControlled = 'open' in props && props.open !== undefined;
  const open = isControlled ? props.open : internalOpen;
  const setOpen = isControlled ? props.onOpenChange : setInternalOpen;
  const isPending = props.isPending ?? internalPending;

  // Check if confirmation text is required and matches
  const isConfirmTextValid = !requireConfirmText || confirmInput.toUpperCase() === requireConfirmText.toUpperCase();

  const handleConfirm = () => {
    if (!isConfirmTextValid) return;

    if (isControlled) {
      // In controlled mode, let parent handle the async flow
      onConfirm();
    } else {
      // In trigger mode, handle transition internally
      startTransition(async () => {
        await onConfirm();
        setOpen(false);
        setConfirmInput('');
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setConfirmInput('');
    }
  };

  const content = (
    <AlertDialogContent
      size={size}
      className={cn(size === 'sm' && 'rounded-2xl')}
    >
      <AlertDialogHeader>
        {icon && (
          <div className={cn(
            'mx-auto mb-2 w-14 h-14 rounded-xl flex items-center justify-center',
            iconVariantStyles[iconVariant]
          )}>
            {icon}
          </div>
        )}
        <AlertDialogTitle className={cn(size === 'sm' && 'text-center')}>
          {title}
        </AlertDialogTitle>
        <AlertDialogDescription
          asChild={typeof description !== 'string'}
          className={cn(size === 'sm' && 'text-center')}
        >
          {typeof description === 'string' ? description : <div>{description}</div>}
        </AlertDialogDescription>
      </AlertDialogHeader>

      {requireConfirmText && (
        <div className="py-2">
          <Input
            placeholder={confirmInputPlaceholder || `Escribe ${requireConfirmText} para confirmar`}
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value.toUpperCase())}
            className={cn(
              confirmInput && !isConfirmTextValid && 'border-destructive'
            )}
          />
        </div>
      )}

      <AlertDialogFooter className={cn(size === 'sm' && 'mt-2')}>
        <AlertDialogCancel disabled={isPending} className={cn(size === 'sm' && 'flex-1')}>
          {cancelText}
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={handleConfirm}
          disabled={isPending || !isConfirmTextValid}
          className={cn(
            size === 'sm' && 'flex-1',
            buttonVariantStyles[variant]
          )}
        >
          {isPending ? 'Procesando...' : confirmText}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );

  // Trigger mode
  if ('trigger' in props && props.trigger) {
    return (
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogTrigger asChild disabled={props.disabled}>
          {props.trigger}
        </AlertDialogTrigger>
        {content}
      </AlertDialog>
    );
  }

  // Controlled mode
  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      {content}
    </AlertDialog>
  );
}
