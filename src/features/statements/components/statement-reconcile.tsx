'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, ChevronDown, FileUp, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatting';
import { analyzeStatement, applyReconciliation, type StatementReview } from '../actions';

type BudgetOption = { id: string; name: string; categoryId: string | null };

interface StatementReconcileProps {
  userId: string;
  projectId: string;
  budgets: BudgetOption[];
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const short = (iso: string | null) => {
  if (!iso) return '—';
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]}`;
};
const money = (n: number) => (n < 0 ? `−${formatCurrency(-n)}` : formatCurrency(n));

/**
 * Conciliación de la tarjeta con el estado de cuenta: sube el PDF, revisa solo
 * las diferencias y concilia todo con un botón.
 */
export function StatementReconcile({ userId, projectId, budgets }: StatementReconcileProps) {
  const [isPending, startTransition] = useTransition();
  const [review, setReview] = useState<StatementReview | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Decisiones del usuario sobre las diferencias
  const [createDrafts, setCreateDrafts] = useState<Record<number, { on: boolean; description: string; budgetId: string }>>({});
  const [fixOn, setFixOn] = useState<Record<string, boolean>>({});
  const [templateOn, setTemplateOn] = useState<Record<string, boolean>>({});
  const [showMatched, setShowMatched] = useState(false);

  const upload = (file: File) => {
    const form = new FormData();
    form.set('file', file);
    setDone(null);
    startTransition(async () => {
      const result = await analyzeStatement(userId, projectId, form);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const r = result.data.result;
      setReview(result.data);
      setCreateDrafts(
        Object.fromEntries(
          r.missing.map((m) => [
            m.line.index,
            { on: m.line.kind !== 'installment', description: m.suggestion?.description ?? m.line.description, budgetId: m.suggestion?.budgetId ?? '' },
          ])
        )
      );
      setFixOn(Object.fromEntries(r.amountDiffs.map((d) => [d.tx.id, true])));
      setTemplateOn(Object.fromEntries(r.templateDrift.map((t) => [t.item.id, false])));
      setShowMatched(false);
    });
  };

  const counts = useMemo(() => {
    if (!review) return null;
    const r = review.result;
    return {
      matched: r.matched.length,
      pendingReconcile: r.matched.filter((m) => !m.tx.isReconciled).length,
      missing: r.missing.length,
      diffs: r.amountDiffs.length,
      extra: r.extra.length,
    };
  }, [review]);

  const apply = () => {
    if (!review) return;
    const r = review.result;
    const reconcileIds = [...r.matched.map((m) => m.tx.id), ...r.amountDiffs.filter((d) => fixOn[d.tx.id]).map((d) => d.tx.id)];
    const create = r.missing
      .filter((m) => createDrafts[m.line.index]?.on && m.line.kind !== 'installment')
      .map((m) => {
        const draft = createDrafts[m.line.index];
        const budget = budgets.find((b) => b.id === draft.budgetId);
        return {
          lineIndex: m.line.index,
          description: draft.description,
          budgetId: budget?.id ?? null,
          categoryId: budget?.categoryId ?? m.suggestion?.categoryId ?? null,
          nature: m.suggestion?.nature ?? 'own',
        };
      });
    const amountFixes = r.amountDiffs.filter((d) => fixOn[d.tx.id]).map((d) => ({ txId: d.tx.id, amount: Math.abs(d.line.amount) }));
    const templateUpdates = r.templateDrift.filter((t) => templateOn[t.item.id]).map((t) => ({ itemId: t.item.id, amount: t.amount }));

    startTransition(async () => {
      const result = await applyReconciliation(userId, review.statementId, { reconcileIds, create, amountFixes, templateUpdates });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const d = result.data;
      const parts = [
        `${d.reconciled} conciliados`,
        d.created ? `${d.created} creados` : null,
        d.fixed ? `${d.fixed} montos corregidos` : null,
        d.templates ? `${d.templates} ítems de plantilla actualizados` : null,
      ].filter(Boolean);
      setDone(parts.join(' · '));
      setReview(null);
      toast.success('Estado de cuenta conciliado');
    });
  };

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = '';
        }}
      />

      {!review && (
        <section className="rounded-[22px] border border-dashed border-line-strong bg-surface p-5 text-center">
          {done ? (
            <>
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-jade-soft text-jade">
                <Check className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-extrabold">Listo</p>
              <p className="mt-1 text-xs text-muted-foreground">{done}</p>
            </>
          ) : (
            <>
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-sky-soft text-sky">
                <FileUp className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-extrabold">Sube el estado de cuenta en PDF</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                El que descargas del banco. Lo cruzo con tus movimientos y te muestro solo lo que no calza. El PDF no se guarda.
              </p>
            </>
          )}
          <Button variant={done ? 'outline' : 'cta'} className="mt-4 w-full" disabled={isPending} onClick={() => inputRef.current?.click()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {isPending ? 'Leyendo…' : done ? 'Subir otro' : 'Elegir PDF'}
          </Button>
        </section>
      )}

      {review && counts && (
        <>
          {/* Encabezado del estado de cuenta */}
          <section className="rounded-[22px] border border-line bg-surface p-4 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">{review.account.name}</p>
                <p className="text-xs text-muted-foreground">
                  {short(review.statement.periodStart)} – {short(review.statement.periodEnd)} · vence {short(review.statement.dueDate)}
                </p>
              </div>
              <div className="text-right">
                <p className="num text-xl font-extrabold">{formatCurrency(review.statement.totalBilled)}</p>
                <p className={cn('text-[11px] font-bold', review.statement.balanced ? 'text-jade' : 'text-amber')}>
                  {review.statement.balanced ? 'las líneas cuadran con el total' : 'las líneas no suman el total'}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip tone="jade">{counts.matched} calzan</Chip>
              {counts.missing > 0 && <Chip tone="coral">{counts.missing} faltan en la app</Chip>}
              {counts.diffs > 0 && <Chip tone="amber">{counts.diffs} con otro monto</Chip>}
              {counts.extra > 0 && <Chip tone="sky">{counts.extra} solo en la app</Chip>}
            </div>
            {review.alreadyReconciled && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5" /> Este estado de cuenta ya se había conciliado; puedes repetirlo sin problema.
              </p>
            )}
          </section>

          {/* Faltan en la app */}
          {review.result.missing.length > 0 && (
            <Section title="Faltan en la app" hint="Se crean como gasto pagado y conciliado. Ajusta el nombre o el presupuesto si quieres.">
              {review.result.missing.map((m) => {
                const draft = createDrafts[m.line.index];
                const isInstallment = m.line.kind === 'installment';
                return (
                  <li key={m.line.index} className="space-y-2 py-3">
                    <div className="flex items-start gap-3">
                      {!isInstallment && (
                        <input
                          type="checkbox"
                          checked={draft?.on ?? false}
                          onChange={(e) => setCreateDrafts((s) => ({ ...s, [m.line.index]: { ...s[m.line.index], on: e.target.checked } }))}
                          className="mt-1 h-5 w-5 accent-[#5CC3A4]"
                          aria-label={`Crear ${m.line.description}`}
                        />
                      )}
                      <LineInfo line={m.line} />
                    </div>
                    {isInstallment ? (
                      <p className="flex items-start gap-1.5 text-xs text-amber-text">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Cuota {m.line.installment?.number}/{m.line.installment?.total} sin registrar: créala como compra en cuotas para que la app siga las que vienen.
                      </p>
                    ) : (
                      draft?.on && (
                        <div className="grid gap-2 pl-8 sm:grid-cols-2">
                          <input
                            value={draft.description}
                            onChange={(e) =>
                              setCreateDrafts((s) => ({ ...s, [m.line.index]: { ...s[m.line.index], description: e.target.value } }))
                            }
                            className="h-11 rounded-xl border border-line bg-background px-3 text-sm font-semibold outline-none focus:border-jade"
                            aria-label="Descripción"
                          />
                          {m.line.amount > 0 && (
                            <select
                              value={draft.budgetId}
                              onChange={(e) =>
                                setCreateDrafts((s) => ({ ...s, [m.line.index]: { ...s[m.line.index], budgetId: e.target.value } }))
                              }
                              className="h-11 rounded-xl border border-line bg-background px-3 text-sm outline-none focus:border-jade"
                              aria-label="Presupuesto"
                            >
                              <option value="">Sin presupuesto</option>
                              {budgets.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )
                    )}
                  </li>
                );
              })}
            </Section>
          )}

          {/* Monto distinto */}
          {review.result.amountDiffs.length > 0 && (
            <Section title="Con otro monto" hint="Mismo cargo, pero el banco cobró distinto (típico en suscripciones en dólares).">
              {review.result.amountDiffs.map((d) => (
                <li key={d.tx.id} className="flex items-start gap-3 py-3">
                  <input
                    type="checkbox"
                    checked={fixOn[d.tx.id] ?? false}
                    onChange={(e) => setFixOn((s) => ({ ...s, [d.tx.id]: e.target.checked }))}
                    className="mt-1 h-5 w-5 accent-[#5CC3A4]"
                    aria-label={`Corregir ${d.tx.description}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{d.tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.line.description} · {short(d.line.date)}
                    </p>
                  </div>
                  <p className="num shrink-0 text-right text-sm">
                    <span className="text-muted-foreground line-through">{formatCurrency(d.tx.amount)}</span>
                    <span className="block font-extrabold">{money(d.line.amount)}</span>
                  </p>
                </li>
              ))}
            </Section>
          )}

          {/* Solo en la app */}
          {review.result.extra.length > 0 && (
            <Section title="Solo en la app" hint="No aparecen en este estado de cuenta: puede que se facturen el próximo, que estén en otra tarjeta o que estén repetidos.">
              {review.result.extra.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">{short(tx.date)}</p>
                  </div>
                  <p className="num shrink-0 text-sm font-extrabold">{money(tx.type === 'income' ? -tx.amount : tx.amount)}</p>
                </li>
              ))}
            </Section>
          )}

          {/* Plantilla desactualizada */}
          {review.result.templateDrift.length > 0 && (
            <Section title="Plantilla con otro monto" hint="Actualízala para que lo comprometido de cada mes calce con lo que de verdad te cobran.">
              {review.result.templateDrift.map((t) => (
                <li key={t.item.id} className="flex items-center gap-3 py-3">
                  <input
                    type="checkbox"
                    checked={templateOn[t.item.id] ?? false}
                    onChange={(e) => setTemplateOn((s) => ({ ...s, [t.item.id]: e.target.checked }))}
                    className="h-5 w-5 accent-[#5CC3A4]"
                    aria-label={`Actualizar ${t.item.description}`}
                  />
                  <p className="min-w-0 flex-1 truncate text-sm font-bold">{t.item.description}</p>
                  <p className="num shrink-0 text-sm">
                    <span className="text-muted-foreground">{formatCurrency(t.item.amount)}</span> → <b>{formatCurrency(t.amount)}</b>
                  </p>
                </li>
              ))}
            </Section>
          )}

          {/* Lo que calza */}
          <section className="rounded-[22px] border border-line bg-surface">
            <button
              type="button"
              onClick={() => setShowMatched((v) => !v)}
              aria-expanded={showMatched}
              className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left md:px-5"
            >
              <span>
                <span className="block text-sm font-extrabold">{counts.matched} calzan</span>
                <span className="text-xs text-muted-foreground">
                  {counts.pendingReconcile > 0 ? `${counts.pendingReconcile} quedan conciliados al confirmar` : 'ya estaban conciliados'}
                </span>
              </span>
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', showMatched && 'rotate-180')} />
            </button>
            {showMatched && (
              <ul className="divide-y divide-line border-t border-line px-4 md:px-5">
                {review.result.matched.map(({ line, tx, dateGap }) => (
                  <li key={line.index} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold">{tx.description}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {line.description}
                        {line.card !== review.statement.card ? ` · adicional ${line.card}` : ''}
                        {dateGap > 0 ? ` · ${dateGap} día${dateGap > 1 ? 's' : ''} de diferencia` : ''}
                      </p>
                    </div>
                    <p className="num shrink-0 text-[13px] font-extrabold">{money(line.amount)}</p>
                    {tx.isReconciled && <Check className="h-4 w-4 shrink-0 text-jade" aria-label="Ya conciliado" />}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Button variant="cta" disabled={isPending} onClick={apply}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Conciliar
            </Button>
            <Button variant="outline" disabled={isPending} onClick={() => setReview(null)}>
              Cancelar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ tone, children }: { tone: 'jade' | 'coral' | 'amber' | 'sky'; children: React.ReactNode }) {
  const tones = {
    jade: 'bg-jade-soft text-jade-text',
    coral: 'bg-coral-soft text-coral-text',
    amber: 'bg-amber-soft text-amber-text',
    sky: 'bg-sky-soft text-sky-text',
  };
  return <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', tones[tone])}>{children}</span>;
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border border-line bg-surface px-4 pt-4 md:px-5">
      <p className="text-sm font-extrabold">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      <ul className="mt-1 divide-y divide-line">{children}</ul>
    </section>
  );
}

function LineInfo({ line }: { line: StatementReview['result']['missing'][number]['line'] }) {
  return (
    <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{line.description}</p>
        <p className="text-xs text-muted-foreground">
          {short(line.date)} · tarjeta {line.card}
        </p>
      </div>
      <p className="num shrink-0 text-sm font-extrabold">{money(line.amount)}</p>
    </div>
  );
}

