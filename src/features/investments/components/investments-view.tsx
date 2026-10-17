'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Link2, Plus, Search, TrendingUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, ResponsiveDrawer } from '@/components/ui/drawer';
import { EmptyState } from '@/components/empty-state';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatting';
import {
  createInvestment,
  deleteInvestment,
  fetchInvestments,
  linkMovements,
  searchLinkCandidates,
  unlinkMovement,
  updateInvestment,
  type InvestmentRole,
  type InvestmentSummary,
  type LinkCandidate,
} from '../actions';
import { MONTHS_SHORT as MONTHS } from '@/lib/dates';

const short = (iso: string) => `${parseInt(iso.slice(8, 10), 10)} ${MONTHS[parseInt(iso.slice(5, 7), 10) - 1]} ${iso.slice(2, 4)}`;
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatCurrency(Math.abs(n))}`;

const ROLE_LABEL: Record<InvestmentRole, string> = { aporte: 'Aporte', costo: 'Costo', retorno: 'Ingreso' };
const ROLE_CLASS: Record<InvestmentRole, string> = {
  aporte: 'bg-violet-soft text-violet-text',
  costo: 'bg-coral-soft text-coral-text',
  retorno: 'bg-jade-soft text-jade-text',
};

/** % recuperado: retorno neto sobre lo invertido (sin aporte, no aplica) */
const recovered = (inv: InvestmentSummary) => (inv.invested > 0 ? Math.round((inv.netReturn / inv.invested) * 100) : null);

export function InvestmentsView({ userId, projectId }: { userId: string; projectId: string }) {
  const [isPending, startTransition] = useTransition();
  const [list, setList] = useState<InvestmentSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; name: string; notes: string; startedAt: string } | null>(null);
  const [linking, setLinking] = useState(false);

  const load = useCallback(async () => {
    const result = await fetchInvestments(userId, projectId);
    if (result.success) setList(result.data);
    else toast.error(result.error);
  }, [userId, projectId]);

  useEffect(() => {
    let active = true;
    fetchInvestments(userId, projectId).then((result) => {
      if (active && result.success) setList(result.data);
    });
    return () => {
      active = false;
    };
  }, [userId, projectId]);

  const selected = list?.find((i) => i.id === selectedId) ?? null;

  const save = () => {
    if (!editing) return;
    const input = { name: editing.name, notes: editing.notes || null, startedAt: editing.startedAt || null };
    startTransition(async () => {
      const result = editing.id ? await updateInvestment(userId, editing.id, input) : await createInvestment(userId, projectId, input);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setEditing(null);
      await load();
    });
  };

  const totals = useMemo(() => {
    const all = list ?? [];
    return {
      invested: all.reduce((a, i) => a + i.invested, 0),
      netReturn: all.reduce((a, i) => a + i.netReturn, 0),
    };
  }, [list]);

  if (list === null) return <div className="h-40 animate-skeleton rounded-[22px] bg-surface" />;

  return (
    <div className="space-y-4">
      {list.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Sin inversiones"
          description="Crea una (por ejemplo, Ostras) y asóciale lo que pusiste y lo que te ha retornado."
        />
      ) : (
        <>
          <section className="grid grid-cols-3 gap-2 rounded-[22px] border border-line bg-surface p-4">
            <Stat label="Invertido" value={formatCurrency(totals.invested)} />
            <Stat label="Retorno neto" value={formatCurrency(totals.netReturn)} />
            <Stat
              label="Resultado"
              value={signed(totals.netReturn - totals.invested)}
              tone={totals.netReturn - totals.invested >= 0 ? 'text-jade' : 'text-coral-text'}
            />
          </section>

          <ul className="space-y-2">
            {list.map((inv) => {
              const pct = recovered(inv);
              return (
                <li key={inv.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(inv.id)}
                    className="w-full rounded-[22px] border border-line bg-surface p-4 text-left transition-colors hover:bg-surface-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-base font-extrabold">{inv.name}</p>
                      {inv.closedAt && <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">cerrada</span>}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <Stat label="Invertido" value={formatCurrency(inv.invested)} />
                      <Stat label="Retorno neto" value={formatCurrency(inv.netReturn)} />
                      <Stat label="Resultado" value={signed(inv.result)} tone={inv.result >= 0 ? 'text-jade' : 'text-coral-text'} />
                    </div>
                    {pct != null && (
                      <div className="mt-3">
                        <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-surface-3">
                          <span className={cn('block h-1.5 rounded-full', pct >= 100 ? 'bg-jade' : 'bg-amber')} style={{ width: `${Math.min(100, pct)}%` }} />
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">Recuperaste el {pct}% de lo invertido</span>
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Button variant="cta" className="w-full" onClick={() => setEditing({ id: null, name: '', notes: '', startedAt: '' })}>
        <Plus className="h-4 w-4" />
        Nueva inversión
      </Button>

      {/* Detalle */}
      <ResponsiveDrawer open={!!selected && !editing && !linking} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DrawerContent>
          {selected && (
            <div className="mx-auto w-full max-w-lg">
              <DrawerHeader>
                <DrawerTitle>{selected.name}</DrawerTitle>
                <DrawerDescription>
                  {selected.startedAt ? `Desde el ${short(selected.startedAt)}` : 'Inversión'}
                  {selected.closedAt ? ` · cerrada el ${short(selected.closedAt)}` : ''}
                  {selected.notes ? ` · ${selected.notes}` : ''}
                </DrawerDescription>
              </DrawerHeader>
              <div className="space-y-4 px-4 pb-6">
                <dl className="space-y-1.5 rounded-2xl bg-background p-4 text-sm">
                  <Row label="Ingresos" value={formatCurrency(selected.income)} />
                  <Row label="− Costos" value={formatCurrency(selected.costs)} />
                  <Row label="= Retorno neto" value={formatCurrency(selected.netReturn)} strong />
                  <Row label="− Invertido" value={formatCurrency(selected.invested)} />
                  <Row
                    label="= Resultado"
                    value={signed(selected.result)}
                    strong
                    tone={selected.result >= 0 ? 'text-jade' : 'text-coral-text'}
                  />
                </dl>

                <CumulativeChart inv={selected} />

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Movimientos</p>
                  {selected.movements.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">Aún no tiene movimientos asociados.</p>
                  ) : (
                    <ul className="mt-1.5 divide-y divide-line">
                      {selected.movements.map((m) => (
                        <li key={m.id} className="flex items-center gap-2 py-2.5">
                          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold', ROLE_CLASS[m.role])}>{ROLE_LABEL[m.role]}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-bold">{m.description}</span>
                            <span className="block text-[11px] text-muted-foreground">{short(m.date)}</span>
                          </span>
                          <span className="num shrink-0 text-[13px] font-extrabold">{formatCurrency(m.amount)}</span>
                          <button
                            type="button"
                            aria-label="Quitar de la inversión"
                            disabled={isPending}
                            onClick={() =>
                              startTransition(async () => {
                                const r = await unlinkMovement(userId, m.id);
                                if (!r.success) toast.error(r.error);
                                await load();
                              })
                            }
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Button variant="cta" className="w-full" onClick={() => setLinking(true)}>
                  <Link2 className="h-4 w-4" />
                  Asociar movimientos
                </Button>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setEditing({ id: selected.id, name: selected.name, notes: selected.notes ?? '', startedAt: selected.startedAt ?? '' })
                    }
                  >
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await updateInvestment(userId, selected.id, {
                          name: selected.name,
                          notes: selected.notes,
                          startedAt: selected.startedAt,
                          closed: !selected.closedAt,
                        });
                        if (!r.success) toast.error(r.error);
                        await load();
                      })
                    }
                  >
                    {selected.closedAt ? 'Reabrir' : 'Cerrar'}
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-coral-text"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await deleteInvestment(userId, selected.id);
                        if (!r.success) {
                          toast.error(r.error);
                          return;
                        }
                        setSelectedId(null);
                        await load();
                      })
                    }
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DrawerContent>
      </ResponsiveDrawer>

      {/* Crear / editar */}
      <ResponsiveDrawer open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DrawerContent>
          {editing && (
            <div className="mx-auto w-full max-w-lg">
              <DrawerHeader>
                <DrawerTitle>{editing.id ? 'Editar inversión' : 'Nueva inversión'}</DrawerTitle>
                <DrawerDescription>Después le asocias los movimientos: aportes, costos e ingresos.</DrawerDescription>
              </DrawerHeader>
              <div className="space-y-3 px-4 pb-6">
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Nombre (ej: Ostras)"
                  className="h-12 w-full rounded-xl border border-line bg-background px-3 text-base font-bold outline-none focus:border-jade"
                  autoFocus
                />
                <input
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  placeholder="Nota (opcional; ej: proyecto con fondos públicos)"
                  className="h-12 w-full rounded-xl border border-line bg-background px-3 text-sm outline-none focus:border-jade"
                />
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-muted-foreground">Inicio (opcional)</span>
                  <input
                    type="date"
                    value={editing.startedAt}
                    onChange={(e) => setEditing({ ...editing, startedAt: e.target.value })}
                    className="h-12 w-full rounded-xl border border-line bg-background px-3 text-sm outline-none focus:border-jade"
                  />
                </label>
                <Button variant="cta" className="w-full" disabled={isPending || !editing.name.trim()} onClick={save}>
                  Guardar
                </Button>
              </div>
            </div>
          )}
        </DrawerContent>
      </ResponsiveDrawer>

      {/* Asociar movimientos */}
      {selected && (
        <LinkDrawer
          open={linking}
          onClose={async (changed) => {
            setLinking(false);
            if (changed) await load();
          }}
          userId={userId}
          projectId={projectId}
          investment={selected}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <span className={cn('num block truncate text-[15px] font-extrabold', tone)}>{value}</span>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn('text-muted-foreground', strong && 'font-bold text-foreground')}>{label}</dt>
      <dd className={cn('num', strong ? 'font-extrabold' : 'font-medium', tone)}>{value}</dd>
    </div>
  );
}

/** Invertido acumulado contra retorno neto acumulado: donde se cruzan, recuperaste lo puesto */
function CumulativeChart({ inv }: { inv: InvestmentSummary }) {
  if (inv.movements.length < 2) return null;
  const points: { date: string; invested: number; net: number }[] = [];
  for (const m of inv.movements) {
    const prev = points[points.length - 1] ?? { invested: 0, net: 0 };
    points.push({
      date: m.date,
      invested: prev.invested + (m.role === 'aporte' ? m.amount : 0),
      net: prev.net + (m.role === 'retorno' ? m.amount : m.role === 'costo' ? -m.amount : 0),
    });
  }
  const W = 320;
  const H = 110;
  const max = Math.max(1, ...points.map((p) => Math.max(p.invested, p.net)));
  const min = Math.min(0, ...points.map((p) => p.net));
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - 12 - ((v - min) / (max - min)) * (H - 24);
  const line = (key: 'invested' | 'net') => points.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  return (
    <div className="rounded-2xl bg-background p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full overflow-visible" role="img" aria-label="Invertido y retorno neto acumulados">
        <polyline points={line('invested')} fill="none" className="stroke-violet" strokeWidth={2.5} strokeLinejoin="round" />
        <polyline points={line('net')} fill="none" className="stroke-jade" strokeWidth={2.5} strokeLinejoin="round" />
      </svg>
      <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 bg-violet" />invertido</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 bg-jade" />retorno neto</span>
      </div>
    </div>
  );
}

function LinkDrawer({
  open,
  onClose,
  userId,
  projectId,
  investment,
}: {
  open: boolean;
  onClose: (changed: boolean) => void;
  userId: string;
  projectId: string;
  investment: InvestmentSummary;
}) {
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(investment.name);
  const [results, setResults] = useState<LinkCandidate[]>([]);
  const [chosen, setChosen] = useState<Record<string, InvestmentRole>>({});

  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(() => {
      searchLinkCandidates(userId, projectId, query).then((r) => {
        if (active && r.success) setResults(r.data);
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, query, userId, projectId]);

  const toggle = (c: LinkCandidate) =>
    setChosen((s) => {
      const next = { ...s };
      if (next[c.id]) delete next[c.id];
      else next[c.id] = c.type === 'income' ? 'retorno' : 'aporte';
      return next;
    });

  const save = () =>
    startTransition(async () => {
      const links = Object.entries(chosen).map(([transactionId, role]) => ({ transactionId, role }));
      const r = await linkMovements(userId, investment.id, links);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(`${r.data.linked} movimientos asociados a ${investment.name}`);
      setChosen({});
      onClose(true);
    });

  const count = Object.keys(chosen).length;

  return (
    <ResponsiveDrawer open={open} onOpenChange={(o) => !o && onClose(false)}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Asociar a {investment.name}</DrawerTitle>
            <DrawerDescription>Los ingresos cuentan como retorno. En los gastos elige si fue aporte (lo que pusiste) o costo (reduce el retorno).</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 px-4 pb-6">
            <label className="flex items-center gap-2 rounded-xl border border-line bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por descripción"
                className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <ul className="max-h-[45dvh] divide-y divide-line overflow-y-auto">
              {results.map((c) => {
                const role = chosen[c.id];
                return (
                  <li key={c.id} className="py-2.5">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!role}
                        onChange={() => toggle(c)}
                        className="h-5 w-5 shrink-0 accent-[#5CC3A4]"
                        aria-label={`Asociar ${c.description}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold">{c.description}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {short(c.date)}
                          {c.account ? ` · ${c.account}` : ''}
                        </span>
                      </span>
                      <span className={cn('num shrink-0 text-[13px] font-extrabold', c.type === 'income' && 'text-jade')}>
                        {c.type === 'income' ? '+' : '−'}
                        {formatCurrency(c.amount)}
                      </span>
                    </div>
                    {role && c.type === 'expense' && (
                      <div className="mt-2 flex gap-1.5 pl-8">
                        {(['aporte', 'costo'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setChosen((s) => ({ ...s, [c.id]: r }))}
                            className={cn('min-h-8 rounded-full px-3 text-[11px] font-bold', role === r ? ROLE_CLASS[r] : 'bg-surface-3 text-muted-foreground')}
                          >
                            {ROLE_LABEL[r]}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
              {results.length === 0 && <li className="py-4 text-sm text-muted-foreground">No encontré movimientos sin asociar con esa búsqueda.</li>}
            </ul>
            <Button variant="cta" className="w-full" disabled={isPending || count === 0} onClick={save}>
              Asociar {count > 0 ? count : ''}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </ResponsiveDrawer>
  );
}
