'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Pencil, Archive, RotateCcw, Trash2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { toastActions } from '@/lib/toast-messages';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { createCategory, updateCategory, archiveCategory, restoreCategory, deleteCategory } from './actions';
import { createCategorySchema, type CreateCategoryInput } from './schemas';
import type { Category } from './types';

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

interface CategoryListProps {
  categories: Category[];
  projectId: string;
  userId: string;
  showArchived?: boolean;
}

export function CategoryList({
  categories,
  projectId,
  userId,
  showArchived = false,
}: CategoryListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const displayCategories = showArchived
    ? categories.filter((c) => c.isArchived)
    : categories.filter((c) => !c.isArchived);

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingCategory(null);
  };

  const handleOpenDialog = () => {
    setEditingCategory(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Categorías</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={handleOpenDialog}>
              <Plus className="h-4 w-4" />
              Nueva categoría
            </Button>
          </DialogTrigger>
          <CategoryDialogContent
            projectId={projectId}
            userId={userId}
            category={editingCategory}
            onSuccess={handleDialogClose}
          />
        </Dialog>
      </div>

      {displayCategories.length === 0 ? (
        <EmptyState
          icon={Tag}
          title={showArchived ? 'No hay categorías archivadas' : 'No hay categorías'}
          description="Crea categorías para organizar tus transacciones."
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {displayCategories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              userId={userId}
              onEdit={() => handleEdit(category)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CategoryCardProps {
  category: Category;
  userId: string;
  onEdit: () => void;
}

function CategoryCard({ category, userId, onEdit }: CategoryCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleArchive = () => {
    const { onSuccess, onError } = toastActions.archiving('categoría');
    startTransition(async () => {
      const result = await archiveCategory(category.id, userId);
      if (result.success) {
        onSuccess();
      } else {
        onError(result.error);
      }
    });
  };

  const handleRestore = () => {
    const { onSuccess, onError } = toastActions.restoring('categoría');
    startTransition(async () => {
      const result = await restoreCategory(category.id, userId);
      if (result.success) {
        onSuccess();
      } else {
        onError(result.error);
      }
    });
  };

  const handleDelete = () => {
    const { onSuccess, onError } = toastActions.deleting('categoría');
    startTransition(async () => {
      const result = await deleteCategory(category.id, userId);
      setShowDeleteDialog(false);
      if (result.success) {
        onSuccess();
      } else {
        onError(result.error);
      }
    });
  };

  return (
    <div
      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent/50"
      style={{ borderLeftColor: category.color, borderLeftWidth: '4px' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: category.color }}
        />
        <p className="font-medium truncate">{category.name}</p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={isPending}>
            <span className="sr-only">Acciones</span>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v.01M12 12v.01M12 18v.01" />
            </svg>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!category.isArchived && (
            <>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="mr-2 h-4 w-4" />
                Archivar
              </DropdownMenuItem>
            </>
          )}
          {category.isArchived && (
            <>
              <DropdownMenuItem onClick={handleRestore}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restaurar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar categoría</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar "{category.name}" permanentemente? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface CategoryDialogContentProps {
  projectId: string;
  userId: string;
  category: Category | null;
  onSuccess: () => void;
}

function CategoryDialogContent({ projectId, userId, category, onSuccess }: CategoryDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const getDefaultValues = useCallback(() => ({
    projectId,
    name: category?.name ?? '',
    color: category?.color ?? PRESET_COLORS[0],
  }), [projectId, category]);

  const form = useForm<CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: getDefaultValues(),
  });

  // Reset form when category changes (for edit mode)
  useEffect(() => {
    form.reset(getDefaultValues());
  }, [category, form, getDefaultValues]);

  const onSubmit = (data: CreateCategoryInput) => {
    setError(null);
    const action = category ? toastActions.updating('categoría') : toastActions.creating('categoría');

    startTransition(async () => {
      const result = category
        ? await updateCategory(category.id, userId, { name: data.name, color: data.color })
        : await createCategory(userId, data);

      if (result.success) {
        action.onSuccess();
        form.reset();
        onSuccess();
      } else {
        action.onError(result.error);
        setError(result.error);
      }
    });
  };

  const isEditing = !!category;

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Modifica los datos de la categoría.'
            : 'Crea una nueva categoría para organizar tus transacciones.'}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Comida, Transporte" {...field} />
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

          <DialogFooter>
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear categoría'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}

interface CategorySelectProps {
  categories: Category[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function CategorySelect({
  categories,
  value,
  onValueChange,
  placeholder = 'Selecciona una categoría',
}: CategorySelectProps) {
  const activeCategories = categories.filter((c) => !c.isArchived);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder}>
          {activeCategories.find((c) => c.id === value)?.name ?? placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {activeCategories.map((cat) => (
          <SelectItem key={cat.id} value={cat.id}>
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              {cat.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
