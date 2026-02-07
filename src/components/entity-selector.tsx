'use client';

import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Store } from 'lucide-react';
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
import { entityTypeLabels, type EntityType } from '@/features/entities/types';

export interface EntityOption {
  id: string;
  name: string;
  type: string;
  imageUrl: string | null;
}

interface EntitySelectorProps {
  entities: EntityOption[];
  value: string | null | undefined;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  filterByType?: EntityType[];
  disabled?: boolean;
}

export function EntitySelector({
  entities,
  value,
  onValueChange,
  placeholder = 'Selecciona una entidad',
  searchPlaceholder = 'Buscar entidad...',
  allowNone = true,
  noneLabel = 'Sin entidad',
  filterByType,
  disabled = false,
}: EntitySelectorProps) {
  const [open, setOpen] = useState(false);

  // Filter entities by type if specified
  const filteredEntities = useMemo(() => {
    if (!filterByType || filterByType.length === 0) {
      return entities;
    }
    return entities.filter((e) => filterByType.includes(e.type as EntityType));
  }, [entities, filterByType]);

  // Group entities by type for better organization
  const groupedEntities = useMemo(() => {
    const groups: Record<string, EntityOption[]> = {};
    for (const entity of filteredEntities) {
      const type = entity.type as EntityType;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(entity);
    }
    return groups;
  }, [filteredEntities]);

  const selectedEntity = filteredEntities.find((e) => e.id === value);

  const handleSelect = (entityId: string) => {
    if (entityId === '__none__') {
      onValueChange(null);
    } else {
      onValueChange(entityId === value ? null : entityId);
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
          {selectedEntity ? (
            <div className="flex items-center gap-2 truncate">
              <EntityImage
                imageUrl={selectedEntity.imageUrl}
                name={selectedEntity.name}
                size="sm"
              />
              <span className="truncate">{selectedEntity.name}</span>
            </div>
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
            <CommandEmpty>No se encontraron entidades.</CommandEmpty>
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
                  <Store className="mr-2 h-5 w-5 text-muted-foreground" />
                  <span>{noneLabel}</span>
                </CommandItem>
              </CommandGroup>
            )}
            {Object.entries(groupedEntities).map(([type, typeEntities]) => (
              <CommandGroup
                key={type}
                heading={entityTypeLabels[type as EntityType] ?? type}
              >
                {typeEntities.map((entity) => (
                  <CommandItem
                    key={entity.id}
                    value={`${entity.name} ${entityTypeLabels[entity.type as EntityType]}`}
                    onSelect={() => handleSelect(entity.id)}
                    className="py-3"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value === entity.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <EntityImage
                      imageUrl={entity.imageUrl}
                      name={entity.name}
                      size="sm"
                      className="mr-2"
                    />
                    <span className="truncate">{entity.name}</span>
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

interface EntityImageProps {
  imageUrl: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function EntityImage({ imageUrl, name, size = 'md', className }: EntityImageProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={cn(
          sizeClasses[size],
          'rounded object-contain bg-white shrink-0',
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClasses[size],
        'rounded bg-muted flex items-center justify-center shrink-0',
        className
      )}
    >
      <Store className="h-3 w-3 text-muted-foreground" />
    </div>
  );
}
