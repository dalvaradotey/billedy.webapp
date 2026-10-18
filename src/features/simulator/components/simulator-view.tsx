'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sparkles, Trash2 } from 'lucide-react';
import { CurrencyInput } from '@/components/currency-input';
import { formatCurrency, formatDateLong } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import { buildOptions, type OptionId, type PlanInput, type SimulatorData } from '../lib/plan';
import type { SavedSimulation } from '../queries';
import { deleteSimulation, saveSimulation } from '../actions';
import { OptionCard } from './option-card';
import { PlanBuilder } from './plan-builder';

interface SimulatorViewProps {
  userId: string;
  projectId: string;
  data: SimulatorData;
  saved: SavedSimulation[];
}

/**
 * "¿Me alcanza?": dos preguntas (qué y cuánto), las opciones para juntarlo y,
 * al elegir una, el plan para ajustar de dónde sale y cómo se repone.
 */
export function SimulatorView({ userId, projectId, data, saved }: SimulatorViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [target, setTarget] = useState<number | undefined>(undefined);
  const [plan, setPlan] = useState<(PlanInput & { optionId?: OptionId }) | null>(null);
  const planRef = useRef<HTMLDivElement>(null);

  const built = useMemo(() => (target && target > 0 ? buildOptions(name, target, data) : null), [name, target, data]);

  const openPlan = (next: PlanInput & { optionId?: OptionId }) => {
    setPlan(next);
    requestAnimationFrame(() => planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const handleSave = () => {
    if (!plan) return;
    startTransition(async () => {
      const result = await saveSimulation(userId, projectId, { name: name.trim() || 'Sin nombre', plan });
      if (result.success) {
        toast.success('Simulación guardada');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteSimulation(userId, projectId, id);
      if (result.success) router.refresh();
      else toast.error(result.error);
    });
  };

  return (
    <div className="space-y-5">
      {/* Las dos preguntas */}
      <section className="rounded-[26px] border border-line bg-surface p-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="¿Para qué es? (ej: Maquinaria terreno)"
          enterKeyHint="next"
          className="h-12 w-full rounded-2xl border border-line bg-background px-4 text-base outline-none focus:border-jade"
        />
        <div className="mt-2">
          <CurrencyInput size="hero" label="¿Cuánto necesitas?" value={target} onChange={(v) => setTarget(v)} />
        </div>
      </section>

      {/* Opciones */}
      {built && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-extrabold tracking-[-0.02em]">Tus opciones</h2>
            <p className="text-sm text-muted-foreground">
              {built.earmarked ? (
                <>
                  Ya tienes <b className="text-foreground">{formatCurrency(Math.min(built.earmarked.available, target!))}</b> apartados en “
                  {built.earmarked.name}”, así que te faltan <b className="text-foreground">{formatCurrency(built.rest)}</b>.
                </>
              ) : (
                <>Te faltan {formatCurrency(built.rest)}. Así puedes juntarlos:</>
              )}
            </p>
          </div>
          {built.rest === 0 ? (
            <p className="rounded-[22px] border border-jade bg-jade-soft p-4 text-sm text-jade-text">
              Ya lo tienes apartado completo. No necesitas sacar nada más.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {built.options.map((o, i) => (
                <OptionCard key={o.id} option={o} index={i} onChoose={() => openPlan({ ...o.plan, optionId: o.id })} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Armar el plan */}
      {plan && target && (
        <section ref={planRef} className="scroll-mt-20 space-y-3">
          <h2 className="text-lg font-extrabold tracking-[-0.02em]">Arma tu plan</h2>
          <PlanBuilder
            name={name}
            plan={{ ...plan, target }}
            sources={data.sources}
            monthlySaving={data.monthlySaving}
            onChange={(next) => setPlan({ ...next, optionId: plan.optionId })}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="flex min-h-12 w-full items-center justify-center rounded-full bg-jade text-sm font-extrabold text-jade-ink disabled:opacity-50"
          >
            Guardar simulación
          </button>
        </section>
      )}

      {/* Guardadas */}
      {saved.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-lg font-extrabold tracking-[-0.02em]">Simulaciones guardadas</h2>
          <ul className="space-y-2">
            {saved.map((s) => (
              <li key={s.id} className={cn('rounded-[22px] border bg-surface p-3.5', s.source === 'claude' ? 'border-violet' : 'border-line')}>
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setName(s.name);
                      setTarget(s.target);
                      openPlan({ ...s.plan, target: s.target, optionId: s.plan.optionId as OptionId | undefined });
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold">{s.name}</span>
                      {s.source === 'claude' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-soft px-2 py-0.5 text-[11px] font-bold text-violet-text">
                          <Sparkles className="h-3 w-3" />
                          Propuesto por Claude
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatCurrency(s.target)} · {formatDateLong(s.createdAt)}
                    </span>
                    {s.note && <span className="mt-1.5 block text-sm text-muted-foreground">{s.note}</span>}
                  </button>
                  <button
                    type="button"
                    aria-label={`Borrar ${s.name}`}
                    onClick={() => handleDelete(s.id)}
                    disabled={isPending}
                    className="-mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-coral-text"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
