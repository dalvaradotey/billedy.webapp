'use client';

import { useState, useTransition, useMemo } from 'react';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { FormDrawer, FormDrawerBody, FormDrawerFooter } from '@/components/form-drawer';
import { FloatingLabelInput } from '@/components/floating-label-input';
import { FloatingLabelDateInput } from '@/components/floating-label-date-input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatting';
import { registerProvisionContribution } from '../actions';
import type { AccountWithEntity } from '../types';
import type { Category } from '@/features/categories/types';

interface ProvisionContributionDialogProps {
  account: AccountWithEntity;
  categories: Category[];
  projectId: string;
  userId: string;
  onSuccess: () => void;
  onMutationStart?: () => void;
  onMutationSuccess?: (toastId: string | number, message: string) => void;
  onMutationError?: (toastId: string | number, error: string) => void;
}

export function ProvisionContributionDialogContent({
  account,
  categories,
  projectId,
  userId,
  onSuccess,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: ProvisionContributionDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [showSuccess, setShowSuccess] = useState(false);

  const [contributionAmount, setContributionAmount] = useState('');
  const [providerBalance, setProviderBalance] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());

  // Buscar las categorías auto-creadas para esta cuenta
  const contributionCategory = useMemo(
    () => categories.find((c) => c.name === `Aporte ${account.name}`),
    [categories, account.name]
  );
  const profitabilityCategory = useMemo(
    () => categories.find((c) => c.name === `Rentabilidad ${account.name}`),
    [categories, account.name]
  );

  // Preview del ajuste
  const preview = useMemo(() => {
    const contribution = parseFloat(contributionAmount) || 0;
    const provider = parseFloat(providerBalance) || 0;
    if (!contribution || !provider) return null;

    const currentBalance = parseFloat(account.currentBalance);
    const balanceAfterContribution = currentBalance + contribution;
    const adjustment = provider - balanceAfterContribution;

    return { adjustment, isGain: adjustment >= 0 };
  }, [contributionAmount, providerBalance, account.currentBalance]);

  const isValid = !!(
    contributionAmount &&
    parseFloat(contributionAmount) > 0 &&
    providerBalance &&
    parseFloat(providerBalance) > 0 &&
    date &&
    contributionCategory &&
    profitabilityCategory
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !contributionCategory || !profitabilityCategory) return;

    const toastId = toast.loading('Registrando aporte...');
    onMutationStart?.();

    startTransition(async () => {
      const result = await registerProvisionContribution(userId, {
        accountId: account.id,
        projectId,
        contributionAmount: parseFloat(contributionAmount),
        currentProviderBalance: parseFloat(providerBalance),
        date: date!,
        contributionCategoryId: contributionCategory.id,
        profitabilityCategoryId: profitabilityCategory.id,
      });

      if (result.success) {
        const adj = result.data.adjustmentAmount;
        const adjText = Math.abs(adj) >= 1
          ? ` · Rentabilidad: ${adj >= 0 ? '+' : ''}${formatCurrency(adj)}`
          : '';
        setShowSuccess(true);
        onMutationSuccess?.(toastId, `Aporte registrado${adjText}`);
        setTimeout(() => onSuccess(), 1200);
      } else {
        onMutationError?.(toastId, result.error);
      }
    });
  };

  const typeLabel = account.type === 'pension' ? 'Fondo de Pensión' : 'Seguro de Cesantía';
  const missingCategories = !contributionCategory || !profitabilityCategory;

  return (
    <FormDrawer
      title="Registrar aporte"
      description={`${typeLabel}: ${account.name}`}
      showSuccess={showSuccess}
    >
      <FormDrawerBody as="form" onSubmit={handleSubmit}>
        {missingCategories && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-200">
            No se encontraron las categorías automáticas para esta cuenta.
            Verifica que existan las categorías &quot;Aporte {account.name}&quot; y &quot;Rentabilidad {account.name}&quot;.
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Saldo actual en la app: <strong>{formatCurrency(parseFloat(account.currentBalance))}</strong>
          </p>

          <div data-field data-vaul-no-drag>
            <FloatingLabelInput
              label="Aporte del mes"
              value={contributionAmount}
              onChange={setContributionAmount}
              type="number"
              inputMode="decimal"
              placeholder="350000"
              valid={!!contributionAmount && parseFloat(contributionAmount) > 0}
            />
          </div>

          <div data-field data-vaul-no-drag>
            <FloatingLabelInput
              label="Saldo actual según proveedor"
              value={providerBalance}
              onChange={setProviderBalance}
              type="number"
              inputMode="decimal"
              placeholder="38721048"
              valid={!!providerBalance && parseFloat(providerBalance) > 0}
            />
          </div>

          <div data-field data-vaul-no-drag>
            <FloatingLabelDateInput
              label="Fecha"
              value={date}
              onChange={setDate}
              valid={!!date}
            />
          </div>
        </div>

        {/* Preview de rentabilidad */}
        {preview && (
          <div className={`rounded-lg p-3 flex items-center gap-3 ${
            preview.isGain
              ? 'bg-emerald-500/10 border border-emerald-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}>
            {preview.isGain ? (
              <TrendingUp className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-400 flex-shrink-0" />
            )}
            <div>
              <p className={`text-sm font-medium ${preview.isGain ? 'text-emerald-400' : 'text-red-400'}`}>
                {preview.isGain ? 'Ganancia' : 'Pérdida'}: {formatCurrency(Math.abs(preview.adjustment))}
              </p>
              <p className="text-xs text-muted-foreground">
                Se registrará automáticamente como {preview.isGain ? 'ingreso' : 'gasto'}
              </p>
            </div>
          </div>
        )}

        <FormDrawerFooter>
          <Button
            type="submit"
            disabled={isPending || !isValid}
            className="w-full"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar aporte
          </Button>
        </FormDrawerFooter>
      </FormDrawerBody>
    </FormDrawer>
  );
}
