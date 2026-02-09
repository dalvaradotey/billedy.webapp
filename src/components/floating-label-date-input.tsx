'use client';

import { forwardRef, useRef, useImperativeHandle, type InputHTMLAttributes } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FloatingLabelDateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  label: string;
  value: Date | undefined;
  onChange: (value: Date | undefined) => void;
  valid?: boolean;
  invalid?: boolean;
}

export const FloatingLabelDateInput = forwardRef<HTMLInputElement, FloatingLabelDateInputProps>(
  function FloatingLabelDateInput(
    { label, value, onChange, valid, invalid, className, ...props },
    ref
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inputRef.current!);

    const hasValue = !!value;
    const hasError = invalid;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value) {
        onChange(new Date(e.target.value + 'T12:00:00'));
      } else {
        onChange(undefined);
      }
    };

    const handleClick = () => {
      // Explicitly trigger the date picker on desktop browsers
      if (inputRef.current && 'showPicker' in inputRef.current) {
        try {
          (inputRef.current as HTMLInputElement).showPicker();
        } catch {
          // Fallback: some browsers may throw if picker is already open
        }
      }
    };

    const formattedValue = value instanceof Date
      ? value.toISOString().split('T')[0]
      : typeof value === 'string'
        ? String(value).split('T')[0]
        : '';

    return (
      <div className="relative" data-vaul-no-drag>
        <span
          className={cn(
            'absolute left-3 top-1.5 text-xs flex items-center gap-1 pointer-events-none',
            valid ? 'text-emerald-600' : hasError ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {label}
          {valid && <CheckCircle2 className="h-3.5 w-3.5" />}
          {hasError && !hasValue && <XCircle className="h-3.5 w-3.5" />}
        </span>
        <Input
          ref={inputRef}
          type="date"
          data-vaul-no-drag
          onClick={handleClick}
          className={cn(
            'h-14 pt-5 pb-1',
            hasValue && valid && 'ring-1 ring-emerald-500',
            hasError && 'ring-1 ring-destructive',
            className
          )}
          value={formattedValue}
          onChange={handleChange}
          {...props}
        />
      </div>
    );
  }
);
