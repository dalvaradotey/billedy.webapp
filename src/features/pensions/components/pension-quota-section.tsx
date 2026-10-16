'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LineChart, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/currency-input';
import { DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, ResponsiveDrawer } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { appDateString, formatCurrency } from '@/lib/formatting';
import { configurePensionQuotas, fetchPensionStatus, refreshPensionValues, type PensionStatus } from '../actions';
import { AFC_FUND, AFC_PROVIDER, AFP_FUNDS, AFP_PROVIDERS } from '../lib/quota-values';

const PROVIDER_LABELS: Record<string, string> = {
  CAPITAL: 'AFP Capital',
  CUPRUM: 'AFP Cuprum',
  HABITAT: 'AFP Habitat',
  MODELO: 'AFP Modelo',
  PLANVITAL: 'AFP PlanVital',
  PROVIDA: 'AFP ProVida',
  UNO: 'AFP Uno',
  AFC: 'AFC (Seguro de Cesantía)',
};

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const shortDate = (iso: string) => `${parseInt(iso.slice(8, 10), 10)} ${MONTHS[parseInt(iso.slice(5, 7), 10) - 1]}`;
const quotas = (n: number) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(n);

/**
 * Cuotas escritas a mano: "566,17", "1.234,5" o "566.17". Con coma, los puntos
 * son miles; sin coma, un punto seguido de 1 a 4 dígitos al final es decimal.
 */
function parseQuotaInput(raw: string): number {
  const s = raw.trim().replace(/\s/g, '');
  if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d+\.\d{1,4}$/.test(s)) return Number(s);
  return Number(s.replace(/\./g, ''));
}

interface PensionQuotaSectionProps {
  userId: string;
  accountId: string;
  accountType: string;
}

/**
 * Saldo por cuotas en las cuentas de AFP y seguro de cesantía: el saldo se
 * actualiza solo cada día con el valor cuota público.
 */
export function PensionQuotaSection({ userId, accountId, accountType }: PensionQuotaSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<PensionStatus | null>(null);
  const [open, setOpen] = useState(false);

  // Formulario
  const isUnemployment = accountType === 'unemployment';
  const [provider, setProvider] = useState(isUnemployment ? AFC_PROVIDER : 'MODELO');
  const [fund, setFund] = useState(isUnemployment ? AFC_FUND : 'B');
  const [mode, setMode] = useState<'quotas' | 'balance'>('quotas');
  const [quotaInput, setQuotaInput] = useState('');
  const [balance, setBalance] = useState<number | undefined>(undefined);
  const [date, setDate] = useState(appDateString(new Date()));

  useEffect(() => {
    let active = true;
    fetchPensionStatus(userId, accountId).then((r) => {
      if (active && r.success) setStatus(r.data);
    });
    return () => {
      active = false;
    };
  }, [userId, accountId]);

  const openForm = () => {
    if (status?.provider) setProvider(status.provider);
    if (status?.fund) setFund(status.fund);
    setQuotaInput(status?.quotaCount != null ? String(status.quotaCount).replace('.', ',') : '');
    setOpen(true);
  };

  const save = () => {
    const quotaCount = mode === 'quotas' ? parseQuotaInput(quotaInput) : null;
    startTransition(async () => {
      const result = await configurePensionQuotas(userId, accountId, {
        provider,
        fund: provider === AFC_PROVIDER ? AFC_FUND : fund,
        quotaCount: quotaCount && quotaCount > 0 ? quotaCount : null,
        balance: mode === 'balance' ? (balance ?? null) : null,
        date,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Listo: ${quotas(result.data.quotaCount)} cuotas · ${formatCurrency(result.data.balance)}`);
      setOpen(false);
      const fresh = await fetchPensionStatus(userId, accountId);
      if (fresh.success) setStatus(fresh.data);
      router.refresh();
    });
  };

  const refresh = () =>
    startTransition(async () => {
      const result = await refreshPensionValues(userId, accountId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const fresh = await fetchPensionStatus(userId, accountId);
      if (fresh.success) setStatus(fresh.data);
      router.refresh();
    });

  const configured = status?.provider && status.quotaCount != null;

  return (
    <div className="mb-3 rounded-2xl bg-background p-3.5">
      {configured ? (
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-soft text-violet">
            <LineChart className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              {quotas(status.quotaCount!)} cuotas · {PROVIDER_LABELS[status.provider!] ?? status.provider}
              {status.provider !== AFC_PROVIDER && ` · Fondo ${status.fund}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {status.quote
                ? `Valor cuota ${formatCurrency(status.quote.value)} al ${shortDate(status.quote.date)} · se actualiza solo cada día`
                : 'Esperando el valor cuota del día'}
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={isPending}
            aria-label="Actualizar ahora"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm font-bold">Saldo automático</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Indica tu institución y tus cuotas, y el saldo se actualiza solo cada día con el valor cuota público.
          </p>
        </div>
      )}
      <button type="button" onClick={openForm} className="mt-2 min-h-9 text-xs font-bold text-jade">
        {configured ? 'Editar cuotas' : 'Configurar'}
      </button>

      <ResponsiveDrawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-lg">
            <DrawerHeader>
              <DrawerTitle>Saldo por cuotas</DrawerTitle>
              <DrawerDescription>Saldo = cuotas × valor cuota del día, que es público.</DrawerDescription>
            </DrawerHeader>
            <div className="space-y-4 px-4 pb-6">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-muted-foreground">Institución</span>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="h-12 w-full rounded-xl border border-line bg-background px-3 text-sm outline-none focus:border-jade"
                >
                  {(isUnemployment ? [AFC_PROVIDER] : AFP_PROVIDERS).map((p) => (
                    <option key={p} value={p}>
                      {PROVIDER_LABELS[p]}
                    </option>
                  ))}
                </select>
              </label>

              {provider !== AFC_PROVIDER && (
                <div>
                  <span className="mb-1 block text-xs font-bold text-muted-foreground">Fondo</span>
                  <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Fondo">
                    {AFP_FUNDS.map((f) => (
                      <button
                        key={f}
                        type="button"
                        role="radio"
                        aria-checked={fund === f}
                        onClick={() => setFund(f)}
                        className={cn(
                          'min-h-11 rounded-xl border text-sm font-extrabold',
                          fund === f ? 'border-jade bg-jade-soft text-jade-text' : 'border-line text-muted-foreground'
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-1 rounded-full bg-background p-1" role="tablist">
                {(['quotas', 'balance'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={cn('min-h-9 rounded-full text-xs font-bold', mode === m ? 'bg-surface-3 text-foreground' : 'text-muted-foreground')}
                  >
                    {m === 'quotas' ? 'Sé mis cuotas' : 'Solo sé el saldo'}
                  </button>
                ))}
              </div>

              {mode === 'quotas' ? (
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-muted-foreground">Número de cuotas</span>
                  <input
                    inputMode="decimal"
                    value={quotaInput}
                    onChange={(e) => setQuotaInput(e.target.value)}
                    placeholder="Ej: 566,17"
                    className="h-12 w-full rounded-xl border border-line bg-background px-3 text-base font-bold outline-none focus:border-jade"
                  />
                  <span className="mt-1 block text-[11px] text-muted-foreground">Sale en tu cartola o en el detalle de tu cuenta.</span>
                </label>
              ) : (
                <div className="space-y-1">
                  <CurrencyInput value={balance} onChange={setBalance} label="Saldo en pesos" placeholder="0" />
                  <span className="block text-[11px] text-muted-foreground">
                    Calculo tus cuotas con el valor cuota de la fecha. Es una estimación hasta que cargues una cartola.
                  </span>
                </div>
              )}

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-muted-foreground">Fecha de ese dato</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-12 w-full rounded-xl border border-line bg-background px-3 text-sm outline-none focus:border-jade"
                />
              </label>

              <Button variant="cta" className="w-full" disabled={isPending} onClick={save}>
                {isPending ? 'Guardando…' : 'Guardar y actualizar saldo'}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </ResponsiveDrawer>
    </div>
  );
}
