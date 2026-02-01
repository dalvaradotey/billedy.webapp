'use client';

import { useState, useCallback } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface InstallmentSelectorProps {
  value: number | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export function InstallmentSelector({
  value,
  onChange,
  min = 1,
  max = 60,
  className,
}: InstallmentSelectorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const currentValue = value ?? min;

  const handleDecrement = useCallback(() => {
    if (currentValue <= min) {
      // Wrap around to max
      onChange(max);
    } else {
      onChange(currentValue - 1);
    }
  }, [currentValue, min, max, onChange]);

  const handleIncrement = useCallback(() => {
    if (currentValue >= max) {
      // Wrap around to min
      onChange(min);
    } else {
      onChange(currentValue + 1);
    }
  }, [currentValue, min, max, onChange]);

  const handleStartEditing = () => {
    setInputValue(currentValue.toString());
    setIsEditing(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Solo permitir números
    if (/^\d*$/.test(val)) {
      setInputValue(val);
    }
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed)) {
      // Clamp value between min and max
      const clamped = Math.min(Math.max(parsed, min), max);
      onChange(clamped);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 shrink-0 touch-manipulation"
        onClick={handleDecrement}
        aria-label="Disminuir"
      >
        <Minus className="h-4 w-4" />
      </Button>

      {isEditing ? (
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          className="h-10 w-16 text-center font-medium"
          autoFocus
        />
      ) : (
        <button
          type="button"
          onClick={handleStartEditing}
          className="h-10 w-16 rounded-md border border-input bg-background text-center font-medium text-lg hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation"
        >
          {currentValue}
        </button>
      )}

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 shrink-0 touch-manipulation"
        onClick={handleIncrement}
        aria-label="Aumentar"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
