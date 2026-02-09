'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { SuccessOverlay } from '@/components/success-overlay';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

interface FormDrawerProps {
  title: string;
  description?: string;
  showSuccess?: boolean;
  /** Optional content to render in the header area (e.g., progress indicator) */
  headerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * FormDrawer - A reusable drawer layout for forms
 *
 * Provides consistent spacing and structure for form drawers:
 * - Centered content with max-width
 * - Success overlay support
 * - Proper header spacing
 * - Scrollable body area using ScrollArea
 *
 * Usage:
 * ```tsx
 * <FormDrawer title="Nueva cuenta" description="..." showSuccess={showSuccess}>
 *   <Form {...form}>
 *     <FormDrawerBody onSubmit={form.handleSubmit(onSubmit)}>
 *       {form fields}
 *       <FormDrawerFooter>
 *         <SubmitButton ... />
 *       </FormDrawerFooter>
 *     </FormDrawerBody>
 *   </Form>
 * </FormDrawer>
 * ```
 */
export function FormDrawer({
  title,
  description,
  showSuccess = false,
  headerExtra,
  children,
  className,
}: FormDrawerProps) {
  return (
    <DrawerContent>
      <SuccessOverlay show={showSuccess} />
      <div className={cn('mx-auto w-full max-w-lg md:flex md:flex-col md:h-full', className)}>
        <DrawerHeader>
          {headerExtra ? (
            <div className="md:flex md:items-center md:justify-between">
              <DrawerTitle>{title}</DrawerTitle>
              {headerExtra}
            </div>
          ) : (
            <DrawerTitle>{title}</DrawerTitle>
          )}
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        {children}
      </div>
    </DrawerContent>
  );
}

type FormDrawerBodyProps = {
  children: ReactNode;
  className?: string;
} & (
  | { as?: 'div' }
  | { as: 'form'; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; id?: string }
);

/**
 * FormDrawerBody - Container for form content with proper padding and spacing
 *
 * Uses ScrollArea for scrolling (same pattern as transaction form).
 * Can be rendered as a div or a form element.
 * Automatically scrolls to focused inputs when keyboard opens on mobile.
 */
export function FormDrawerBody(props: FormDrawerBodyProps) {
  const { children, className } = props;
  const contentClassName = cn('px-4 pt-2 space-y-4 pb-4', className);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to focused input when keyboard opens on mobile
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        // Small delay to let the keyboard open first
        setTimeout(() => {
          // Find the ScrollArea viewport (Radix uses this data attribute)
          const viewport = container.querySelector('[data-radix-scroll-area-viewport]');
          if (viewport) {
            // Get the FormItem container (parent with data-field attribute)
            const formItem = target.closest('[data-field]') || target.parentElement;
            if (formItem) {
              const viewportRect = viewport.getBoundingClientRect();
              const itemRect = formItem.getBoundingClientRect();

              // Calculate scroll position to center the item
              const scrollTop = viewport.scrollTop + (itemRect.top - viewportRect.top) - (viewportRect.height / 3);
              viewport.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
            }
          }
        }, 150);
      }
    };

    container.addEventListener('focusin', handleFocus);
    return () => container.removeEventListener('focusin', handleFocus);
  }, []);

  if (props.as === 'form') {
    return (
      <div ref={containerRef}>
        <ScrollArea className="h-[65dvh] md:flex-1">
          <form
            id={props.id}
            onSubmit={props.onSubmit}
            className={contentClassName}
          >
            {children}
          </form>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <ScrollArea className="h-[65dvh] md:flex-1">
        <div className={contentClassName}>
          {children}
        </div>
      </ScrollArea>
    </div>
  );
}

interface FormDrawerFooterProps {
  children: ReactNode;
  className?: string;
}

/**
 * FormDrawerFooter - Footer area for submit buttons
 * Should be placed inside FormDrawerBody when using forms.
 */
export function FormDrawerFooter({ children, className }: FormDrawerFooterProps) {
  return (
    <DrawerFooter className={cn('px-0 pb-0', className)}>
      {children}
    </DrawerFooter>
  );
}
