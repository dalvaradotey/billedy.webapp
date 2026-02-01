'use client';

import { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Inicio del día
  const start = new Date(firstChargeDate);

  // Si la fecha de primer cobro es hoy o en el futuro, no hay cuotas vencidas
  if (start >= today) return 0;

  let paidCount = 0;

  // Iterar cada cuota y verificar si su fecha ya pasó
  for (let i = 0; i < totalInstallments; i++) {
    const chargeDate = new Date(start);
    chargeDate.setMonth(chargeDate.getMonth() + i);

    // Solo contar si la fecha ya pasó (antes de hoy)
    if (chargeDate < today) {
      paidCount++;
    } else {
      // Las fechas son secuenciales, si esta no está vencida, las siguientes tampoco
      break;
    }
  }

  return paidCount;
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

function formatDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
import {
  CreditCard,
  Plus,
  Store,
  Calendar,
  Percent,
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  Trash2,
  Archive,
  Receipt,
  TrendingUp,
  Users,
  AlertTriangle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
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

import { createCardPurchaseSchema } from './schemas';
import {
  createCardPurchase,
  chargeInstallment,
  chargeAllPendingInstallments,
  archiveCardPurchase,
  deleteCardPurchase,
} from './actions';
import type { CardPurchaseWithDetails, CardPurchasesSummary, DebtCapacityReport } from './types';
import type { Account } from '@/features/accounts/types';
import type { Category } from '@/features/categories/types';
import type { Entity } from '@/features/entities/types';
import { EntitySelector } from '@/components/entity-selector';
import { CategorySelector } from '@/components/category-selector';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================================================
// SUMMARY CARDS
// ============================================================================

interface SummaryCardsProps {
  summary: CardPurchasesSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Compras Activas</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.activePurchases}</div>
          <p className="text-xs text-muted-foreground">
            de {summary.totalPurchases} totales
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Deuda Total</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(summary.totalDebt)}</div>
          <p className="text-xs text-muted-foreground">
            en cuotas pendientes
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cargo Mensual</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(summary.monthlyCharge)}</div>
          <p className="text-xs text-muted-foreground">
            aproximado por mes
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Intereses Pagados</CardTitle>
          <Percent className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">
            {formatCurrency(summary.totalInterestPaid)}
          </div>
          <p className="text-xs text-muted-foreground">
            total acumulado
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// DEBT CAPACITY REPORT
// ============================================================================

interface DebtCapacityCardProps {
  report: DebtCapacityReport;
}

export function DebtCapacityCard({ report }: DebtCapacityCardProps) {
  if (report.maxInstallmentAmount === null) {
    return null; // No mostrar si no hay límite configurado
  }

  const getStatusColor = () => {
    if (report.isOverLimit) return 'text-destructive';
    if (report.usedPercentage >= 80) return 'text-amber-500';
    return 'text-green-500';
  };

  const getProgressColor = () => {
    if (report.isOverLimit) return 'bg-destructive';
    if (report.usedPercentage >= 80) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <Card className={report.isOverLimit ? 'border-destructive' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            Capacidad de Endeudamiento
            {report.isOverLimit && (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            )}
          </CardTitle>
          <span className={`text-lg font-bold ${getStatusColor()}`}>
            {report.usedPercentage}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Progress
            value={Math.min(report.usedPercentage, 100)}
            className="h-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Cargo mensual: {formatCurrency(report.personalDebt)}</span>
            <span>Límite: {formatCurrency(report.maxInstallmentAmount)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground block">Disponible</span>
            <span className={`font-medium ${report.isOverLimit ? 'text-destructive' : 'text-green-500'}`}>
              {report.isOverLimit
                ? `-${formatCurrency(report.personalDebt - report.maxInstallmentAmount)}`
                : formatCurrency(report.availableCapacity)}
            </span>
          </div>
          {report.externalDebt > 0 && (
            <div>
              <span className="text-muted-foreground block flex items-center gap-1">
                <Users className="h-3 w-3" />
                Cuotas externas
              </span>
              <span className="font-medium">
                {formatCurrency(report.externalDebt)}
              </span>
            </div>
          )}
        </div>

        {report.isOverLimit && (
          <div className="bg-destructive/10 text-destructive text-xs p-2 rounded flex items-center gap-2">
            <AlertTriangle className="h-3 w-3" />
            Has excedido tu límite mensual de cuotas
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CARD PURCHASE CARD
// ============================================================================

interface CardPurchaseCardProps {
  purchase: CardPurchaseWithDetails;
  userId: string;
  onUpdate: () => void;
}

const CONFIRM_DELETE_TEXT = 'ELIMINAR';

export function CardPurchaseCard({ purchase, userId, onUpdate }: CardPurchaseCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const hasInterest = parseFloat(purchase.interestAmount) > 0;
  const isOverdue = purchase.nextChargeDate && new Date(purchase.nextChargeDate) < new Date();
  const canDelete = confirmText === CONFIRM_DELETE_TEXT;

  const handleChargeInstallment = async () => {
    setIsLoading(true);
    const result = await chargeInstallment(purchase.id, userId);
    setIsLoading(false);
    if (result.success) {
      onUpdate();
    }
  };

  const handleArchive = async () => {
    setIsLoading(true);
    const result = await archiveCardPurchase(purchase.id, userId);
    setIsLoading(false);
    if (result.success) {
      onUpdate();
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsLoading(true);
    const result = await deleteCardPurchase(purchase.id, userId);
    setIsLoading(false);
    setShowDeleteAlert(false);
    setConfirmText('');
    if (result.success) {
      onUpdate();
    }
  };

  const handleCloseDeleteAlert = (open: boolean) => {
    setShowDeleteAlert(open);
    if (!open) {
      setConfirmText('');
    }
  };

  return (
    <>
      <Card className={!purchase.isActive ? 'opacity-60' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {purchase.description}
                {purchase.isExternalDebt && (
                  <Badge variant="outline" className="gap-1">
                    <Users className="h-3 w-3" />
                    Externa
                  </Badge>
                )}
                {!purchase.isActive && (
                  <Badge variant="secondary">Completada</Badge>
                )}
                {isOverdue && purchase.isActive && (
                  <Badge variant="destructive">Pendiente</Badge>
                )}
              </CardTitle>
              {/* Entity or Store Name */}
              {(purchase.entityName || purchase.storeName) && (
                <CardDescription className="flex items-center gap-2">
                  {purchase.entityImageUrl ? (
                    <img
                      src={purchase.entityImageUrl}
                      alt={purchase.entityName ?? ''}
                      className="h-5 w-5 rounded object-contain bg-white shrink-0"
                    />
                  ) : (
                    <Store className="h-4 w-4 shrink-0" />
                  )}
                  {purchase.entityName ?? purchase.storeName}
                </CardDescription>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isLoading}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {purchase.isActive && purchase.remainingInstallments > 0 && (
                  <DropdownMenuItem onClick={handleChargeInstallment}>
                    <Receipt className="mr-2 h-4 w-4" />
                    Cobrar cuota
                  </DropdownMenuItem>
                )}
                {purchase.isActive && (
                  <DropdownMenuItem onClick={handleArchive}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archivar
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setShowDeleteAlert(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progreso</span>
              <span className="font-medium">
                {purchase.chargedInstallments} de {purchase.installments} cuotas
              </span>
            </div>
            <Progress value={purchase.progressPercentage} className="h-2" />
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block">Monto original</span>
              <span className="font-medium">
                {formatCurrency(parseFloat(purchase.originalAmount))}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Cuota mensual</span>
              <span className="font-medium">
                {formatCurrency(parseFloat(purchase.installmentAmount))}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">
                {hasInterest ? 'Total con interés' : 'Total'}
              </span>
              <span className="font-medium">
                {formatCurrency(parseFloat(purchase.totalAmount))}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Interés</span>
              {hasInterest ? (
                <span className="font-medium text-destructive">
                  +{formatCurrency(parseFloat(purchase.interestAmount))}
                  {purchase.interestRate && (
                    <span className="text-xs ml-1">({purchase.interestRate}%)</span>
                  )}
                </span>
              ) : (
                <span className="font-medium text-green-600">Sin interés</span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground block">Restante</span>
              <span className="font-medium">
                {formatCurrency(purchase.remainingAmount)}
              </span>
            </div>
            {purchase.nextChargeDate && purchase.isActive && (
              <div>
                <span className="text-muted-foreground block">Próximo vencimiento</span>
                <span className={`font-medium ${isOverdue ? 'text-destructive' : ''}`}>
                  {formatDateLong(purchase.nextChargeDate)}
                </span>
              </div>
            )}
          </div>

          {/* Footer info */}
          <Separator />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              {purchase.accountEntityImageUrl ? (
                <img
                  src={purchase.accountEntityImageUrl}
                  alt={purchase.accountEntityName ?? purchase.accountName}
                  className="h-4 w-4 rounded object-contain bg-white shrink-0"
                />
              ) : (
                <CreditCard className="h-3 w-3 shrink-0" />
              )}
              {purchase.accountName}
            </div>
            {purchase.categoryName && (
              <div className="flex items-center gap-1">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: purchase.categoryColor || '#6b7280' }}
                />
                {purchase.categoryName}
              </div>
            )}
            <div>
              {formatDateLong(purchase.purchaseDate)}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteAlert} onOpenChange={handleCloseDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              ¿Eliminar compra permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                Esta acción <strong>no se puede deshacer</strong>. Se eliminará la compra
                &quot;{purchase.description}&quot; junto con todas las{' '}
                <strong>{purchase.chargedInstallments} transacciones</strong> asociadas.
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
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!canDelete || isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {isLoading ? 'Eliminando...' : 'Eliminar compra y transacciones'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================================
// CREATE PURCHASE DIALOG
// ============================================================================

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

  // Watch entityId and storeName for mutual exclusion
  const watchEntityId = form.watch('entityId');
  const watchStoreName = form.watch('storeName');

  const watchPurchaseDate = form.watch('purchaseDate');
  const watchOriginalAmount = form.watch('originalAmount');
  const watchInterestRate = form.watch('interestRate');
  const watchInstallments = form.watch('installments');
  const watchFirstChargeDate = form.watch('firstChargeDate');

  // Sincronizar fecha de compra con fecha de primera cuota como referencia inicial
  useEffect(() => {
    if (watchPurchaseDate) {
      form.setValue('firstChargeDate', watchPurchaseDate);
    }
  }, [watchPurchaseDate, form]);

  // Calcular preview de montos
  const interestMultiplier = 1 + ((watchInterestRate || 0) / 100);
  const totalAmount = (watchOriginalAmount || 0) * interestMultiplier;
  const interestAmount = totalAmount - (watchOriginalAmount || 0);
  const installmentAmount = watchInstallments > 0 ? totalAmount / watchInstallments : 0;

  // Calcular cuotas vencidas automáticamente
  const calculatedChargedInstallments = calculateChargedInstallments(
    watchFirstChargeDate,
    watchInstallments
  );

  // Actualizar el valor del formulario cuando cambia el cálculo
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nueva compra en cuotas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar compra en cuotas</DialogTitle>
          <DialogDescription>
            Registra una compra con tarjeta de crédito en cuotas para hacer
            seguimiento del pago y los intereses.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            {/* Entity or Store Name - mutually exclusive */}
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
                          // Clear storeName when selecting an entity
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
                        // Clear entityId when typing a store name
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

            {/* Preview de cálculos */}
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

            {/* Mostrar cuotas vencidas calculadas automáticamente */}
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

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Guardando...' : 'Guardar compra'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// CARD PURCHASES LIST
// ============================================================================

interface CardPurchasesListProps {
  purchases: CardPurchaseWithDetails[];
  summary: CardPurchasesSummary;
  debtCapacity: DebtCapacityReport;
  accounts: Account[];
  categories: Category[];
  entities: Entity[];
  projectId: string;
  userId: string;
}

export function CardPurchasesList({
  purchases,
  summary,
  debtCapacity,
  accounts,
  categories,
  entities,
  projectId,
  userId,
}: CardPurchasesListProps) {
  const [showActive, setShowActive] = useState(true);

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleChargeAll = async () => {
    const result = await chargeAllPendingInstallments(projectId, userId);
    if (result.success) {
      window.location.reload();
    }
  };

  const filteredPurchases = showActive
    ? purchases.filter((p) => p.isActive)
    : purchases;

  const activePurchases = purchases.filter((p) => p.isActive);
  const hasPendingCharges = activePurchases.some(
    (p) => p.nextChargeDate && new Date(p.nextChargeDate) <= new Date()
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <SummaryCards summary={summary} />
        <DebtCapacityCard report={debtCapacity} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={showActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowActive(true)}
          >
            Activas ({activePurchases.length})
          </Button>
          <Button
            variant={!showActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowActive(false)}
          >
            Todas ({purchases.length})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {hasPendingCharges && (
            <Button variant="outline" onClick={handleChargeAll}>
              <Receipt className="mr-2 h-4 w-4" />
              Cobrar cuotas pendientes
            </Button>
          )}
          <CreatePurchaseDialog
            projectId={projectId}
            userId={userId}
            accounts={accounts}
            categories={categories}
            entities={entities}
            onSuccess={handleRefresh}
          />
        </div>
      </div>

      {filteredPurchases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {showActive ? 'No hay compras activas' : 'No hay compras registradas'}
            </h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">
              Registra tus compras en cuotas para hacer seguimiento de los pagos
              y saber cuánto estás pagando en intereses.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredPurchases.map((purchase) => (
            <CardPurchaseCard
              key={purchase.id}
              purchase={purchase}
              userId={userId}
              onUpdate={handleRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
