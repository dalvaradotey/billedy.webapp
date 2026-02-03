'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { CategorySelector } from '@/components/category-selector';
import { EntitySelector } from '@/components/entity-selector';

import { createTemplateItem, updateTemplateItem } from '../actions';
import type { TemplateItemWithDetails } from '../types';

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

export function TemplateItemDialogContent({
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
