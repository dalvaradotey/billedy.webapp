'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
  Archive,
  ChevronDown,
  ChevronRight,
  Power,
  PowerOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/currency-input';
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
  DropdownMenuSeparator,
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategorySelector } from '@/components/category-selector';
import { EntitySelector } from '@/components/entity-selector';
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  archiveTemplate,
  toggleTemplateActive,
  createTemplateItem,
  updateTemplateItem,
  deleteTemplateItem,
} from './actions';
import type {
  TemplateWithItems,
  TemplateItemWithDetails,
  TemplatesSummary,
} from './types';

function formatCurrency(amount: number | string, currency: string = 'CLP'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

// ============================================================================
// Main List Component
// ============================================================================

interface TemplateListProps {
  templates: TemplateWithItems[];
  categories: { id: string; name: string; color: string }[];
  accounts: { id: string; name: string }[];
  entities: { id: string; name: string; type: string; imageUrl: string | null }[];
  summary: TemplatesSummary;
  projectId: string;
  userId: string;
  baseCurrency: string;
  showArchived: boolean;
}

export function TemplateList({
  templates,
  categories,
  accounts,
  entities,
  summary,
  projectId,
  userId,
  baseCurrency,
  showArchived,
}: TemplateListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateWithItems | null>(null);

  const handleEdit = (template: TemplateWithItems) => {
    setEditingTemplate(template);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
  };

  const handleOpenDialog = () => {
    setEditingTemplate(null);
    setIsDialogOpen(true);
  };

  const activeTemplates = templates.filter((t) => !t.isArchived);
  const archivedTemplates = templates.filter((t) => t.isArchived);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Plantillas Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeTemplates}</div>
            <p className="text-xs text-muted-foreground">
              de {summary.totalTemplates} totales
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Items Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ingresos Mensuales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalMonthlyIncome, baseCurrency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gastos Mensuales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalMonthlyExpense, baseCurrency)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Plantillas</h2>
          <p className="text-sm text-muted-foreground">
            Configura los items recurrentes que se cargarán en cada ciclo
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={handleOpenDialog}>
              <Plus className="h-4 w-4" />
              Nueva plantilla
            </Button>
          </DialogTrigger>
          <TemplateDialogContent
            projectId={projectId}
            userId={userId}
            template={editingTemplate}
            onSuccess={handleDialogClose}
          />
        </Dialog>
      </div>

      {/* Templates List */}
      {activeTemplates.length === 0 && archivedTemplates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <p>No hay plantillas configuradas</p>
          <p className="text-sm">Crea una plantilla para comenzar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              categories={categories}
              accounts={accounts}
              entities={entities}
              projectId={projectId}
              userId={userId}
              baseCurrency={baseCurrency}
              onEdit={() => handleEdit(template)}
            />
          ))}

          {showArchived && archivedTemplates.length > 0 && (
            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                Plantillas archivadas
              </h3>
              {archivedTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  categories={categories}
                  accounts={accounts}
                  entities={entities}
                  projectId={projectId}
                  userId={userId}
                  baseCurrency={baseCurrency}
                  onEdit={() => handleEdit(template)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Template Card Component
// ============================================================================

interface TemplateCardProps {
  template: TemplateWithItems;
  categories: { id: string; name: string; color: string }[];
  accounts: { id: string; name: string }[];
  entities: { id: string; name: string; type: string; imageUrl: string | null }[];
  projectId: string;
  userId: string;
  baseCurrency: string;
  onEdit: () => void;
}

const CONFIRM_DELETE_TEXT = 'ELIMINAR';

function TemplateCard({
  template,
  categories,
  accounts,
  entities,
  projectId,
  userId,
  baseCurrency,
  onEdit,
}: TemplateCardProps) {
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<TemplateItemWithDetails | null>(null);

  const canDelete = confirmText === CONFIRM_DELETE_TEXT;

  const handleCloseDeleteDialog = (open: boolean) => {
    setShowDeleteDialog(open);
    if (!open) {
      setConfirmText('');
    }
  };

  const handleDelete = () => {
    if (!canDelete) return;
    const toastId = toast.loading('Eliminando plantilla...');
    startTransition(async () => {
      const result = await deleteTemplate(template.id, userId);
      setShowDeleteDialog(false);
      setConfirmText('');
      if (result.success) {
        toast.success('Plantilla eliminada', { id: toastId });
      } else {
        toast.error(result.error, { id: toastId });
      }
    });
  };

  const handleArchive = () => {
    const toastId = toast.loading('Archivando plantilla...');
    startTransition(async () => {
      const result = await archiveTemplate(template.id, userId);
      if (result.success) {
        toast.success('Plantilla archivada', { id: toastId });
      } else {
        toast.error(result.error, { id: toastId });
      }
    });
  };

  const handleToggleActive = () => {
    const toastId = toast.loading(
      template.isActive ? 'Desactivando...' : 'Activando...'
    );
    startTransition(async () => {
      const result = await toggleTemplateActive(template.id, userId);
      if (result.success) {
        toast.success(result.isActive ? 'Plantilla activada' : 'Plantilla desactivada', {
          id: toastId,
        });
      } else {
        toast.error(result.error, { id: toastId });
      }
    });
  };

  const handleAddItem = () => {
    setEditingItem(null);
    setShowItemDialog(true);
  };

  const handleEditItem = (item: TemplateItemWithDetails) => {
    setEditingItem(item);
    setShowItemDialog(true);
  };

  const handleItemDialogClose = () => {
    setShowItemDialog(false);
    setEditingItem(null);
  };

  const netAmount = template.totalIncome - template.totalExpense;

  return (
    <>
      <div
        className={`rounded-lg border ${template.isArchived ? 'opacity-60' : ''} ${
          !template.isActive && !template.isArchived ? 'border-dashed' : ''
        }`}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{template.name}</p>
                {!template.isActive && !template.isArchived && (
                  <Badge variant="secondary">Inactiva</Badge>
                )}
                {template.isArchived && <Badge variant="outline">Archivada</Badge>}
              </div>
              {template.description && (
                <p className="text-sm text-muted-foreground">{template.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm">
                <span className="text-green-600">
                  +{formatCurrency(template.totalIncome, baseCurrency)}
                </span>
                {' / '}
                <span className="text-red-600">
                  -{formatCurrency(template.totalExpense, baseCurrency)}
                </span>
              </p>
              <p
                className={`text-sm font-medium ${
                  netAmount >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                Neto: {formatCurrency(netAmount, baseCurrency)}
              </p>
            </div>
            <Badge variant="outline">{template.itemsCount} items</Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleActive}>
                  {template.isActive ? (
                    <>
                      <PowerOff className="mr-2 h-4 w-4" />
                      Desactivar
                    </>
                  ) : (
                    <>
                      <Power className="mr-2 h-4 w-4" />
                      Activar
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleArchive}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archivar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Items */}
        {isExpanded && (
          <div className="border-t px-4 py-3 space-y-2">
            {template.items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay items en esta plantilla
              </p>
            ) : (
              template.items.map((item) => (
                <TemplateItemRow
                  key={item.id}
                  item={item}
                  userId={userId}
                  baseCurrency={baseCurrency}
                  onEdit={() => handleEditItem(item)}
                />
              ))
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={handleAddItem}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar item
            </Button>
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={handleCloseDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              ¿Eliminar plantilla permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                Esta acción <strong>no se puede deshacer</strong>. Se eliminará la plantilla
                &quot;{template.name}&quot; junto con todos sus{' '}
                <strong>{template.itemsCount} items</strong>.
              </span>
              <span className="block">
                Para confirmar, escribe <strong>{CONFIRM_DELETE_TEXT}</strong> a continuación:
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              placeholder={`Escribe ${CONFIRM_DELETE_TEXT} para confirmar`}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              className={confirmText && !canDelete ? 'border-destructive' : ''}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!canDelete || isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {isPending ? 'Eliminando...' : 'Eliminar plantilla'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Item Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <TemplateItemDialogContent
          templateId={template.id}
          projectId={projectId}
          userId={userId}
          baseCurrency={baseCurrency}
          categories={categories}
          accounts={accounts}
          entities={entities}
          item={editingItem}
          onSuccess={handleItemDialogClose}
        />
      </Dialog>
    </>
  );
}

// ============================================================================
// Template Item Row Component
// ============================================================================

interface TemplateItemRowProps {
  item: TemplateItemWithDetails;
  userId: string;
  baseCurrency: string;
  onEdit: () => void;
}

function TemplateItemRow({ item, userId, baseCurrency, onEdit }: TemplateItemRowProps) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    const toastId = toast.loading('Eliminando item...');
    startTransition(async () => {
      const result = await deleteTemplateItem(item.id, userId);
      if (result.success) {
        toast.success('Item eliminado', { id: toastId });
      } else {
        toast.error(result.error, { id: toastId });
      }
    });
  };

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50">
      <div className="flex items-center gap-3">
        {item.entityImageUrl && (
          <img
            src={item.entityImageUrl}
            alt={item.entityName ?? ''}
            className="h-6 w-6 rounded-full object-cover"
          />
        )}
        <div>
          <p className="text-sm font-medium">{item.description}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {item.entityName && <span>{item.entityName} • </span>}
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: item.categoryColor }}
            />
            {item.categoryName}
            {item.accountName && <span> • {item.accountName}</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`text-sm font-medium ${
            item.type === 'income' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {item.type === 'income' ? '+' : '-'}
          {formatCurrency(item.baseAmount, baseCurrency)}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ============================================================================
// Template Dialog Content
// ============================================================================

const templateFormSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(255),
  description: z.string().max(500).optional(),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

interface TemplateDialogContentProps {
  projectId: string;
  userId: string;
  template: TemplateWithItems | null;
  onSuccess: () => void;
}

function TemplateDialogContent({
  projectId,
  userId,
  template,
  onSuccess,
}: TemplateDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const isEditing = !!template;

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: template?.name ?? '',
      description: template?.description ?? '',
    },
  });

  // Resetear formulario cuando cambia el template
  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        description: template.description ?? '',
      });
    } else {
      form.reset({
        name: '',
        description: '',
      });
    }
  }, [template, form]);

  const onSubmit = (data: TemplateFormData) => {
    startTransition(async () => {
      if (isEditing) {
        const result = await updateTemplate(template.id, userId, data);
        if (result.success) {
          toast.success('Plantilla actualizada');
          onSuccess();
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await createTemplate({
          userId,
          projectId,
          ...data,
        });
        if (result.success) {
          toast.success('Plantilla creada');
          onSuccess();
        } else {
          toast.error(result.error);
        }
      }
    });
  };

  return (
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar plantilla' : 'Nueva plantilla'}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Modifica los detalles de la plantilla.'
            : 'Crea una nueva plantilla de items recurrentes.'}
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
                  <Input placeholder="Ej: Gastos fijos del mes" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción (opcional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe el propósito de esta plantilla"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? 'Guardando...'
                : isEditing
                ? 'Guardar cambios'
                : 'Crear plantilla'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}

// ============================================================================
// Template Item Dialog Content
// ============================================================================

const templateItemFormSchema = z.object({
  categoryId: z.string().uuid('La categoría es requerida'),
  accountId: z.string().uuid().optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  type: z.enum(['income', 'expense']),
  description: z.string().min(1, 'La descripción es requerida').max(500),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  notes: z.string().max(1000).optional().nullable(),
});

type TemplateItemFormData = z.infer<typeof templateItemFormSchema>;

interface TemplateItemDialogContentProps {
  templateId: string;
  projectId: string;
  userId: string;
  baseCurrency: string;
  categories: { id: string; name: string; color: string }[];
  accounts: { id: string; name: string }[];
  entities: { id: string; name: string; type: string; imageUrl: string | null }[];
  item: TemplateItemWithDetails | null;
  onSuccess: () => void;
}

function TemplateItemDialogContent({
  templateId,
  projectId,
  userId,
  baseCurrency,
  categories,
  accounts,
  entities,
  item,
  onSuccess,
}: TemplateItemDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [localCategories, setLocalCategories] = useState(categories);
  const isEditing = !!item;

  const form = useForm<TemplateItemFormData>({
    resolver: zodResolver(templateItemFormSchema),
    defaultValues: {
      categoryId: item?.categoryId ?? '',
      accountId: item?.accountId ?? null,
      entityId: item?.entityId ?? null,
      type: (item?.type === 'income' || item?.type === 'expense') ? item.type : 'expense',
      description: item?.description ?? '',
      amount: item ? parseFloat(item.baseAmount) : undefined,
      notes: item?.notes ?? '',
    },
  });

  // Resetear formulario cuando cambia el item (nuevo vs editar)
  useEffect(() => {
    if (item) {
      form.reset({
        categoryId: item.categoryId,
        accountId: item.accountId ?? null,
        entityId: item.entityId ?? null,
        type: (item.type === 'income' || item.type === 'expense') ? item.type : 'expense',
        description: item.description,
        amount: parseFloat(item.baseAmount),
        notes: item.notes ?? '',
      });
    } else {
      form.reset({
        categoryId: '',
        accountId: null,
        entityId: null,
        type: 'expense',
        description: '',
        amount: undefined,
        notes: '',
      });
    }
  }, [item, form]);

  const onSubmit = (data: TemplateItemFormData) => {
    startTransition(async () => {
      if (isEditing) {
        const result = await updateTemplateItem(item.id, userId, {
          categoryId: data.categoryId,
          accountId: data.accountId,
          entityId: data.entityId,
          description: data.description,
          originalAmount: data.amount,
          originalCurrency: baseCurrency,
          baseAmount: data.amount,
          baseCurrency: baseCurrency,
          notes: data.notes,
        });
        if (result.success) {
          toast.success('Item actualizado');
          onSuccess();
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await createTemplateItem({
          templateId,
          userId,
          projectId,
          categoryId: data.categoryId,
          accountId: data.accountId,
          entityId: data.entityId,
          type: data.type,
          description: data.description,
          originalAmount: data.amount,
          originalCurrency: baseCurrency,
          baseAmount: data.amount,
          baseCurrency: baseCurrency,
          notes: data.notes,
        });
        if (result.success) {
          toast.success('Item agregado');
          onSuccess();
        } else {
          toast.error(result.error);
        }
      }
    });
  };

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar item' : 'Nuevo item'}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Modifica los detalles del item.'
            : 'Agrega un nuevo item a la plantilla.'}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Type */}
          {!isEditing && (
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tipo" />
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
          )}

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Sueldo, Arriendo, Netflix" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Amount */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monto ({baseCurrency})</FormLabel>
                <FormControl>
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="0"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Category & Entity */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <FormControl>
                    <CategorySelector
                      categories={localCategories}
                      value={field.value}
                      onValueChange={field.onChange}
                      onCategoryCreated={(cat) =>
                        setLocalCategories((prev) => [
                          ...prev,
                          { id: cat.id, name: cat.name, color: cat.color },
                        ])
                      }
                      projectId={projectId}
                      userId={userId}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="entityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entidad (opcional)</FormLabel>
                  <FormControl>
                    <EntitySelector
                      entities={entities}
                      value={field.value ?? undefined}
                      onValueChange={(val) => field.onChange(val ?? null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Account */}
          <FormField
            control={form.control}
            name="accountId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cuenta (opcional)</FormLabel>
                <Select
                  onValueChange={(val) => field.onChange(val === '__none__' ? null : val)}
                  value={field.value ?? '__none__'}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una cuenta" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Sin cuenta específica</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notas (opcional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Notas adicionales sobre este item"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Agregar item'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
