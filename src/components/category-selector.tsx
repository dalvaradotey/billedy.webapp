'use client';

import { useState, useTransition, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Check, CheckCircle2, XCircle, ChevronsUpDown, Tag, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFormValidation, useSuccessAnimation } from '@/hooks';
import { FormDrawer, FormDrawerBody, FormDrawerFooter } from '@/components/form-drawer';
import { SubmitButton } from '@/components/submit-button';
import { FloatingLabelInput } from '@/components/floating-label-input';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDrawer,
} from '@/components/ui/drawer';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { createCategory } from '@/features/categories/actions';

// Colores predefinidos para categorías
const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
];

const createCategorySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido'),
});

type CreateCategoryFormInput = z.infer<typeof createCategorySchema>;

export interface CategoryOption {
  id: string;
  name: string;
  color: string;
}

interface CategorySelectorProps {
  categories: CategoryOption[];
  value: string | null | undefined;
  onValueChange: (value: string | null) => void;
  projectId: string;
  userId: string;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
  onCategoryCreated?: (category: { id: string; name: string; color: string }) => void;
  valid?: boolean;
  invalid?: boolean;
}

export function CategorySelector({
  categories,
  value,
  onValueChange,
  projectId,
  userId,
  label,
  placeholder = 'Selecciona una categoría',
  searchPlaceholder = 'Buscar categoría...',
  allowNone = false,
  noneLabel = 'Sin categoría',
  disabled = false,
  onCategoryCreated,
  valid,
  invalid,
}: CategorySelectorProps) {
  const [open, setOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const selectedCategory = categories.find((c) => c.id === value);

  const handleSelect = (categoryId: string) => {
    if (categoryId === '__none__') {
      onValueChange(null);
    } else if (categoryId === '__create__') {
      setOpen(false);
      setIsCreateDialogOpen(true);
      return;
    } else {
      onValueChange(categoryId === value ? null : categoryId);
    }
    setOpen(false);
  };

  const handleCategoryCreated = (newCategory: { id: string; name: string; color: string }) => {
    setIsCreateDialogOpen(false);
    onValueChange(newCategory.id);
    onCategoryCreated?.(newCategory);
  };

  return (
    <>
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
                    selectedCategory ? 'text-xs' : 'text-base',
                    valid ? 'text-emerald-600' : invalid ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  {label}
                  {valid && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {invalid && <XCircle className="h-3.5 w-3.5" />}
                </span>
                {selectedCategory && (
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="h-3 w-3 rounded shrink-0"
                      style={{ backgroundColor: selectedCategory.color }}
                    />
                    <span className="truncate text-sm">{selectedCategory.name}</span>
                  </div>
                )}
              </div>
            ) : (
              // Original layout without label
              selectedCategory ? (
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="h-3 w-3 rounded shrink-0"
                    style={{ backgroundColor: selectedCategory.color }}
                  />
                  <span className="truncate">{selectedCategory.name}</span>
                </div>
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
              <CommandEmpty>No se encontraron categorías.</CommandEmpty>
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
                    <Tag className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{noneLabel}</span>
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup heading="Categorías">
                {categories.map((category) => (
                  <CommandItem
                    key={category.id}
                    value={category.name}
                    onSelect={() => handleSelect(category.id)}
                    className="py-4"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value === category.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span
                      className="mr-2 h-3 w-3 rounded shrink-0"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="truncate">{category.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup>
                <CommandItem
                  value="__create__ crear nueva categoría"
                  onSelect={() => handleSelect('__create__')}
                  className="py-4 text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <span>Crear nueva categoría</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <CreateCategoryDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        projectId={projectId}
        userId={userId}
        onSuccess={handleCategoryCreated}
      />
    </>
  );
}

interface CreateCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  userId: string;
  onSuccess: (category: { id: string; name: string; color: string }) => void;
}

function CreateCategoryDialog({
  open,
  onOpenChange,
  projectId,
  userId,
  onSuccess,
}: CreateCategoryDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pendingCategoryRef = useRef<{ id: string; name: string; color: string } | null>(null);

  // Form UX hooks
  const { onInvalid } = useFormValidation();
  const { showSuccess, triggerSuccess } = useSuccessAnimation({
    onComplete: () => {
      if (pendingCategoryRef.current) {
        onSuccess(pendingCategoryRef.current);
        pendingCategoryRef.current = null;
      }
    },
  });

  const getDefaultValues = useCallback(
    () => ({
      name: '',
      color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
    }),
    []
  );

  const form = useForm<CreateCategoryFormInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: getDefaultValues(),
  });

  const onSubmit = (data: CreateCategoryFormInput) => {
    setError(null);
    const toastId = toast.loading('Creando categoría...');

    startTransition(async () => {
      const result = await createCategory(userId, {
        projectId,
        name: data.name,
        color: data.color,
      });

      if (result.success) {
        toast.success('Categoría creada', { id: toastId });
        pendingCategoryRef.current = {
          id: result.data.id,
          name: data.name,
          color: data.color,
        };
        form.reset(getDefaultValues());
        triggerSuccess();
      } else {
        toast.error(result.error, { id: toastId });
        setError(result.error);
      }
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset(getDefaultValues());
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <ResponsiveDrawer open={open} onOpenChange={handleOpenChange}>
      <FormDrawer
        title="Nueva categoría"
        description="Crea una nueva categoría para organizar tus transacciones."
        showSuccess={showSuccess}
      >
        <Form {...form}>
          <FormDrawerBody as="form" onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormControl>
                    <FloatingLabelInput
                      label="Nombre"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="Ej: Comida, Transporte"
                      autoFocus
                      valid={fieldState.isDirty && !fieldState.invalid}
                      invalid={fieldState.invalid}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field, fieldState }) => (
                <FormItem>
                  <div
                    className={cn(
                      'flex items-center gap-1 text-sm font-medium',
                      fieldState.isDirty && !fieldState.invalid
                        ? 'text-emerald-600'
                        : fieldState.invalid
                          ? 'text-destructive'
                          : 'text-foreground'
                    )}
                  >
                    Color
                    {fieldState.isDirty && !fieldState.invalid && (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    {fieldState.invalid && <XCircle className="h-3.5 w-3.5" />}
                  </div>
                  <FormControl>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={cn(
                              'relative h-7 w-7 rounded-full border-2 transition-all',
                              field.value === color
                                ? 'border-foreground scale-110'
                                : 'border-transparent hover:scale-105'
                            )}
                            style={{ backgroundColor: color }}
                            onClick={() => field.onChange(color)}
                          >
                            {field.value === color && (
                              <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
                            )}
                          </button>
                        ))}
                      </div>
                      <FloatingLabelInput
                        label="Código de color"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="#3b82f6"
                        className="font-mono"
                        valid={fieldState.isDirty && !fieldState.invalid}
                        invalid={fieldState.invalid}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <FormDrawerFooter>
              <SubmitButton
                isPending={isPending}
                pendingText="Creando..."
                icon={<ArrowRight className="size-7" />}
              >
                Crear categoría
              </SubmitButton>
            </FormDrawerFooter>
          </FormDrawerBody>
        </Form>
      </FormDrawer>
    </ResponsiveDrawer>
  );
}
