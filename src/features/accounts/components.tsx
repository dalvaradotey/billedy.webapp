'use client';

import { useState, useTransition, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Building2,
  PiggyBank,
  Wallet,
  CreditCard,
  Star,
  MoreVertical,
  RefreshCw,
} from 'lucide-react';
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
import { CurrencyInput } from '@/components/currency-input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import {
  createAccount,
  updateAccount,
  archiveAccount,
  restoreAccount,
  deleteAccount,
  adjustAccountBalance,
  recalculateAllAccountBalances,
} from './actions';
import Image from 'next/image';
import { createAccountSchema, type CreateAccountInput } from './schemas';
import type { Account, AccountsSummary, AccountType, AccountWithEntity } from './types';
import { ACCOUNT_TYPE_LABELS } from './types';
import type { Entity } from '@/features/entities/types';

function formatCurrency(amount: number | string, currency: string = 'CLP'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

const AccountTypeIcon = ({ type, className }: { type: AccountType; className?: string }) => {
  const icons = {
    checking: Building2,
    savings: PiggyBank,
    cash: Wallet,
    credit_card: CreditCard,
  };
  const Icon = icons[type];
  return <Icon className={className} />;
};

// ============================================================================
// RECALCULATE BUTTON
// ============================================================================

interface RecalculateButtonProps {
  userId: string;
  onMutationStart: () => void;
  onMutationSuccess: (toastId: string | number, message: string) => void;
  onMutationError: (toastId: string | number, error: string) => void;
}

function RecalculateButton({ userId, onMutationStart, onMutationSuccess, onMutationError }: RecalculateButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleRecalculate = () => {
    const toastId = toast.loading('Recalculando saldos...');
    onMutationStart();

    startTransition(async () => {
      const result = await recalculateAllAccountBalances(userId);
      if (result.success) {
        onMutationSuccess(toastId, `${result.data.updated} cuentas actualizadas`);
      } else {
        onMutationError(toastId, result.error);
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={handleRecalculate}
      disabled={isPending}
    >
      <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
      Recalcular saldos
    </Button>
  );
}

// ============================================================================
// ACCOUNTS LIST
// ============================================================================

interface AccountsListProps {
  accounts: AccountWithEntity[];
  summary: AccountsSummary;
  userId: string;
  currencies: { id: string; code: string; name: string }[];
  entities: Entity[];
}

export function AccountsList({ accounts, summary, userId, currencies, entities }: AccountsListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountWithEntity | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingToast, setPendingToast] = useState<{ id: string | number; message: string } | null>(
    null
  );

  const prevAccountsRef = useRef<Account[]>(accounts);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const dataChanged =
      accounts !== prevAccountsRef.current ||
      accounts.length !== prevAccountsRef.current.length ||
      JSON.stringify(accounts.map((a) => a.id + a.currentBalance)) !==
        JSON.stringify(prevAccountsRef.current.map((a) => a.id + a.currentBalance));

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

    prevAccountsRef.current = accounts;
  }, [accounts, isRefreshing, pendingToast]);

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

  const handleEdit = (account: AccountWithEntity) => {
    setEditingAccount(account);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingAccount(null);
  };

  const handleOpenDialog = () => {
    setEditingAccount(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Disponible"
          value={formatCurrency(summary.totalDebitBalance)}
          subtitle="En cuentas de débito"
          className="text-green-600"
        />
        <SummaryCard
          title="Deuda TC"
          value={formatCurrency(summary.totalCreditBalance)}
          subtitle="En tarjetas de crédito"
          className="text-red-600"
        />
        <SummaryCard
          title="Patrimonio Neto"
          value={formatCurrency(summary.netWorth)}
          subtitle="Disponible - Deuda"
          className={summary.netWorth >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <SummaryCard
          title="Cuentas"
          value={String(summary.totalAccounts)}
          subtitle="Activas"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">{accounts.length} cuentas</div>

        <div className="flex gap-2">
          <RecalculateButton userId={userId} onMutationStart={onMutationStart} onMutationSuccess={onMutationSuccess} onMutationError={onMutationError} />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" onClick={handleOpenDialog}>
                <Plus className="h-4 w-4" />
                Nueva cuenta
              </Button>
            </DialogTrigger>
          <AccountDialogContent
            userId={userId}
            account={editingAccount}
            currencies={currencies}
            entities={entities}
            onSuccess={handleDialogClose}
            onMutationStart={onMutationStart}
            onMutationSuccess={onMutationSuccess}
            onMutationError={onMutationError}
          />
          </Dialog>
        </div>
      </div>

      {/* Accounts List */}
      <div>
        {isRefreshing ? (
          <div className="space-y-3">
            {Array.from({ length: Math.max(1, accounts.length) }).map((_, i) => (
              <AccountCardSkeleton key={i} />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-lg">
            <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay cuentas registradas.</p>
            <p className="text-sm mt-1">Crea una cuenta para comenzar a registrar tus transacciones.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                userId={userId}
                onEdit={() => handleEdit(account)}
                onMutationStart={onMutationStart}
                onMutationSuccess={onMutationSuccess}
                onMutationError={onMutationError}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUMMARY CARD
// ============================================================================

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  className?: string;
}

function SummaryCard({ title, value, subtitle, className }: SummaryCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm text-muted-foreground mb-1">{title}</div>
      <div className={`text-2xl font-bold ${className ?? ''}`}>{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

// ============================================================================
// SKELETON
// ============================================================================

export function AccountCardSkeleton() {
  return (
    <div className="rounded-lg border p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="text-right">
        <Skeleton className="h-6 w-28" />
      </div>
    </div>
  );
}

// ============================================================================
// ACCOUNT CARD
// ============================================================================

interface AccountCardProps {
  account: AccountWithEntity;
  userId: string;
  onEdit: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

function AccountCard({
  account,
  userId,
  onEdit,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: AccountCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const balance = parseFloat(account.currentBalance);
  const isCredit = account.type === 'credit_card';

  const handleArchive = () => {
    const toastId = toast.loading('Archivando cuenta...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await archiveAccount(account.id, userId);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Cuenta archivada');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleRestore = () => {
    const toastId = toast.loading('Restaurando cuenta...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await restoreAccount(account.id, userId);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Cuenta restaurada');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const handleDelete = () => {
    const toastId = toast.loading('Eliminando cuenta...');
    onMutationStart?.();
    startTransition(async () => {
      const result = await deleteAccount(account.id, userId);
      setShowDeleteDialog(false);
      if (result.success) {
        onMutationSuccess?.(toastId, 'Cuenta eliminada');
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  return (
    <div
      className={`rounded-lg border p-4 flex items-center justify-between ${account.isArchived ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-3">
        {account.entity?.imageUrl ? (
          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
            <Image
              src={account.entity.imageUrl}
              alt={account.entity.name}
              width={40}
              height={40}
              className="object-cover"
            />
          </div>
        ) : (
          <div
            className={`p-2.5 rounded-lg ${
              isCredit
                ? 'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400'
                : 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
            }`}
          >
            <AccountTypeIcon type={account.type as AccountType} className="h-5 w-5" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{account.name}</p>
            {account.isDefault && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
          </div>
          <p className="text-sm text-muted-foreground">
            {ACCOUNT_TYPE_LABELS[account.type as AccountType]}
            {account.entity ? ` · ${account.entity.name}` : account.bankName && ` · ${account.bankName}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p
            className={`text-lg font-semibold ${
              isCredit
                ? balance > 0
                  ? 'text-red-600'
                  : 'text-muted-foreground'
                : balance >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
            }`}
          >
            {isCredit && balance > 0 && '-'}
            {formatCurrency(Math.abs(balance))}
          </p>
          {isCredit && account.creditLimit && (
            <p className="text-xs text-muted-foreground">
              Disponible: {formatCurrency(parseFloat(account.creditLimit) - balance)}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Acciones</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            {account.isArchived ? (
              <DropdownMenuItem onClick={handleRestore}>
                <ArchiveRestore className="mr-2 h-4 w-4" />
                Restaurar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="mr-2 h-4 w-4" />
                Archivar
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar cuenta</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Eliminar esta cuenta permanentemente? Las transacciones asociadas perderán la
                referencia a esta cuenta.
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
    </div>
  );
}

// ============================================================================
// ACCOUNT DIALOG
// ============================================================================

interface AccountDialogContentProps {
  userId: string;
  account: AccountWithEntity | null;
  currencies: { id: string; code: string; name: string }[];
  entities: Entity[];
  onSuccess: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

function AccountDialogContent({
  userId,
  account,
  currencies,
  entities,
  onSuccess,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: AccountDialogContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adjustBalance, setAdjustBalance] = useState(false);
  const [newBalance, setNewBalance] = useState<number>(0);
  const [showCurrencySelector, setShowCurrencySelector] = useState(false);

  const isEditing = !!account;

  const getDefaultValues = useCallback(() => {
    if (account) {
      return {
        name: account.name,
        type: account.type as AccountType,
        bankName: account.bankName ?? '',
        entityId: account.entityId ?? undefined,
        currency: account.currency,
        initialBalance: parseFloat(account.initialBalance),
        creditLimit: account.creditLimit ? parseFloat(account.creditLimit) : undefined,
        isDefault: account.isDefault,
      };
    }
    return {
      name: '',
      type: 'checking' as AccountType,
      bankName: '',
      entityId: undefined as string | undefined,
      currency: 'CLP',
      initialBalance: 0,
      creditLimit: undefined as number | undefined,
      isDefault: false,
    };
  }, [account]);

  const form = useForm<CreateAccountInput>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: getDefaultValues(),
  });

  // Reset form when account changes (for edit mode)
  useEffect(() => {
    form.reset(getDefaultValues());
    setAdjustBalance(false);
    // Show currency selector if account has a different currency than CLP
    if (account) {
      setNewBalance(parseFloat(account.currentBalance));
      setShowCurrencySelector(account.currency !== 'CLP');
    } else {
      setShowCurrencySelector(false);
    }
  }, [account, form, getDefaultValues]);

  const onSubmit = (data: CreateAccountInput) => {
    setError(null);
    const toastId = toast.loading(isEditing ? 'Actualizando cuenta...' : 'Creando cuenta...');
    onMutationStart?.();

    startTransition(async () => {
      const result = isEditing
        ? await updateAccount(account.id, userId, {
            name: data.name,
            type: data.type,
            bankName: data.bankName || null,
            entityId: data.entityId || null,
            initialBalance: data.initialBalance,
            creditLimit: data.type === 'credit_card' ? data.creditLimit : null,
            isDefault: data.isDefault,
          })
        : await createAccount(userId, data);

      if (result.success) {
        // If adjusting balance, also update the current balance
        if (isEditing && adjustBalance) {
          const balanceResult = await adjustAccountBalance(account.id, userId, newBalance);
          if (!balanceResult.success) {
            setError(balanceResult.error);
            onMutationError?.(toastId, balanceResult.error);
            return;
          }
        }

        form.reset();
        setAdjustBalance(false);
        onSuccess();
        onMutationSuccess?.(toastId, isEditing ? 'Cuenta actualizada' : 'Cuenta creada');
      } else {
        setError(result.error);
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const watchType = form.watch('type');

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar cuenta' : 'Nueva cuenta'}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Modifica los detalles de la cuenta.'
            : 'Agrega una cuenta bancaria, efectivo o tarjeta de crédito.'}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Type */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de cuenta</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="checking">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Cuenta Corriente
                      </div>
                    </SelectItem>
                    <SelectItem value="savings">
                      <div className="flex items-center gap-2">
                        <PiggyBank className="h-4 w-4" />
                        Cuenta de Ahorro
                      </div>
                    </SelectItem>
                    <SelectItem value="cash">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        Efectivo
                      </div>
                    </SelectItem>
                    <SelectItem value="credit_card">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Tarjeta de Crédito
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Cuenta Corriente BCI" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Entity (Bank/Credit Card) */}
          {watchType !== 'cash' && (
            <FormField
              control={form.control}
              name="entityId"
              render={({ field }) => {
                const financialEntities = entities.filter((e) => e.type === 'bank' || e.type === 'credit_card');
                return (
                  <FormItem>
                    <FormLabel>Banco / Tarjeta (opcional)</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === '_none' ? undefined : value)}
                      value={field.value ?? '_none'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona institución" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_none">Sin institución</SelectItem>
                        {financialEntities.map((entity) => (
                          <SelectItem key={entity.id} value={entity.id}>
                            <div className="flex items-center gap-2">
                              {entity.imageUrl && (
                                <Image
                                  src={entity.imageUrl}
                                  alt={entity.name}
                                  width={20}
                                  height={20}
                                  className="rounded"
                                />
                              )}
                              {entity.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          )}

          {/* Currency Selector */}
          <div className="space-y-3">
            <div className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Moneda diferente
                </label>
                <p className="text-[0.8rem] text-muted-foreground">
                  Por defecto se usa CLP
                </p>
              </div>
              <Switch
                checked={showCurrencySelector}
                onCheckedChange={(checked) => {
                  setShowCurrencySelector(checked);
                  if (!checked) {
                    // Reset to CLP when disabling
                    form.setValue('currency', 'CLP');
                  }
                }}
              />
            </div>

            {showCurrencySelector && (
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una moneda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.code} - {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          {/* Initial Balance */}
          <FormField
            control={form.control}
            name="initialBalance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {watchType === 'credit_card' ? 'Deuda actual' : 'Saldo inicial'}
                </FormLabel>
                <FormControl>
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                    currency={form.watch('currency') ?? 'CLP'}
                    placeholder="0"
                  />
                </FormControl>
                <FormDescription>
                  {watchType === 'credit_card'
                    ? 'Cuánto debes actualmente en esta tarjeta'
                    : 'Cuánto tienes actualmente en esta cuenta'}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Credit Limit - Only for credit cards */}
          {watchType === 'credit_card' && (
            <FormField
              control={form.control}
              name="creditLimit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cupo total</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value ?? undefined}
                      onChange={field.onChange}
                      currency={form.watch('currency') ?? 'CLP'}
                      placeholder="0"
                    />
                  </FormControl>
                  <FormDescription>
                    El límite de crédito de tu tarjeta (cupo disponible = cupo total - deuda)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Is Default */}
          <FormField
            control={form.control}
            name="isDefault"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Cuenta principal</FormLabel>
                  <FormDescription>
                    Se usará como cuenta predeterminada para nuevas transacciones
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Balance Adjustment - Only when editing */}
          {isEditing && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Ajustar saldo actual
                  </label>
                  <p className="text-[0.8rem] text-muted-foreground">
                    Corrige el saldo manualmente (reconciliación)
                  </p>
                </div>
                <Switch
                  checked={adjustBalance}
                  onCheckedChange={(checked) => {
                    setAdjustBalance(checked);
                    if (checked && account) {
                      setNewBalance(parseFloat(account.currentBalance));
                    }
                  }}
                />
              </div>

              {adjustBalance && (
                <div className="space-y-3">
                  <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>Usar con precaución.</strong> Esta opción modifica el saldo actual de la cuenta
                      sin crear una transacción. Solo usar para corregir discrepancias o reconciliar con tu banco.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">
                      {watchType === 'credit_card' ? 'Nueva deuda' : 'Nuevo saldo'}
                    </label>
                    <CurrencyInput
                      value={newBalance}
                      onChange={(value) => setNewBalance(value ?? 0)}
                      currency={form.watch('currency') ?? 'CLP'}
                      placeholder="0"
                    />
                    <p className="text-[0.8rem] text-muted-foreground">
                      Saldo actual: {formatCurrency(account?.currentBalance ?? 0)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear cuenta'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
