'use client';

import { useState, type ReactNode } from 'react';
import { Check, CheckCircle2, ChevronsUpDown, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface SearchableSelectOption {
  id: string;
  label: string;
  searchValue?: string; // Additional text for search matching
  group?: string;
  icon?: ReactNode;
  image?: string | null;
  color?: string | null; // Color circle indicator
}

// Render the visual indicator for an option (image > color > icon)
function OptionIndicator({
  image,
  color,
  icon,
  label,
  size = 'md',
  className,
}: {
  image?: string | null;
  color?: string | null;
  icon?: ReactNode;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const sizeClasses = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  const colorSizeClasses = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  if (image) {
    return (
      <img
        src={image}
        alt={label}
        className={cn(sizeClasses, 'rounded object-contain bg-white shrink-0', className)}
      />
    );
  }

  if (color) {
    return (
      <span
        className={cn(colorSizeClasses, 'rounded shrink-0', className)}
        style={{ backgroundColor: color }}
      />
    );
  }

  if (icon) {
    return <span className={cn('shrink-0', className)}>{icon}</span>;
  }

  return null;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string | null | undefined;
  onValueChange: (value: string | null) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  allowNone?: boolean;
  noneLabel?: string;
  noneIcon?: ReactNode;
  disabled?: boolean;
  groupLabels?: Record<string, string>;
  renderSelected?: (option: SearchableSelectOption) => ReactNode;
  valid?: boolean;
  invalid?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  label,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'No se encontraron resultados.',
  allowNone = false,
  noneLabel = 'Ninguno',
  noneIcon,
  disabled = false,
  groupLabels = {},
  renderSelected,
  valid,
  invalid,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  // Group options
  const groupedOptions = options.reduce<Record<string, SearchableSelectOption[]>>(
    (acc, option) => {
      const group = option.group || '__default__';
      if (!acc[group]) acc[group] = [];
      acc[group].push(option);
      return acc;
    },
    {}
  );

  const selectedOption = options.find((o) => o.id === value);

  const handleSelect = (optionId: string) => {
    if (optionId === '__none__') {
      onValueChange(null);
    } else {
      onValueChange(optionId === value ? null : optionId);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between font-normal',
            label ? 'h-14 py-1' : 'h-12',
            valid && 'ring-1 ring-emerald-500',
            invalid && 'ring-1 ring-destructive'
          )}
          disabled={disabled}
        >
          {label ? (
            // Floating label layout
            <div className="flex flex-col items-start gap-0.5 min-w-0">
              <span
                className={cn(
                  'transition-all flex items-center gap-1',
                  selectedOption ? 'text-xs' : 'text-base',
                  valid ? 'text-emerald-600' : invalid ? 'text-destructive' : 'text-muted-foreground'
                )}
              >
                {label}
                {valid && <CheckCircle2 className="h-3.5 w-3.5" />}
                {invalid && <XCircle className="h-3.5 w-3.5" />}
              </span>
              {selectedOption && (
                renderSelected ? (
                  renderSelected(selectedOption)
                ) : (
                  <div className="flex items-center gap-2 truncate">
                    <OptionIndicator
                      image={selectedOption.image}
                      color={selectedOption.color}
                      icon={selectedOption.icon}
                      label={selectedOption.label}
                      size="sm"
                    />
                    <span className="truncate text-sm">{selectedOption.label}</span>
                  </div>
                )
              )}
            </div>
          ) : (
            // Original layout without label
            selectedOption ? (
              renderSelected ? (
                renderSelected(selectedOption)
              ) : (
                <div className="flex items-center gap-2 truncate">
                  <OptionIndicator
                    image={selectedOption.image}
                    color={selectedOption.color}
                    icon={selectedOption.icon}
                    label={selectedOption.label}
                    size="md"
                  />
                  <span className="truncate">{selectedOption.label}</span>
                </div>
              )
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] sm:w-[300px] p-0"
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-[200px] overflow-y-auto overscroll-contain">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {allowNone && (
              <CommandGroup>
                <CommandItem
                  value="__none__"
                  onSelect={() => handleSelect('__none__')}
                  className="py-4"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      !value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {noneIcon && <span className="mr-2">{noneIcon}</span>}
                  <span>{noneLabel}</span>
                </CommandItem>
              </CommandGroup>
            )}
            {Object.entries(groupedOptions).map(([group, groupOptions]) => (
              <CommandGroup
                key={group}
                heading={group !== '__default__' ? (groupLabels[group] ?? group) : undefined}
              >
                {groupOptions.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.searchValue || option.label}
                    onSelect={() => handleSelect(option.id)}
                    className="py-4"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value === option.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <OptionIndicator
                      image={option.image}
                      color={option.color}
                      icon={option.icon}
                      label={option.label}
                      size="md"
                      className="mr-2"
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
