'use client';

import { useState, useTransition } from 'react';
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

interface ConfirmDialogBaseProps {
  title: string;
  description: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
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

/**
 * Reusable confirmation dialog component.
 *
 * Supports two modes:
 * 1. **Trigger mode**: Pass a `trigger` prop and the dialog manages its own state
 * 2. **Controlled mode**: Pass `open` and `onOpenChange` for external state control
 *
 * @example Trigger mode
 * ```tsx
 * <ConfirmDialog
 *   trigger={<Button variant="destructive">Delete</Button>}
 *   title="Delete item"
 *   description="Are you sure?"
 *   onConfirm={handleDelete}
 * />
 * ```
 *
 * @example Controlled mode
 * ```tsx
 * <ConfirmDialog
 *   open={showDialog}
 *   onOpenChange={setShowDialog}
 *   title="Delete item"
 *   description="Are you sure?"
 *   onConfirm={handleDelete}
 * />
 * ```
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    title,
    description,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'default',
    onConfirm,
  } = props;

  // Internal state for trigger mode
  const [internalOpen, setInternalOpen] = useState(false);
  const [internalPending, startTransition] = useTransition();

  // Determine if controlled or uncontrolled
  const isControlled = 'open' in props && props.open !== undefined;
  const open = isControlled ? props.open : internalOpen;
  const setOpen = isControlled ? props.onOpenChange : setInternalOpen;
  const isPending = props.isPending ?? internalPending;

  const handleConfirm = () => {
    if (isControlled) {
      // In controlled mode, let parent handle the async flow
      onConfirm();
    } else {
      // In trigger mode, handle transition internally
      startTransition(async () => {
        await onConfirm();
        setOpen(false);
      });
    }
  };

  const content = (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription asChild={typeof description !== 'string'}>
          {typeof description === 'string' ? description : <div>{description}</div>}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isPending}>{cancelText}</AlertDialogCancel>
        <AlertDialogAction
          onClick={handleConfirm}
          disabled={isPending}
          className={
            variant === 'destructive'
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : ''
          }
        >
          {isPending ? 'Procesando...' : confirmText}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );

  // Trigger mode
  if ('trigger' in props && props.trigger) {
    return (
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild disabled={props.disabled}>
          {props.trigger}
        </AlertDialogTrigger>
        {content}
      </AlertDialog>
    );
  }

  // Controlled mode
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {content}
    </AlertDialog>
  );
}
