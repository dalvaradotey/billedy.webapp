'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ResponsiveDrawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
} from '@/components/ui/drawer';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/currency-input';
import { InstallmentSelector } from '@/components/installment-selector';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { EntitySelector } from '@/components/entity-selector';
import { CategorySelector } from '@/components/category-selector';

import { formatCurrency } from '@/lib/formatting';
import { createCardPurchaseSchema } from '../schemas';
import { createCardPurchase } from '../actions';
import type { Account } from '@/features/accounts/types';
import type { Category } from '@/features/categories/types';
import type { Entity } from '@/features/entities/types';

/**
 * Calcula cuántas cuotas están vencidas basándose en la fecha de primer cobro
 * y la fecha actual (solo cuenta cuotas cuya fecha ya pasó)
 */
function calculateChargedInstallments(
  firstChargeDate: Date | undefined,
  totalInstallments: number | undefined
): number {
  if (!firstChargeDate || !totalInstallments) return 0;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(firstChargeDate);

  if (start >= today) return 0;

  let paidCount = 0;
  for (let i = 0; i < totalInstallments; i++) {
    const chargeDate = new Date(start);
    chargeDate.setMonth(chargeDate.getMonth() + i);

    if (chargeDate < today) {
      paidCount++;
    } else {
      break;
    }
  }

  return paidCount;
}

interface CreatePurchaseDialogProps {
  projectId: string;
  userId: string;
  accounts: Account[];
  categories: Category[];
  entities: Entity[];
  onSuccess: () => void;
}

export function CreatePurchaseDialog({
  projectId,
  userId,
  accounts,
  categories,
  entities,
  onSuccess,
}: CreatePurchaseDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localCategories, setLocalCategories] = useState<{ id: string; name: string; color: string }[]>(
    categories.map((c) => ({ id: c.id, name: c.name, color: c.color }))
  );

  const creditCards = accounts.filter((a) => a.type === 'credit_card');

  const form = useForm({
    resolver: zodResolver(createCardPurchaseSchema),
    defaultValues: {
      userId,
      projectId,
      accountId: '',
      categoryId: '',
      entityId: undefined as string | undefined,
      description: '',
      storeName: '',
      purchaseDate: new Date(),
      originalAmount: 0,
      interestRate: 0,
      installments: 3,
      firstChargeDate: new Date(),
      chargedInstallments: 0,
      isExternalDebt: false,
      notes: '',
    },
  });

  const watchEntityId = form.watch('entityId');
  const watchStoreName = form.watch('storeName');
  const watchPurchaseDate = form.watch('purchaseDate');
  const watchOriginalAmount = form.watch('originalAmount');
  const watchInterestRate = form.watch('interestRate');
  const watchInstallments = form.watch('installments');
  const watchFirstChargeDate = form.watch('firstChargeDate');

  useEffect(() => {
    if (watchPurchaseDate) {
      form.setValue('firstChargeDate', watchPurchaseDate);
    }
  }, [watchPurchaseDate, form]);

  const interestMultiplier = 1 + ((watchInterestRate || 0) / 100);
  const totalAmount = (watchOriginalAmount || 0) * interestMultiplier;
  const interestAmount = totalAmount - (watchOriginalAmount || 0);
  const installmentAmount = watchInstallments > 0 ? totalAmount / watchInstallments : 0;

  const calculatedChargedInstallments = calculateChargedInstallments(
    watchFirstChargeDate,
    watchInstallments
  );

  useEffect(() => {
    form.setValue('chargedInstallments', calculatedChargedInstallments);
  }, [calculatedChargedInstallments, form]);

  async function onSubmit(data: any) {
    setIsLoading(true);
    const result = await createCardPurchase(data);
    setIsLoading(false);

    if (result.success) {
      form.reset();
      setOpen(false);
      onSuccess();
    }
  }

  return (
    <ResponsiveDrawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nueva compra en cuotas
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Registrar compra en cuotas</DrawerTitle>
            <DrawerDescription>
              Registra una compra con tarjeta de crédito en cuotas para hacer
              seguimiento del pago y los intereses.
            </DrawerDescription>
          </DrawerHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 pb-4 max-h-[70vh] md:max-h-[calc(100vh-8rem)] overflow-y-auto">
            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tarjeta de crédito</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una tarjeta" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {creditCards.map((card) => (
                        <SelectItem key={card.id} value={card.id}>
                          {card.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input placeholder="ej: MacBook Pro M3" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {entities.length > 0 && (
              <FormField
                control={form.control}
                name="entityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entidad (opcional)</FormLabel>
                    <FormControl>
                      <EntitySelector
                        entities={entities}
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          if (value) {
                            form.setValue('storeName', '');
                          }
                        }}
                        placeholder="Selecciona una entidad"
                        searchPlaceholder="Buscar entidad..."
                        disabled={!!watchStoreName}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="storeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tienda manual (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ej: Apple Store"
                      {...field}
                      value={field.value ?? ''}
                      disabled={!!watchEntityId}
                      onChange={(e) => {
                        field.onChange(e);
                        if (e.target.value) {
                          form.setValue('entityId', undefined);
                        }
                      }}
                    />
                  </FormControl>
                  {entities.length > 0 && (
                    <p className="text-[0.8rem] text-muted-foreground">
                      Usa este campo si la tienda no está en las entidades
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      onValueChange={(value) => field.onChange(value ?? '')}
                      projectId={projectId}
                      userId={userId}
                      placeholder="Selecciona categoría"
                      onCategoryCreated={(newCat) => {
                        setLocalCategories((prev) => [...prev, newCat]);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de compra</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                        onChange={(e) => {
                          const [year, month, day] = e.target.value.split('-').map(Number);
                          field.onChange(new Date(year, month - 1, day));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="firstChargeDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vencimiento 1ra cuota</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                        onChange={(e) => {
                          const [year, month, day] = e.target.value.split('-').map(Number);
                          field.onChange(new Date(year, month - 1, day));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="originalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto original</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                        currency="CLP"
                        placeholder="0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="installments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de cuotas</FormLabel>
                    <FormControl>
                      <InstallmentSelector
                        value={field.value}
                        onChange={field.onChange}
                        min={1}
                        max={60}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="interestRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tasa de interés (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      placeholder="0"
                      {...field}
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>
                    Déjalo en 0 para compras sin interés
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchOriginalAmount > 0 && watchInstallments > 0 && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Monto original:</span>
                    <span className="font-medium">
                      {formatCurrency(watchOriginalAmount)}
                    </span>
                  </div>
                  {interestAmount > 0 && (
                    <div className="flex justify-between text-destructive">
                      <span>Interés ({watchInterestRate}%):</span>
                      <span className="font-medium">
                        +{formatCurrency(interestAmount)}
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>Total a pagar:</span>
                    <span>{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-primary">
                    <span>Cuota mensual:</span>
                    <span className="font-bold">
                      {formatCurrency(installmentAmount)} x {watchInstallments}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {calculatedChargedInstallments > 0 && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Cuotas vencidas (se marcarán como pagadas)</span>
                  <span className="font-medium">{calculatedChargedInstallments} de {watchInstallments}</span>
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="isExternalDebt"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Deuda externa (familiar/tercero)</FormLabel>
                    <p className="text-[0.8rem] text-muted-foreground">
                      Marca esta opción si compraste para alguien más que te pagará las cuotas.
                      No se contará en tu límite de endeudamiento personal.
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notas adicionales..."
                      className="resize-none"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

              <DrawerFooter className="pt-4">
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? 'Guardando...' : 'Guardar compra'}
                </Button>
              </DrawerFooter>
            </form>
          </Form>
        </div>
      </DrawerContent>
    </ResponsiveDrawer>
  );
}
