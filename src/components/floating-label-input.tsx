'use client';

import { useState, forwardRef, type InputHTMLAttributes } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FloatingLabelInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  valid?: boolean;
  invalid?: boolean;
}

export const FloatingLabelInput = forwardRef<HTMLInputElement, FloatingLabelInputProps>(
  function FloatingLabelInput(
    { label, value, onChange, valid, invalid, className, onFocus, onBlur, placeholder, ...props },
    ref
  ) {
    const [isFocused, setIsFocused] = useState(false);
    const isActive = isFocused || !!value;
    const hasError = invalid;
    const showPlaceholder = isFocused && !value && placeholder;

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    return (
      <div className="relative">
        <span
          className={cn(
            'absolute left-3 transition-all flex items-center gap-1 pointer-events-none',
            isActive ? 'top-1.5 text-xs' : 'top-1/2 -translate-y-1/2 text-base',
            valid ? 'text-emerald-600' : hasError ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {label}
          {valid && <CheckCircle2 className="h-3.5 w-3.5" />}
          {hasError && !value && <XCircle className="h-3.5 w-3.5" />}
        </span>
        <Input
          ref={ref}
          className={cn(
            'h-14 pt-5 pb-1',
            valid && 'ring-1 ring-emerald-500',
            hasError && 'ring-1 ring-destructive',
            className
          )}
          placeholder={showPlaceholder ? placeholder : undefined}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
      </div>
    );
  }
);
