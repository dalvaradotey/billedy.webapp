'use client';

import { useState } from 'react';
import { CurrencyInput } from '@/components/currency-input';
import { formatCurrency } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import {
  computePlan,
  emptyAdvance,
  type BankLoan,
  type CardOption,
  type LoanSummary,
  type PlanInput,
  type PlanResult,
  type Source,
  type SourceKind,
} from '../lib/plan';
import { monthLabel, pct } from './labels';

interface PlanBuilderProps {
  plan: PlanInput;
  sources: Source[];
  cards: CardOption[];
  monthlySaving: number;
  onChange: (plan: PlanInput) => void;
  onSave: () => void;
  isSaving: boolean;
}

const GROUPS: { kind: SourceKind; title: string; hint: string }[] = [
  { kind: 'fund', title: 'Tus fondos apartados', hint: 'El apartado para esto no se repone; otro fondo, sí' },
  { kind: 'checking', title: 'Tu cuenta corriente', hint: 'Lo libre de tu cuenta principal; se repone con tu ahorro' },
  { kind: 'savings', title: 'Tus ahorros', hint: 'Se reponen con lo que destinas cada mes' },
  { kind: 'third_party', title: 'Plata de terceros', hint: 'Préstamo sin interés: se devuelve antes de reponer lo tuyo' },
];

const LOAN_MONTHS = [6, 12, 24, 36, 48];

/**
 * Armar el plan: cuánto sale de cada lado (fondos, cuenta, ahorros, terceros,
 * banco, avance en efectivo) y cómo se repone mes a mes con lo que destinas.
 * Abajo queda fija una barra con lo que llevas y cuándo recuperas tus ahorros.
 */
export function PlanBuilder({ plan, sources, cards, monthlySaving, onChange, onSave, isSaving }: PlanBuilderProps) {
  const result = computePlan(plan, sources);
  const setAlloc = (id: string, value: number | undefined) =>
    onChange({ ...plan, allocations: { ...plan.allocations, [id]: value ?? 0 } });
  const thirdPartyName = sources.find((s) => s.kind === 'third_party')?.name.replace(/^ahorro\s+/i, '') ?? 'terceros';
  const repay = plan.monthlyRepay || 0;

  return (
    <div className="space-y-4">
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
            <ul className="mt-3 space-y-3.5">
              {list.map((s) => {
                const value = plan.allocations[s.id] ?? 0;
                const replenished = s.kind !== 'third_party' && s.id !== plan.earmarkedId;
                const months = replenished && value > 0 && repay > 0 ? Math.ceil(value / repay) : 0;
                return (
                  <li key={s.id} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 break-words font-bold">
                        {s.name}
                        {s.id === plan.earmarkedId && <span className="ml-1.5 text-xs font-semibold text-jade-text">· para esto</span>}
                        {(s.kind === 'fund' || s.kind === 'third_party') && (
                          <span className="block text-xs font-normal text-muted-foreground">en {s.accountName}</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAlloc(s.id, value >= s.available ? 0 : s.available)}
                        className="min-h-8 shrink-0 text-xs font-bold text-jade-text"
                      >
                        {value >= s.available ? 'Quitar' : `Usar todo (${formatCurrency(s.available)})`}
                      </button>
                    </div>
                    <CurrencyInput value={value || undefined} onChange={(v) => setAlloc(s.id, Math.min(v ?? 0, s.available))} placeholder="0" />
                    {months > 0 && (
                      <p className="text-xs text-muted-foreground">
                        ≈ <b className="text-foreground">{months} {months === 1 ? 'mes' : 'meses'}</b> de tu ahorro para reponerlo
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <LoanSection
        title="Préstamo del banco"
        hint="Si te ofrecieron uno, pon los datos de la oferta"
        loan={plan.bank}
        summary={{ amount: result.loanAmount, installment: result.installment, extraCost: result.extraCost, cae: result.cae, doneMonth: result.loanDoneMonth }}
        onChange={(bank) => onChange({ ...plan, bank })}
      />

      {cards.length > 0 && (
        <LoanSection
          title="Avance en efectivo"
          hint="Con tu tarjeta de crédito: suele tener más interés y comisión"
          loan={plan.cardAdvance ?? emptyAdvance(cards[0].id)}
          summary={result.advance}
          upfrontLabel="Comisión del avance"
          cards={cards}
          onChange={(cardAdvance) => onChange({ ...plan, cardAdvance })}
        />
      )}

      {/* Cómo lo repones */}
      <section className="rounded-[22px] border border-line bg-surface p-4">
        <h3 className="text-sm font-extrabold">¿Cuánto puedes destinar al mes?</h3>
        <p className="text-xs text-muted-foreground">
          Tu plan de ahorro es {formatCurrency(monthlySaving)} al mes. Con eso pagas las cuotas, devuelves y repones.
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
            <ResultLine done={result.savingsDoneMonth}>Recuperas tus ahorros ({formatCurrency(result.fromSavings)})</ResultLine>
          )}
          {result.loanAmount > 0 && <ResultLine done={result.loanDoneMonth}>Terminas de pagar el préstamo del banco</ResultLine>}
          {result.advance.amount > 0 && <ResultLine done={result.advance.doneMonth}>Terminas de pagar el avance</ResultLine>}
          {result.fromThirdParty + result.fromSavings + result.loanAmount + result.advance.amount === 0 && result.covered > 0 && (
            <li className="text-muted-foreground">No hay nada que reponer: usas solo lo que ya tenías apartado.</li>
          )}
        </ul>

        {result.installmentTooHigh && (
          <p className="mt-3 rounded-2xl bg-coral-soft p-3 text-sm text-coral-text">
            Las cuotas ({formatCurrency(result.installment + result.advance.installment)} al mes) son más de lo que destinas.
          </p>
        )}

        {result.schedule.length > 0 && <Schedule result={result} thirdPartyName={thirdPartyName} />}
      </section>

      <StickySummary plan={plan} result={result} thirdPartyName={thirdPartyName} onSave={onSave} isSaving={isSaving} />
    </div>
  );
}

/**
 * Barra fija abajo (sobre la navegación en el teléfono): cuánto llevas, cuánto
 * falta y cuándo recuperas tus ahorros, para no tener que volver arriba.
 */
function StickySummary({
  plan,
  result,
  thirdPartyName,
  onSave,
  isSaving,
}: {
  plan: PlanInput;
  result: PlanResult;
  thirdPartyName: string;
  onSave: () => void;
  isSaving: boolean;
}) {
  const progress = Math.min(100, Math.round((result.covered / plan.target) * 100));
  const extra = result.extraCost + result.advance.extraCost;
  const facts = [
    result.fromSavings > 0 && (
      <>
        ahorros de vuelta en{' '}
        <b className={result.savingsDoneMonth === -1 ? 'text-coral-text' : 'text-foreground'}>
          {result.savingsDoneMonth === -1 ? 'no alcanza' : monthLabel(result.savingsDoneMonth)}
        </b>
      </>
    ),
    result.fromThirdParty > 0 && result.thirdPartyDoneMonth !== 0 && (
      <>
        {thirdPartyName}{' '}
        <b className="text-foreground">{result.thirdPartyDoneMonth === -1 ? 'no alcanza' : monthLabel(result.thirdPartyDoneMonth)}</b>
      </>
    ),
    extra > 0 && (
      <>
        pagas <b className="text-coral-text">{formatCurrency(extra)} extra</b>
      </>
    ),
  ].filter(Boolean);

  return (
    <div className="sticky bottom-[calc(6rem+env(safe-area-inset-bottom))] z-20 rounded-[22px] border border-line-strong bg-surface-2 p-3 shadow-[0_12px_32px_rgba(8,6,12,0.45)] md:bottom-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            {result.missing > 0 ? (
              <>
                Faltan <b className="num text-amber-text">{formatCurrency(result.missing)}</b>
                <span className="text-xs text-muted-foreground"> de {formatCurrency(plan.target)}</span>
              </>
            ) : result.missing < 0 ? (
              <>
                <b className="text-jade-text">Completo</b>
                <span className="text-xs text-muted-foreground"> · sobran {formatCurrency(-result.missing)}</span>
              </>
            ) : (
              <b className="text-jade-text">¡Completo! ✓</b>
            )}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className={cn('h-full rounded-full transition-[width]', result.missing > 0 ? 'bg-amber' : 'bg-jade')} style={{ width: `${progress}%` }} />
          </div>
          {facts.length > 0 && (
            <p className="mt-1.5 truncate text-xs text-muted-foreground">
              {facts.map((f, i) => (
                <span key={i}>
                  {i > 0 && ' · '}
                  {f}
                </span>
              ))}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="min-h-11 shrink-0 rounded-full bg-jade px-4 text-sm font-extrabold text-jade-ink disabled:opacity-50"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

/** Préstamo del banco o avance en efectivo: con la oferta real o estimado */
function LoanSection({
  title,
  hint,
  loan,
  summary,
  onChange,
  upfrontLabel = 'Gastos al inicio (impuesto, notaría, comisión)',
  cards,
}: {
  title: string;
  hint: string;
  loan: BankLoan & { cardId?: string | null };
  summary: LoanSummary;
  onChange: (loan: BankLoan & { cardId?: string | null }) => void;
  upfrontLabel?: string;
  cards?: CardOption[];
}) {
  const [open, setOpen] = useState(loan.amount > 0);
  const [mode, setMode] = useState<'offer' | 'estimate'>(loan.offerInstallment ? 'offer' : 'estimate');
  const set = (patch: Partial<BankLoan & { cardId?: string | null }>) => onChange({ ...loan, ...patch });
  const card = cards?.find((c) => c.id === loan.cardId) ?? cards?.[0];

  return (
    <section className="rounded-[22px] border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold">{title}</h3>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (open) set({ amount: 0 });
            setOpen(!open);
          }}
          className={cn('min-h-10 shrink-0 rounded-full px-3.5 text-xs font-extrabold', open ? 'bg-surface-3 text-foreground' : 'border border-line-strong')}
        >
          {open ? 'Quitar' : 'Agregar'}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          {cards && cards.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {cards.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => set({ cardId: c.id })}
                  className={cn(
                    'min-h-10 rounded-full px-3.5 text-xs font-bold',
                    card?.id === c.id ? 'bg-cream text-cream-ink' : 'border border-line text-muted-foreground'
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-1 rounded-full bg-background p-1" role="tablist">
            {(['offer', 'estimate'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  if (m === 'estimate') set({ offerInstallment: null });
                }}
                className={cn('min-h-9 flex-1 rounded-full text-xs font-bold', mode === m ? 'bg-cream text-cream-ink' : 'text-muted-foreground')}
              >
                {m === 'offer' ? 'Tengo una oferta' : 'Estimar'}
              </button>
            ))}
          </div>

          <div>
            <CurrencyInput label="Monto" value={loan.amount || undefined} onChange={(v) => set({ amount: v ?? 0 })} />
            {card && (
              <p className={cn('mt-1 text-xs', loan.amount > card.available ? 'text-coral-text' : 'text-muted-foreground')}>
                Cupo disponible en {card.name}: {formatCurrency(card.available)}
              </p>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Cuotas</p>
            <div className="flex flex-wrap gap-1.5">
              {LOAN_MONTHS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set({ months: n })}
                  className={cn(
                    'min-h-10 min-w-10 rounded-full px-3 text-xs font-bold',
                    loan.months === n ? 'bg-cream text-cream-ink' : 'border border-line text-muted-foreground'
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
                value={LOAN_MONTHS.includes(loan.months) ? '' : loan.months}
                placeholder="Otro"
                onChange={(e) => set({ months: Math.max(1, Math.min(120, parseInt(e.target.value, 10) || 1)) })}
                className="h-10 w-20 rounded-full border border-line bg-background px-3 text-center text-sm"
              />
            </div>
          </div>

          {mode === 'offer' ? (
            <>
              <CurrencyInput label="Valor de la cuota que te ofrecieron" value={loan.offerInstallment || undefined} onChange={(v) => set({ offerInstallment: v ?? null })} />
              <CurrencyInput label={upfrontLabel} value={loan.upfrontCosts || undefined} onChange={(v) => set({ upfrontCosts: v ?? 0 })} />
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
                  value={Math.round(loan.monthlyRate * 10000) / 100}
                  onChange={(e) => set({ monthlyRate: Math.max(0, Math.min(20, parseFloat(e.target.value) || 0)) / 100 })}
                  className="bg-transparent text-base font-bold outline-none"
                />
              </label>
              <CurrencyInput label="Seguro mensual" value={loan.monthlyInsurance || undefined} onChange={(v) => set({ monthlyInsurance: v ?? 0 })} />
            </div>
          )}

          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Meses antes de la primera cuota</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={24}
              value={loan.graceMonths ?? 0}
              onChange={(e) => set({ graceMonths: Math.max(0, Math.min(24, parseInt(e.target.value, 10) || 0)) })}
              className="h-10 w-20 rounded-full border border-line bg-background px-3 text-center"
            />
          </label>

          {summary.amount > 0 && (
            <p className="rounded-2xl bg-background p-3 text-sm">
              Cuota de <b className="num">{formatCurrency(summary.installment)}</b> · pagas{' '}
              <b className="num text-coral-text">{formatCurrency(summary.extraCost)} extra</b>
              {summary.cae != null && <> · CAE {pct(summary.cae)}</>}
            </p>
          )}
        </div>
      )}
    </section>
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

/** Mes a mes: cuotas, devolución a terceros y reposición de ahorros */
function Schedule({ result, thirdPartyName }: { result: PlanResult; thirdPartyName: string }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? result.schedule : result.schedule.slice(0, 6);
  const cols = [
    result.loanAmount + result.advance.amount > 0 && { key: 'loanPayment' as const, label: 'Cuotas' },
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
