'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SubmitButtonProps {
  type?: 'submit' | 'button';
  isPending: boolean;
  pendingText?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function SubmitButton({
  type = 'submit',
  isPending,
  pendingText = 'Guardando...',
  children,
  onClick,
  disabled,
  className,
}: SubmitButtonProps) {
  return (
    <Button
      type={type}
      variant="cta"
      disabled={isPending || disabled}
      onClick={onClick}
      className={cn('w-full relative', className)}
    >
      {isPending ? (
        <>
          <Loader2 className="size-5 animate-spin" />
          {pendingText}
        </>
      ) : (
        <>
          {children}
        </>
      )}
    </Button>
  );
}
