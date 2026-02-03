'use client';

import { useTransition, useEffect } from 'react';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
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
