'use client';

import { type ReactNode, type MouseEvent } from 'react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface SwitchCardProps {
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Show green ring when checked */
  showActiveState?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * SwitchCard - A card-style switch with title and description
 *
 * Provides a consistent pattern for toggle options with optional visual feedback when active.
 * The entire card is clickable to toggle the switch.
 */
export function SwitchCard({
  title,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  showActiveState = true,
  className,
  children,
}: SwitchCardProps) {
  const handleCardClick = () => {
    if (!disabled) {
      onCheckedChange(!checked);
    }
  };

  const handleSwitchClick = (e: MouseEvent) => {
    // Prevent double toggle when clicking directly on the switch
    e.stopPropagation();
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          onCheckedChange(!checked);
        }
      }}
      className={cn(
        'flex flex-row items-center justify-between rounded-lg border p-3 transition-colors',
        showActiveState && checked && 'ring-1 ring-emerald-500',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-accent/50',
        className
      )}
    >
      <div className="space-y-0.5">
        <span className="text-sm font-medium leading-none">
          {title}
        </span>
        {description && (
          <p className="text-[0.8rem] text-muted-foreground">{description}</p>
        )}
        {children}
      </div>
      <div onClick={handleSwitchClick}>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
