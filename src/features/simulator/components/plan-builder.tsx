'use client';

import { useState } from 'react';
import { CurrencyInput } from '@/components/currency-input';
import { formatCurrency } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import { computePlan, type PlanInput, type Source, type SourceKind } from '../lib/plan';
import { monthLabel, pct } from './labels';

interface PlanBuilderProps {
  name: string;
  plan: PlanInput;
  sources: Source[];
  monthlySaving: number;
  onChange: (plan: PlanInput) => void;
}

const GROUPS: { kind: SourceKind; title: string; hint: string }[] = [
  { kind: 'fund', title: 'Tus fondos apartados', hint: 'El apartado para esto no se repone; otro fondo, sí' },
  { kind: 'savings', title: 'Tus ahorros', hint: 'Se reponen con lo que destinas cada mes' },
  { kind: 'third_party', title: 'Plata de terceros', hint: 'Préstamo sin interés: se devuelve primero' },
];

const LOAN_MONTHS = [12, 24, 36, 48];

/**
 * Armar el plan: cuánto sale de cada lado (fondos, ahorros, terceros, banco) y
 * cómo se repone mes a mes con lo que destinas.
 */
export function PlanBuilder({ name, plan, sources, monthlySaving, onChange }: PlanBuilderProps) {
  const [bankOpen, setBankOpen] = useState(plan.bank.amount > 0);
  const [bankMode, setBankMode] = useState<'offer' | 'estimate'>(plan.bank.offerInstallment ? 'offer' : 'estimate');
  const result = computePlan(plan, sources);
  const setAlloc = (id: string, value: number | undefined) =>
    onChange({ ...plan, allocations: { ...plan.allocations, [id]: value ?? 0 } });
  const setBank = (patch: Partial<PlanInput['bank']>) => onChange({ ...plan, bank: { ...plan.bank, ...patch } });

  const progress = Math.min(100, Math.round((result.covered / plan.target) * 100));
  const thirdPartyName = sources.find((s) => s.kind === 'third_party')?.name.replace(/^ahorro\s+/i, '') ?? 'terceros';

  return (
    <div className="space-y-4">
      {/* Cuánto llevas */}
      <section className="rounded-[22px] border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-base font-extrabold">Tu plan para {name || 'este gasto'}</h3>
          <span className="num text-sm font-bold text-muted-foreground">{formatCurrency(plan.target)}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3">
          <div className={cn('h-full rounded-full', result.missing > 0 ? 'bg-amber' : 'bg-jade')} style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-sm">
          {result.missing > 0 ? (
            <>
              Llevas <b className="num">{formatCurrency(result.covered)}</b> · te faltan{' '}
              <b className="num text-amber-text">{formatCurrency(result.missing)}</b>
            </>
          ) : result.missing < 0 ? (
            <>
              Listo · te sobran <b className="num">{formatCurrency(-result.missing)}</b>
            </>
          ) : (
            <b className="text-jade-text">¡Listo! Ya juntaste todo ✓</b>
          )}
        </p>
      </section>

      {/* De dónde sale */}
      {GROUPS.map((g) => {
        // El fondo apartado para este gasto va primero
        const list = sources
          .filter((s) => s.kind === g.kind)
          .sort((a, b) => Number(b.id === plan.earmarkedId) - Number(a.id === plan.earmarkedId));
        if (!list.length) return null;
        return (
          <section key={g.kind} className="rounded-[22px] border border-line bg-surface p-4">
            <h3 className="text-sm font-extrabold">{g.title}</h3>
            <p className="text-xs text-muted-foreground">{g.hint}</p>
            <ul className="mt-3 space-y-3">
              {list.map((s) => {
                const value = plan.allocations[s.id] ?? 0;
                return (
                  <li key={s.id} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 break-words font-bold">
                        {s.name}
                        {s.id === plan.earmarkedId && <span className="ml-1.5 text-xs font-semibold text-jade-text">· para esto</span>}
                        {s.kind !== 'savings' && <span className="block text-xs font-normal text-muted-foreground">en {s.accountName}</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAlloc(s.id, value >= s.available ? 0 : s.available)}
                        className="shrink-0 text-xs font-bold text-jade-text"
                      >
                        {value >= s.available ? 'Quitar' : `Usar todo (${formatCurrency(s.available)})`}
                      </button>
                    </div>
                    <CurrencyInput value={value || undefined} onChange={(v) => setAlloc(s.id, Math.min(v ?? 0, s.available))} placeholder="0" />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {/* Préstamo del banco */}
      <section className="rounded-[22px] border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold">Préstamo del banco</h3>
            <p className="text-xs text-muted-foreground">Si te ofrecieron uno, pon los datos de la oferta</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setBankOpen(!bankOpen);
              if (bankOpen) setBank({ amount: 0 });
            }}
            className={cn(
              'min-h-10 shrink-0 rounded-full px-3.5 text-xs font-extrabold',
              bankOpen ? 'bg-surface-3 text-foreground' : 'border border-line-strong'
            )}
          >
            {bankOpen ? 'Quitar' : 'Agregar'}
          </button>
        </div>

        {bankOpen && (
          <div className="mt-3 space-y-3">
            <div className="flex gap-1 rounded-full bg-background p-1" role="tablist">
              {(['offer', 'estimate'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={bankMode === m}
                  onClick={() => {
                    setBankMode(m);
                    if (m === 'estimate') setBank({ offerInstallment: null });
                  }}
                  className={cn(
                    'min-h-9 flex-1 rounded-full text-xs font-bold',
                    bankMode === m ? 'bg-cream text-cream-ink' : 'text-muted-foreground'
                  )}
                >
                  {m === 'offer' ? 'Tengo una oferta' : 'Estimar'}
                </button>
              ))}
            </div>

            <CurrencyInput label="Monto del préstamo" value={plan.bank.amount || undefined} onChange={(v) => setBank({ amount: v ?? 0 })} />

            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">Cuotas</p>
              <div className="flex flex-wrap gap-1.5">
                {LOAN_MONTHS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBank({ months: n })}
                    className={cn(
                      'min-h-10 rounded-full px-3.5 text-xs font-bold',
                      plan.bank.months === n ? 'bg-cream text-cream-ink' : 'border border-line text-muted-foreground'
                    )}
                  >
                    {n}
                  </button>
                ))}
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={120}
                  aria-label="Otro número de cuotas"
                  value={LOAN_MONTHS.includes(plan.bank.months) ? '' : plan.bank.months}
                  placeholder="Otro"
                  onChange={(e) => setBank({ months: Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 1)) })}
                  className="h-10 w-20 rounded-full border border-line bg-background px-3 text-center text-sm"
                />
              </div>
            </div>

            {bankMode === 'offer' ? (
              <>
                <CurrencyInput
                  label="Valor de la cuota que te ofrecieron"
                  value={plan.bank.offerInstallment || undefined}
                  onChange={(v) => setBank({ offerInstallment: v ?? null })}
                />
                <CurrencyInput
                  label="Gastos al inicio (impuesto, notaría, comisión)"
                  value={plan.bank.upfrontCosts || undefined}
                  onChange={(v) => setBank({ upfrontCosts: v ?? 0 })}
                />
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="flex h-14 flex-col justify-center rounded-2xl border border-line bg-background px-3">
                  <span className="text-xs text-muted-foreground">Tasa mensual %</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    max={20}
                    value={Math.round(plan.bank.monthlyRate * 10000) / 100}
                    onChange={(e) => setBank({ monthlyRate: Math.max(0, Math.min(20, parseFloat(e.target.value) || 0)) / 100 })}
                    className="bg-transparent text-base font-bold outline-none"
                  />
                </label>
                <CurrencyInput label="Seguro mensual" value={plan.bank.monthlyInsurance || undefined} onChange={(v) => setBank({ monthlyInsurance: v ?? 0 })} />
              </div>
            )}

            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Meses antes de la primera cuota</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={24}
                value={plan.bank.graceMonths ?? 0}
                onChange={(e) => setBank({ graceMonths: Math.max(0, Math.min(24, parseInt(e.target.value, 10) || 0)) })}
                className="h-10 w-20 rounded-full border border-line bg-background px-3 text-center"
              />
            </label>

            {result.loanAmount > 0 && (
              <p className="rounded-2xl bg-background p-3 text-sm">
                Cuota de <b className="num">{formatCurrency(result.installment)}</b> · pagas{' '}
                <b className="num text-coral-text">{formatCurrency(result.extraCost)} extra</b>
                {result.cae != null && <> · CAE {pct(result.cae)}</>}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Cómo lo repones */}
      <section className="rounded-[22px] border border-line bg-surface p-4">
        <h3 className="text-sm font-extrabold">¿Cuánto puedes destinar al mes?</h3>
        <p className="text-xs text-muted-foreground">
          Tu plan de ahorro es {formatCurrency(monthlySaving)} al mes. Con eso pagas la cuota del banco, devuelves y repones.
        </p>
        <div className="mt-2.5">
          <CurrencyInput value={plan.monthlyRepay || undefined} onChange={(v) => onChange({ ...plan, monthlyRepay: v ?? 0 })} />
        </div>

        <ul className="mt-3.5 space-y-2 text-sm">
          {result.fromThirdParty > 0 && (
            <ResultLine done={result.thirdPartyDoneMonth}>
              Le devuelves {formatCurrency(result.fromThirdParty)} a {thirdPartyName}
            </ResultLine>
          )}
          {result.fromSavings > 0 && (
            <ResultLine done={result.savingsDoneMonth}>Tus ahorros y fondos vuelven a como estaban ({formatCurrency(result.fromSavings)})</ResultLine>
          )}
          {result.loanAmount > 0 && <ResultLine done={result.loanDoneMonth}>Terminas de pagar el préstamo del banco</ResultLine>}
          {result.fromThirdParty + result.fromSavings + result.loanAmount === 0 && result.covered > 0 && (
            <li className="text-muted-foreground">No hay nada que reponer: usas solo lo que ya tenías apartado.</li>
          )}
        </ul>

        {result.installmentTooHigh && (
          <p className="mt-3 rounded-2xl bg-coral-soft p-3 text-sm text-coral-text">
            La cuota del banco ({formatCurrency(result.installment)}) es más de lo que destinas al mes.
          </p>
        )}

        {result.schedule.length > 0 && <Schedule result={result} thirdPartyName={thirdPartyName} />}
      </section>
    </div>
  );
}

function ResultLine({ done, children }: { done: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-3">
      <span>{children}</span>
      <b className={cn('num shrink-0', done === -1 ? 'text-coral-text' : 'text-jade-text')}>
        {done === -1 ? 'no alcanza' : done === 0 ? '—' : monthLabel(done)}
      </b>
    </li>
  );
}

/** Mes a mes: cuota del banco, devolución a terceros y reposición de ahorros */
function Schedule({ result, thirdPartyName }: { result: ReturnType<typeof computePlan>; thirdPartyName: string }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? result.schedule : result.schedule.slice(0, 6);
  const cols = [
    result.loanAmount > 0 && { key: 'loanPayment' as const, label: 'Banco' },
    result.fromThirdParty > 0 && { key: 'toThirdParty' as const, label: thirdPartyName },
    result.fromSavings > 0 && { key: 'toSavings' as const, label: 'Ahorros' },
  ].filter(Boolean) as { key: 'loanPayment' | 'toThirdParty' | 'toSavings'; label: string }[];
  if (!cols.length) return null;

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-faint">Mes a mes</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="pb-1.5 text-left font-semibold">Mes</th>
            {cols.map((c) => (
              <th key={c.key} className="pb-1.5 text-right font-semibold">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.month} className="border-t border-line">
              <td className="py-1.5">{monthLabel(m.month)}</td>
              {cols.map((c) => (
                <td key={c.key} className="num py-1.5 text-right">
                  {m[c.key] > 0 ? formatCurrency(m[c.key]) : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {result.schedule.length > 6 && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="mt-2 min-h-10 text-xs font-bold text-jade-text">
          {showAll ? 'Ver menos' : `Ver los ${result.schedule.length} meses`}
        </button>
      )}
    </div>
  );
}
