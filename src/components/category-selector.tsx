'use client';

import { useState, useTransition, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDrawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
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
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
  onCategoryCreated?: (category: { id: string; name: string; color: string }) => void;
}

export function CategorySelector({
  categories,
  value,
  onValueChange,
  projectId,
  userId,
  placeholder = 'Selecciona una categoría',
  allowNone = false,
  noneLabel = 'Sin categoría',
  disabled = false,
  onCategoryCreated,
}: CategorySelectorProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const handleValueChange = (newValue: string) => {
    if (newValue === '__create__') {
      setIsCreateDialogOpen(true);
      return;
    }
    if (newValue === '__none__') {
      onValueChange(null);
      return;
    }
    onValueChange(newValue);
  };

  const handleCategoryCreated = (newCategory: { id: string; name: string; color: string }) => {
    setIsCreateDialogOpen(false);
    onValueChange(newCategory.id);
    onCategoryCreated?.(newCategory);
  };

  const selectedCategory = categories.find((c) => c.id === value);

  return (
    <>
      <Select
        value={value ?? (allowNone ? '__none__' : '')}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="h-11">
          <SelectValue placeholder={placeholder}>
            {selectedCategory ? (
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: selectedCategory.color }}
                />
                <span className="truncate">{selectedCategory.name}</span>
              </div>
            ) : allowNone && !value ? (
              noneLabel
            ) : (
              placeholder
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {allowNone && (
            <SelectItem value="__none__" className="py-3">{noneLabel}</SelectItem>
          )}
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id} className="py-3">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span>{cat.name}</span>
              </div>
            </SelectItem>
          ))}
          <SelectItem value="__create__" className="text-primary py-3">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Crear nueva categoría</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

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
        const newCategory = {
          id: result.data.id,
          name: data.name,
          color: data.color,
        };
        form.reset(getDefaultValues());
        onSuccess(newCategory);
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
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Nueva categoría</DrawerTitle>
            <DrawerDescription>
              Crea una nueva categoría para organizar tus transacciones.
            </DrawerDescription>
          </DrawerHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 pb-4 max-h-[70vh] md:max-h-[calc(100vh-8rem)] overflow-y-auto">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Comida, Transporte"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`h-6 w-6 rounded-full border-2 transition-all ${
                              field.value === color
                                ? 'border-foreground scale-110'
                                : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => field.onChange(color)}
                          />
                        ))}
                      </div>
                      <Input
                        type="text"
                        placeholder="#3b82f6"
                        {...field}
                        className="font-mono"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

              {error && <p className="text-sm text-destructive">{error}</p>}

              <DrawerFooter className="pt-4">
                <Button type="submit" disabled={isPending} className="w-full">
                  {isPending ? 'Creando...' : 'Crear categoría'}
                </Button>
              </DrawerFooter>
            </form>
          </Form>
        </div>
      </DrawerContent>
    </ResponsiveDrawer>
  );
}
