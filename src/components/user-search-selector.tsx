'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { Check, CheckCircle2, ChevronsUpDown, Loader2, Search, User, XCircle } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export interface UserSearchResult {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface UserSearchSelectorProps {
  value: UserSearchResult | null;
  onValueChange: (user: UserSearchResult | null) => void;
  searchAction: (query: string) => Promise<{ success: true; data: UserSearchResult[] } | { success: false; error: string }>;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  valid?: boolean;
  invalid?: boolean;
  debounceMs?: number;
}

export function UserSearchSelector({
  value,
  onValueChange,
  searchAction,
  label,
  placeholder = 'Buscar usuario...',
  searchPlaceholder = 'Escribe un correo...',
  emptyMessage = 'No se encontraron usuarios.',
  disabled = false,
  valid,
  invalid,
  debounceMs = 300,
}: UserSearchSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchRef = useRef<string>('');

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Limpiar resultados si la query es muy corta
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    // No buscar si es la misma query
    if (searchQuery === lastSearchRef.current) {
      return;
    }

    debounceRef.current = setTimeout(() => {
      lastSearchRef.current = searchQuery;
      startTransition(async () => {
        const response = await searchAction(searchQuery);
        if (response.success) {
          setResults(response.data);
        }
      });
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, searchAction, debounceMs]);

  const handleSelect = (user: UserSearchResult) => {
    onValueChange(user);
    setOpen(false);
    setSearchQuery('');
    setResults([]);
  };

  const handleClear = () => {
    onValueChange(null);
    setSearchQuery('');
    setResults([]);
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
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
            <div className="flex flex-col items-start gap-0.5 min-w-0">
              <span
                className={cn(
                  'transition-all flex items-center gap-1',
                  value ? 'text-xs' : 'text-base',
                  valid ? 'text-emerald-600' : invalid ? 'text-destructive' : 'text-muted-foreground'
                )}
              >
                {label}
                {valid && <CheckCircle2 className="h-3.5 w-3.5" />}
                {invalid && <XCircle className="h-3.5 w-3.5" />}
              </span>
              {value && (
                <div className="flex items-center gap-2 truncate">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={value.image ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(value.name, value.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm">
                    {value.name ?? value.email}
                  </span>
                </div>
              )}
            </div>
          ) : (
            value ? (
              <div className="flex items-center gap-2 truncate">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={value.image ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(value.name, value.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start min-w-0">
                  {value.name && (
                    <span className="truncate text-sm">{value.name}</span>
                  )}
                  <span className="truncate text-xs text-muted-foreground">
                    {value.email}
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground flex items-center gap-2">
                <Search className="h-4 w-4" />
                {placeholder}
              </span>
            )
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] sm:w-[350px] p-0"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList className="max-h-[250px] overflow-y-auto overscroll-contain">
            {isPending ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : searchQuery.length < 2 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Escribe al menos 2 caracteres para buscar
              </div>
            ) : results.length === 0 ? (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            ) : (
              <CommandGroup heading="Usuarios encontrados">
                {results.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={user.email}
                    onSelect={() => handleSelect(user)}
                    className="py-3"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value?.id === user.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <Avatar className="h-8 w-8 mr-3">
                      <AvatarImage src={user.image ?? undefined} />
                      <AvatarFallback>
                        {getInitials(user.name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start min-w-0">
                      {user.name && (
                        <span className="truncate font-medium">{user.name}</span>
                      )}
                      <span className="truncate text-sm text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
