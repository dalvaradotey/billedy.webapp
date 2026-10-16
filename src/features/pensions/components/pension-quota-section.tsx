'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, FileUp, LineChart, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/currency-input';
import { DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, ResponsiveDrawer } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { appDateString, formatCurrency } from '@/lib/formatting';
import {
  configurePensionQuotas,
  confirmContribution,
  fetchPensionStatus,
  importPensionDocument,
  refreshPensionValues,
  type PensionStatus,
} from '../actions';
import { AFC_FUND, AFC_PROVIDER, AFP_FUNDS, AFP_PROVIDERS } from '../lib/quota-values';
import { StatementHelp } from './statement-help';

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
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const periodName = (p: string) => `${MONTHS_LONG[parseInt(p.slice(5, 7), 10) - 1]} ${p.slice(0, 4)}`;
const STATUS: Record<string, { label: string; className: string }> = {
  upcoming: { label: 'por llegar', className: 'bg-surface-3 text-muted-foreground' },
  due: { label: 'debería llegar', className: 'bg-amber-soft text-amber-text' },
  late: { label: 'atrasada', className: 'bg-coral-soft text-coral-text' },
};

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState<{ period: string; amount: number | undefined; paidDate: string } | null>(null);

  const reload = async () => {
    const fresh = await fetchPensionStatus(userId, accountId);
    if (fresh.success) setStatus(fresh.data);
    router.refresh();
  };

  const importFile = (file: File) => {
    const form = new FormData();
    form.set('file', file);
    startTransition(async () => {
      const result = await importPensionDocument(userId, accountId, form);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const d = result.data;
      toast.success(
        [
          `${d.kind === 'cartola' ? 'Cartola' : 'Certificado'}: ${d.periods} meses`,
          d.applied ? `${d.applied} sumadas a la cuenta` : null,
          d.history ? `${d.history} al historial` : null,
          d.quotasUpdated ? `cuotas corregidas a ${quotas(d.quotasUpdated.to)}` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      );
      await reload();
    });
  };

  const confirm = () => {
    if (!confirming?.amount) return;
    startTransition(async () => {
      const result = await confirmContribution(userId, accountId, {
        period: confirming.period,
        amount: confirming.amount!,
        paidDate: confirming.paidDate,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Cotización de ${periodName(confirming.period)} sumada`);
      setConfirming(null);
      await reload();
    });
  };

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
      {configured && (status.expected.length > 0 || status.recent.length > 0) && (
        <div className="mt-3 border-t border-surface-3 pt-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Cotizaciones</p>
          <ul className="mt-1.5 space-y-1.5">
            {status.expected.map((e) => (
              <li key={e.period} className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold capitalize">{periodName(e.period)}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {e.amount ? `~${formatCurrency(e.amount)} · ` : ''}entre el {shortDate(e.windowStart)} y el {shortDate(e.windowEnd)}
                  </span>
                </span>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold', STATUS[e.status].className)}>
                  {STATUS[e.status].label}
                </span>
                {e.status !== 'upcoming' && (
                  <button
                    type="button"
                    onClick={() => setConfirming({ period: e.period, amount: e.amount ?? undefined, paidDate: appDateString(new Date()) })}
                    className="min-h-8 shrink-0 rounded-full bg-jade-soft px-2.5 text-[11px] font-bold text-jade-text"
                  >
                    Llegó
                  </button>
                )}
              </li>
            ))}
            {status.recent.slice(0, 3).map((r) => (
              <li key={r.period} className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 shrink-0 text-jade" />
                <span className="min-w-0 flex-1 truncate text-[13px] capitalize">{periodName(r.period)}</span>
                <span className="num shrink-0 text-[13px] font-bold">{formatCurrency(r.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-4">
        <button type="button" onClick={openForm} className="min-h-9 text-xs font-bold text-jade">
          {configured ? 'Editar cuotas' : 'Configurar'}
        </button>
        {configured && status.provider === AFC_PROVIDER && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isPending}
            className="flex min-h-9 items-center gap-1 text-xs font-bold text-jade"
          >
            <FileUp className="h-3.5 w-3.5" />
            Importar cartola o certificado
          </button>
        )}
        {configured && <StatementHelp provider={status.provider!} />}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importFile(file);
          e.target.value = '';
        }}
      />

      <ResponsiveDrawer open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <DrawerContent>
          {confirming && (
            <div className="mx-auto w-full max-w-lg">
              <DrawerHeader>
                <DrawerTitle className="capitalize">Cotización de {periodName(confirming.period)}</DrawerTitle>
                <DrawerDescription>Lo que se abonó a tu cuenta; suma sus cuotas con el valor cuota del día.</DrawerDescription>
              </DrawerHeader>
              <div className="space-y-4 px-4 pb-6">
                <CurrencyInput
                  value={confirming.amount}
                  onChange={(v) => setConfirming((c) => (c ? { ...c, amount: v } : c))}
                  label="Monto abonado"
                  placeholder="0"
                />
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-muted-foreground">Fecha en que se abonó</span>
                  <input
                    type="date"
                    value={confirming.paidDate}
                    onChange={(e) => setConfirming((c) => (c ? { ...c, paidDate: e.target.value } : c))}
                    className="h-12 w-full rounded-xl border border-line bg-background px-3 text-sm outline-none focus:border-jade"
                  />
                </label>
                <Button variant="cta" className="w-full" disabled={isPending || !confirming.amount} onClick={confirm}>
                  Sumar a la cuenta
                </Button>
              </div>
            </div>
          )}
        </DrawerContent>
      </ResponsiveDrawer>

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
