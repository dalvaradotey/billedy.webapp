'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { Check, ArrowRight, Settings, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

import { useFormValidation, useSuccessAnimation } from '@/hooks';
import { SubmitButton } from '@/components/submit-button';
import { FloatingLabelInput } from '@/components/floating-label-input';
import { FloatingLabelTextarea } from '@/components/floating-label-textarea';
import { FormDrawer, FormDrawerBody, FormDrawerFooter } from '@/components/form-drawer';
import { ProgressIndicator } from '@/components/progress-indicator';
import { CurrencyInput } from '@/components/currency-input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { CategorySelector } from '@/components/category-selector';
import { EntitySelector } from '@/components/entity-selector';
import { AccountSelector } from '@/components/account-selector';
import type { AccountWithEntity } from '@/features/accounts/types';

import { createTemplateItem, updateTemplateItem } from '../actions';
import type { TemplateItemWithDetails } from '../types';

const templateItemFormSchema = z.object({
  categoryId: z.string().uuid('La categoría es requerida'),
  accountId: z.string().uuid().optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  type: z.enum(['income', 'expense']),
  description: z.string().min(1, 'La descripción es requerida').max(500),
  amount: z.number({ message: 'Ingresa el monto' }).positive('El monto debe ser mayor a 0'),
  notes: z.string().max(1000).optional().nullable(),
});

type TemplateItemFormData = z.infer<typeof templateItemFormSchema>;

interface TemplateItemDialogContentProps {
  templateId: string;
  projectId: string;
  userId: string;
  baseCurrency: string;
  categories: { id: string; name: string; color: string }[];
  accounts: AccountWithEntity[];
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
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Form UX hooks
  const { onInvalid } = useFormValidation();
  const { showSuccess, triggerSuccess } = useSuccessAnimation({ onComplete: onSuccess });

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
      // Show advanced options if item has notes or account
      if (item.notes || item.accountId) {
        setShowAdvancedOptions(true);
      }
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
      setShowAdvancedOptions(false);
    }
  }, [item, form]);

  // Track form progress
  const calculateProgress = useCallback((values: Partial<TemplateItemFormData>) => {
    return [
      !!values.description,
      values.amount != null && values.amount > 0,
      !!values.categoryId,
    ].filter(Boolean).length;
  }, []);

  const [formProgress, setFormProgress] = useState(() => calculateProgress(form.getValues()));

  useEffect(() => {
    setFormProgress(calculateProgress(form.getValues()));

    const subscription = form.watch((values) => {
      setFormProgress(calculateProgress(values));
    });
    return () => subscription.unsubscribe();
  }, [form, calculateProgress]);

  const onSubmit = (data: TemplateItemFormData) => {
    const toastId = toast.loading(isEditing ? 'Actualizando item...' : 'Creando item...');

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
          toast.success('Item actualizado', { id: toastId });
          form.reset();
          triggerSuccess();
        } else {
          toast.error(result.error, { id: toastId });
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
          toast.success('Item agregado', { id: toastId });
          form.reset();
          triggerSuccess();
        } else {
          toast.error(result.error, { id: toastId });
        }
      }
    });
  };

  return (
    <FormDrawer
      title={isEditing ? 'Editar item' : 'Nuevo item'}
      description={isEditing ? 'Modifica los detalles del item.' : 'Agrega un nuevo item a la plantilla.'}
      showSuccess={showSuccess}
      headerExtra={!isEditing ? <ProgressIndicator current={formProgress} total={3} /> : undefined}
    >
      <Form {...form}>
        <FormDrawerBody as="form" onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
          {/* Type - only when creating */}
          {!isEditing && (
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem data-field="type">
                  <Tabs value={field.value} onValueChange={field.onChange}>
                    <TabsList className="w-full">
                      <TabsTrigger value="expense" className="flex-1 gap-2">
                        <ArrowDownCircle className="h-4 w-4" />
                        Gasto
                      </TabsTrigger>
                      <TabsTrigger value="income" className="flex-1 gap-2">
                        <ArrowUpCircle className="h-4 w-4" />
                        Ingreso
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field, fieldState }) => (
              <FormItem data-field="description">
                <FormControl>
                  <FloatingLabelInput
                    label="Descripción"
                    placeholder="Ej: Sueldo, Arriendo, Netflix"
                    value={field.value}
                    onChange={field.onChange}
                    valid={!!field.value && !fieldState.error}
                    invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Amount */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field, fieldState }) => (
              <FormItem data-field="amount">
                <FormControl>
                  <CurrencyInput
                    size="lg"
                    label="Monto"
                    value={field.value}
                    onChange={field.onChange}
                    currency={baseCurrency}
                    placeholder="0"
                    valid={field.value != null && field.value > 0 && !fieldState.error}
                    invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Category & Entity */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field, fieldState }) => (
                <FormItem data-field="categoryId">
                  <FormControl>
                    <CategorySelector
                      label="Categoría"
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
                      valid={!!field.value && !fieldState.error}
                      invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="entityId"
              render={({ field, fieldState }) => (
                <FormItem data-field="entityId">
                  <FormControl>
                    <EntitySelector
                      label="Tienda"
                      entities={entities}
                      value={field.value ?? undefined}
                      onValueChange={(val) => field.onChange(val ?? null)}
                      allowNone
                      noneLabel="Sin tienda"
                      searchPlaceholder="Buscar tienda..."
                      valid={!!field.value && !fieldState.error}
                      invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Advanced Options Toggle */}
          {!showAdvancedOptions && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-auto p-0"
              onClick={() => setShowAdvancedOptions(true)}
            >
              <Settings className="mr-1.5 h-3 w-3" />
              Otras opciones
            </Button>
          )}

          {/* Advanced Options */}
          {showAdvancedOptions && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Otras opciones</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-auto p-0"
                  onClick={() => setShowAdvancedOptions(false)}
                >
                  Ocultar
                </Button>
              </div>

              {/* Account */}
              <FormField
                control={form.control}
                name="accountId"
                render={({ field, fieldState }) => (
                  <FormItem data-field="accountId">
                    <FormControl>
                      <AccountSelector
                        accounts={accounts}
                        value={field.value}
                        onValueChange={(val) => field.onChange(val)}
                        label="Cuenta (opcional)"
                        searchPlaceholder="Buscar cuenta..."
                        allowNone
                        noneLabel="Sin cuenta específica"
                        valid={!!field.value}
                        invalid={!!fieldState.error}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field, fieldState }) => (
                  <FormItem data-field="notes">
                    <FormControl>
                      <FloatingLabelTextarea
                        label="Notas (opcional)"
                        placeholder="Notas adicionales sobre este item"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        valid={!!field.value && !fieldState.error}
                        invalid={!!fieldState.error}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          <FormDrawerFooter>
            <SubmitButton
              isPending={isPending}
              pendingText="Guardando..."
              icon={isEditing ? <Check className="size-7" /> : <ArrowRight className="size-7" />}
            >
              {isEditing ? 'Guardar cambios' : 'Agregar item'}
            </SubmitButton>
          </FormDrawerFooter>
        </FormDrawerBody>
      </Form>
    </FormDrawer>
  );
}
