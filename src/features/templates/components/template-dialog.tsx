'use client';

import { useTransition, useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { Check, ArrowRight } from 'lucide-react';

import { useFormValidation, useSuccessAnimation } from '@/hooks';
import { SubmitButton } from '@/components/submit-button';
import { FloatingLabelInput } from '@/components/floating-label-input';
import { FloatingLabelTextarea } from '@/components/floating-label-textarea';
import { FormDrawer, FormDrawerBody, FormDrawerFooter } from '@/components/form-drawer';
import { ProgressIndicator } from '@/components/progress-indicator';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';

import { createTemplate, updateTemplate } from '../actions';
import type { TemplateWithItems } from '../types';

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

export function TemplateDialogContent({
  projectId,
  userId,
  template,
  onSuccess,
}: TemplateDialogContentProps) {
  const [isPending, startTransition] = useTransition();

  // Form UX hooks
  const { onInvalid } = useFormValidation();
  const { showSuccess, triggerSuccess } = useSuccessAnimation({ onComplete: onSuccess });

  const isEditing = !!template;

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: template?.name ?? '',
      description: template?.description ?? '',
    },
  });

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

  // Track form progress
  const calculateProgress = useCallback((values: Partial<TemplateFormData>) => {
    return [!!values.name].filter(Boolean).length;
  }, []);

  const [formProgress, setFormProgress] = useState(() => calculateProgress(form.getValues()));

  useEffect(() => {
    setFormProgress(calculateProgress(form.getValues()));

    const subscription = form.watch((values) => {
      setFormProgress(calculateProgress(values));
    });
    return () => subscription.unsubscribe();
  }, [form, calculateProgress]);

  const onSubmit = (data: TemplateFormData) => {
    const toastId = toast.loading(isEditing ? 'Actualizando plantilla...' : 'Creando plantilla...');

    startTransition(async () => {
      if (isEditing) {
        const result = await updateTemplate(template.id, userId, data);
        if (result.success) {
          toast.success('Plantilla actualizada', { id: toastId });
          form.reset();
          triggerSuccess();
        } else {
          toast.error(result.error, { id: toastId });
        }
      } else {
        const result = await createTemplate({
          userId,
          projectId,
          ...data,
        });
        if (result.success) {
          toast.success('Plantilla creada', { id: toastId });
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
      title={isEditing ? 'Editar plantilla' : 'Nueva plantilla'}
      description={isEditing ? 'Modifica los detalles de la plantilla.' : 'Crea una nueva plantilla de items recurrentes.'}
      showSuccess={showSuccess}
      headerExtra={!isEditing ? <ProgressIndicator current={formProgress} total={1} /> : undefined}
    >
      <Form {...form}>
        <FormDrawerBody as="form" onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <FormItem data-field="name">
                <FormControl>
                  <FloatingLabelInput
                    label="Nombre"
                    placeholder="Ej: Gastos fijos del mes"
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

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field, fieldState }) => (
              <FormItem data-field="description">
                <FormControl>
                  <FloatingLabelTextarea
                    label="Descripción (opcional)"
                    placeholder="Describe el propósito de esta plantilla"
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

          <FormDrawerFooter>
            <SubmitButton
              isPending={isPending}
              pendingText="Guardando..."
              icon={isEditing ? <Check className="size-7" /> : <ArrowRight className="size-7" />}
            >
              {isEditing ? 'Guardar cambios' : 'Crear plantilla'}
            </SubmitButton>
          </FormDrawerFooter>
        </FormDrawerBody>
      </Form>
    </FormDrawer>
  );
}
