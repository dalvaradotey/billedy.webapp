'use client';

import { useState, forwardRef, type TextareaHTMLAttributes } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface FloatingLabelTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  valid?: boolean;
  invalid?: boolean;
}

export const FloatingLabelTextarea = forwardRef<HTMLTextAreaElement, FloatingLabelTextareaProps>(
  function FloatingLabelTextarea(
    { label, value, onChange, valid, invalid, className, onFocus, onBlur, placeholder, rows = 3, ...props },
    ref
  ) {
    const [isFocused, setIsFocused] = useState(false);
    const isActive = isFocused || !!value;
    const hasError = invalid;
    const showPlaceholder = isFocused && !value && placeholder;

    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    return (
      <div className="relative">
        <span
          className={cn(
            'absolute left-3 transition-all flex items-center gap-1 pointer-events-none',
            isActive ? 'top-1.5 text-xs' : 'top-3 text-base',
            valid ? 'text-emerald-600' : hasError ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {label}
          {valid && <CheckCircle2 className="h-3.5 w-3.5" />}
          {hasError && !value && <XCircle className="h-3.5 w-3.5" />}
        </span>
        <Textarea
          ref={ref}
          className={cn(
            'pt-6 pb-2 resize-none',
            valid && 'ring-1 ring-emerald-500',
            hasError && 'ring-1 ring-destructive',
            className
          )}
          placeholder={showPlaceholder ? placeholder : undefined}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          rows={rows}
          {...props}
        />
      </div>
    );
  }
);
