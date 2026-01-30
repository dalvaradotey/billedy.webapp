'use client';

import { useState, useTransition, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Pencil, Archive, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import type { Category, CategoryGroup } from './types';

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
  groupedCategories: CategoryGroup[];
  userId: string;
  showArchived?: boolean;
}

export function CategoryList({
  categories,
  groupedCategories,
  userId,
  showArchived = false,
}: CategoryListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingToast, setPendingToast] = useState<{ id: string | number; message: string } | null>(null);

  // Ref para trackear los datos anteriores
  const prevCategoriesRef = useRef<Category[]>(categories);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detectar cuando categories cambia y ocultar loading
  useEffect(() => {
    const dataChanged = categories !== prevCategoriesRef.current ||
                        categories.length !== prevCategoriesRef.current.length ||
                        JSON.stringify(categories.map(c => c.id)) !== JSON.stringify(prevCategoriesRef.current.map(c => c.id));

    if (isRefreshing && dataChanged) {
      if (pendingToast) {
        toast.success(pendingToast.message, { id: pendingToast.id });
        setPendingToast(null);
      }
      setIsRefreshing(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    prevCategoriesRef.current = categories;
  }, [categories, isRefreshing, pendingToast]);

  // Fallback timeout
  useEffect(() => {
    if (isRefreshing && !timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        if (pendingToast) {
          toast.success(pendingToast.message, { id: pendingToast.id });
          setPendingToast(null);
        }
        setIsRefreshing(false);
        timeoutRef.current = null;
      }, 5000);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isRefreshing, pendingToast]);

  const onMutationStart = useCallback(() => {
    setIsRefreshing(true);
  }, []);

  const onMutationSuccess = useCallback((toastId: string | number, message: string) => {
    setPendingToast({ id: toastId, message });
  }, []);

  const onMutationError = useCallback((toastId: string | number, error: string) => {
    toast.error(error, { id: toastId });
    setIsRefreshing(false);
    setPendingToast(null);
  }, []);

  const displayGroups = showArchived
    ? [{ name: 'Archivadas', categories: categories.filter((c) => c.isArchived) }]
    : groupedCategories;

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
            userId={userId}
            category={editingCategory}
            onSuccess={handleDialogClose}
            onMutationStart={onMutationStart}
            onMutationSuccess={onMutationSuccess}
            onMutationError={onMutationError}
          />
        </Dialog>
      </div>

      {isRefreshing ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: Math.max(3, categories.length) }).map((_, i) => (
                <CategoryCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      ) : displayGroups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No hay categorías{showArchived ? ' archivadas' : ''}
        </div>
      ) : (
        <div className="space-y-6">
          {displayGroups.map((group) => (
            <div key={group.name ?? 'sin-grupo'} className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                {group.name ?? 'Sin grupo'}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.categories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    userId={userId}
                    onEdit={() => handleEdit(category)}
                    onMutationStart={onMutationStart}
                    onMutationSuccess={onMutationSuccess}
                    onMutationError={onMutationError}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryCardSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3 border-l-4 border-l-muted">
      <div className="flex items-center gap-3 min-w-0">
        <Skeleton className="h-3 w-3 rounded-full shrink-0" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
      <Skeleton className="h-8 w-8 rounded-md shrink-0" />
    </div>
  );
}

interface CategoryCardProps {
  category: Category;
  userId: string;
  onEdit: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

function CategoryCard({ category, userId, onEdit, onMutationStart, onMutationSuccess, onMutationError }: CategoryCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleArchive = () => {
    const toastId = toast.loading('Archivando...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await archiveCategory(category.id, userId);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Categoría archivada');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleRestore = () => {
    const toastId = toast.loading('Restaurando...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await restoreCategory(category.id, userId);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Categoría restaurada');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleDelete = () => {
    const toastId = toast.loading('Eliminando...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await deleteCategory(category.id, userId);
      setShowDeleteDialog(false);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Categoría eliminada');
      } else {
        onMutationError?.(toastId, result.error);
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
        <div className="min-w-0">
          <p className="font-medium truncate">{category.name}</p>
          <p className="text-xs text-muted-foreground">
            {category.type === 'income' ? 'Ingreso' : 'Gasto'}
          </p>
        </div>
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

      {/* Delete Confirmation Dialog */}
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
  userId: string;
  category: Category | null;
  onSuccess: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

function CategoryDialogContent({ userId, category, onSuccess, onMutationStart, onMutationSuccess, onMutationError }: CategoryDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      name: category?.name ?? '',
      type: category?.type ?? 'expense',
      group: category?.group ?? '',
      color: category?.color ?? PRESET_COLORS[0],
    },
  });

  const onSubmit = (data: CreateCategoryInput) => {
    setError(null);
    const toastId = toast.loading(category ? 'Actualizando...' : 'Creando categoría...');
    onMutationStart?.();

    startTransition(async () => {
      const result = category
        ? await updateCategory(category.id, userId, data)
        : await createCategory(userId, data);

      if (result.success) {
        form.reset();
        onSuccess();
        onMutationSuccess?.(toastId, category ? 'Categoría actualizada' : 'Categoría creada');
      } else {
        setError(result.error);
        onMutationError?.(toastId, result.error);
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
                  <Input placeholder="Ej: Comida" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="expense">Gasto</SelectItem>
                    <SelectItem value="income">Ingreso</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="group"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Grupo (opcional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ej: Fijos, Variables"
                    {...field}
                    value={field.value ?? ''}
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
  type?: 'income' | 'expense';
  placeholder?: string;
}

export function CategorySelect({
  categories,
  value,
  onValueChange,
  type,
  placeholder = 'Selecciona una categoría',
}: CategorySelectProps) {
  const filteredCategories = type
    ? categories.filter((c) => c.type === type && !c.isArchived)
    : categories.filter((c) => !c.isArchived);

  // Agrupar por grupo
  const grouped = new Map<string | null, Category[]>();
  for (const cat of filteredCategories) {
    const g = cat.group;
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g)!.push(cat);
  }

  const sortedGroups = Array.from(grouped.entries()).sort(([a], [b]) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a.localeCompare(b);
  });

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder}>
          {filteredCategories.find((c) => c.id === value)?.name ?? placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {sortedGroups.map(([group, cats]) => (
          <div key={group ?? 'sin-grupo'}>
            {group && (
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {group}
              </div>
            )}
            {cats.map((cat) => (
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
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}
