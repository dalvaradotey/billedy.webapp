'use client';

import { useState, type ReactNode } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
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
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string | null | undefined;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  allowNone?: boolean;
  noneLabel?: string;
  noneIcon?: ReactNode;
  disabled?: boolean;
  groupLabels?: Record<string, string>;
  renderSelected?: (option: SearchableSelectOption) => ReactNode;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'No se encontraron resultados.',
  allowNone = false,
  noneLabel = 'Ninguno',
  noneIcon,
  disabled = false,
  groupLabels = {},
  renderSelected,
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
          className="w-full h-11 justify-between font-normal"
          disabled={disabled}
        >
          {selectedOption ? (
            renderSelected ? (
              renderSelected(selectedOption)
            ) : (
              <div className="flex items-center gap-2 truncate">
                {selectedOption.image ? (
                  <img
                    src={selectedOption.image}
                    alt={selectedOption.label}
                    className="h-6 w-6 rounded object-contain bg-white shrink-0"
                  />
                ) : selectedOption.icon ? (
                  <span className="shrink-0">{selectedOption.icon}</span>
                ) : null}
                <span className="truncate">{selectedOption.label}</span>
              </div>
            )
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
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
                  className="py-3"
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
                    className="py-3"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value === option.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {option.image ? (
                      <img
                        src={option.image}
                        alt={option.label}
                        className="mr-2 h-6 w-6 rounded object-contain bg-white shrink-0"
                      />
                    ) : option.icon ? (
                      <span className="mr-2 shrink-0">{option.icon}</span>
                    ) : null}
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
