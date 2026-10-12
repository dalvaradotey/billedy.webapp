'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, ArrowDownToLine, ArrowUpFromLine, Pencil, MoveRight, Archive, Users, PiggyBank } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { SwitchCard } from '@/components/switch-card';
import { CurrencyInput } from '@/components/currency-input';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  ResponsiveDrawer,
} from '@/components/ui/drawer';
import { cardStyles } from '@/components/card-styles';
import { formatCurrency } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import {
  allocateToFund,
  archiveFund,
  createFund,
  moveFund,
  releaseFromFund,
  updateFund,
} from '../fund-actions';
import type { AccountFund } from '../lib/funds';

interface AccountFundsSectionProps {
  projectId: string;
  userId: string;
  accountId: string;
  accountBalance: number;
  funds: AccountFund[];
  /** Cuentas a las que se puede mover un fondo */
  moveTargets: Array<{ id: string; name: string }>;
}

type Mode =
  | { kind: 'create' }
  | { kind: 'edit'; fund: AccountFund }
  | { kind: 'allocate'; fund: AccountFund }
  | { kind: 'release'; fund: AccountFund }
  | { kind: 'move'; fund: AccountFund };

/**
 * Fondos dentro de una cuenta: "sobres" que solo existen en la app.
 * Libre = saldo de la cuenta − fondos.
 */
export function AccountFundsSection({
  projectId,
  userId,
  accountId,
  accountBalance,
  funds,
  moveTargets,
}: AccountFundsSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode | null>(null);
  const [actionsFund, setActionsFund] = useState<AccountFund | null>(null);

  // Formularios
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [target, setTarget] = useState<number | undefined>(undefined);
  const [isThirdParty, setIsThirdParty] = useState(false);
  const [notes, setNotes] = useState('');
  const [moveTo, setMoveTo] = useState<string | null>(null);

  const fundsTotal = funds.reduce((acc, f) => acc + f.balance, 0);
  const free = accountBalance - fundsTotal;

  const open = (next: Mode) => {
    setActionsFund(null);
    setName(next.kind === 'edit' ? next.fund.name : '');
    setTarget(next.kind === 'edit' ? (next.fund.targetAmount ?? undefined) : undefined);
    setAmount(undefined);
    setIsThirdParty(false);
    setNotes('');
    setMoveTo(null);
    setMode(next);
  };

  const run = (label: string, action: () => Promise<{ success: boolean; error?: string }>, done: string) => {
    const toastId = toast.loading(label);
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        toast.success(done, { id: toastId });
        setMode(null);
        router.refresh();
      } else {
        toast.error(result.error ?? 'Error', { id: toastId });
      }
    });
  };

  const submit = () => {
    if (!mode) return;
    switch (mode.kind) {
      case 'create':
        return run(
          'Creando fondo...',
          () => createFund(userId, { projectId, accountId, name, initialAmount: amount, targetAmount: target ?? null, isThirdParty }),
          'Fondo creado'
        );
      case 'edit':
        return run('Guardando...', () => updateFund(userId, mode.fund.id, { name, targetAmount: target ?? null }), 'Fondo actualizado');
      case 'allocate':
        return run('Apartando...', () => allocateToFund(userId, mode.fund.id, amount ?? 0, notes), `Apartaste ${formatCurrency(amount ?? 0)}`);
      case 'release':
        return run('Liberando...', () => releaseFromFund(userId, mode.fund.id, amount ?? 0, notes), `Liberaste ${formatCurrency(amount ?? 0)}`);
      case 'move':
        return run('Moviendo fondo...', () => moveFund(userId, mode.fund.id, moveTo ?? ''), 'Fondo movido');
    }
  };

  const handleArchive = (fund: AccountFund) => {
    setActionsFund(null);
    run('Archivando...', () => archiveFund(userId, fund.id, true), 'Fondo archivado');
  };

  const canSubmit =
    !isPending &&
    (mode?.kind === 'create'
      ? name.trim().length > 0
      : mode?.kind === 'edit'
        ? name.trim().length > 0
        : mode?.kind === 'move'
          ? !!moveTo
          : (amount ?? 0) > 0);

  const titles: Record<Mode['kind'], string> = {
    create: 'Nuevo fondo',
    edit: 'Editar fondo',
    allocate: 'Apartar en el fondo',
    release: 'Liberar del fondo',
    move: 'Mover fondo a otra cuenta',
  };

  return (
    <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
      {funds.length > 0 && (
        <div className="rounded-xl bg-muted/40 dark:bg-muted/20 p-3 space-y-2.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">Libre</span>
            <span className={cn('font-bold tabular-nums', free >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
              {formatCurrency(free)}
            </span>
          </div>
          {funds.map((fund) => {
            const percent = fund.targetAmount ? Math.min(100, Math.round((fund.balance / fund.targetAmount) * 100)) : null;
            return (
              <button
                key={fund.id}
                type="button"
                onClick={() => setActionsFund(fund)}
                className="block w-full min-h-11 rounded-lg px-2 py-1.5 text-left hover:bg-muted active:bg-muted"
              >
                <span className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {fund.isThirdParty ? (
                      <Users className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                    ) : (
                      <PiggyBank className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{fund.name}</span>
                    {fund.isThirdParty && (
                      <span className="shrink-0 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                        De terceros
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(fund.balance)}</span>
                </span>
                {percent != null && (
                  <span className="mt-1 flex items-center gap-2">
                    <Progress value={percent} className="h-1.5 flex-1" />
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {percent}% de {formatCurrency(fund.targetAmount!)}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 gap-1.5 px-2 text-muted-foreground"
        onClick={() => open({ kind: 'create' })}
      >
        <Plus className="h-4 w-4" />
        {funds.length > 0 ? 'Nuevo fondo' : 'Dividir en fondos'}
      </Button>

      {/* Acciones de un fondo */}
      <Drawer open={!!actionsFund} onOpenChange={(o) => !o && setActionsFund(null)}>
        <DrawerContent>
          {actionsFund && (
            <>
              <DrawerHeader className="text-left pb-2">
                <DrawerTitle>{actionsFund.name}</DrawerTitle>
                <DrawerDescription>
                  Saldo {formatCurrency(actionsFund.balance)}
                  {actionsFund.targetAmount ? ` de ${formatCurrency(actionsFund.targetAmount)}` : ''}
                  {actionsFund.isThirdParty ? ' · de terceros' : ''}
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-2 pb-2">
                {[
                  { key: 'allocate', label: 'Apartar', icon: <ArrowDownToLine />, onClick: () => open({ kind: 'allocate', fund: actionsFund }) },
                  { key: 'release', label: 'Liberar', icon: <ArrowUpFromLine />, onClick: () => open({ kind: 'release', fund: actionsFund }) },
                  { key: 'edit', label: 'Editar nombre o meta', icon: <Pencil />, onClick: () => open({ kind: 'edit', fund: actionsFund }) },
                  ...(moveTargets.length > 0
                    ? [{ key: 'move', label: 'Mover a otra cuenta', icon: <MoveRight />, onClick: () => open({ kind: 'move', fund: actionsFund }) }]
                    : []),
                  ...(actionsFund.balance === 0
                    ? [{ key: 'archive', label: 'Archivar', icon: <Archive />, onClick: () => handleArchive(actionsFund) }]
                    : []),
                ].map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    disabled={isPending}
                    onClick={action.onClick}
                    className={cn(cardStyles.drawerAction, 'active:bg-muted')}
                  >
                    <div className={cn(cardStyles.drawerActionIconBox, 'bg-muted')}>
                      <span className="text-muted-foreground [&>svg]:h-5 [&>svg]:w-5">{action.icon}</span>
                    </div>
                    <span className="text-base font-medium">{action.label}</span>
                  </button>
                ))}
              </div>
              <div className="px-4 pb-4 pt-2 border-t">
                <DrawerClose asChild>
                  <button className={cardStyles.drawerCancelButton}>Cancelar</button>
                </DrawerClose>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Formularios */}
      <ResponsiveDrawer open={!!mode} onOpenChange={(o) => !o && setMode(null)}>
        <DrawerContent>
          {mode && (
            <div className="mx-auto w-full max-w-lg">
              <DrawerHeader>
                <DrawerTitle>{titles[mode.kind]}</DrawerTitle>
                <DrawerDescription>
                  {mode.kind === 'release'
                    ? `Vuelve a quedar libre en la cuenta. El fondo tiene ${formatCurrency(mode.fund.balance)}.`
                    : mode.kind === 'move'
                      ? 'Registra la transferencia del banco por separado; esto solo cambia la cuenta del fondo.'
                      : `Libre en la cuenta: ${formatCurrency(free)}.`}
                </DrawerDescription>
              </DrawerHeader>

              <div className="space-y-4 px-4 pb-4">
                {(mode.kind === 'create' || mode.kind === 'edit') && (
                  <>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nombre (ej: Mantención de campo)"
                      className="h-12"
                      autoFocus
                    />
                    {mode.kind === 'create' && (
                      <div className="space-y-1">
                        <CurrencyInput value={amount} onChange={setAmount} label="Saldo inicial (opcional)" placeholder="0" />
                        <p className="text-xs text-muted-foreground">
                          Plata que ya tienes apartada. No cuenta como ahorro de este ciclo.
                        </p>
                      </div>
                    )}
                    <CurrencyInput value={target} onChange={setTarget} label="Meta (opcional)" placeholder="0" />
                    {mode.kind === 'create' && (
                      <SwitchCard
                        title="Dinero de terceros"
                        description="Plata de otra persona guardada en tu cuenta. Se ve, pero no cuenta como tuya ni como ahorro."
                        checked={isThirdParty}
                        onCheckedChange={setIsThirdParty}
                      />
                    )}
                  </>
                )}

                {(mode.kind === 'allocate' || mode.kind === 'release') && (
                  <>
                    <CurrencyInput value={amount} onChange={setAmount} label="Monto" placeholder="0" autoFocus />
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Nota (opcional)"
                      className="h-12"
                    />
                    {mode.kind === 'allocate' && !mode.fund.isThirdParty && (
                      <p className="text-xs text-muted-foreground">
                        En una cuenta corriente, apartar cuenta como ahorro del ciclo.
                      </p>
                    )}
                  </>
                )}

                {mode.kind === 'move' && (
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cuenta de destino">
                    {moveTargets.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        role="radio"
                        aria-checked={moveTo === account.id}
                        onClick={() => setMoveTo(account.id)}
                        className={cn(
                          'min-h-11 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                          moveTo === account.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {account.name}
                      </button>
                    ))}
                  </div>
                )}

                <DrawerFooter className="px-0 pt-2">
                  <Button onClick={submit} disabled={!canSubmit} className="h-12 w-full">
                    {isPending ? 'Guardando...' : titles[mode.kind]}
                  </Button>
                </DrawerFooter>
              </div>
            </div>
          )}
        </DrawerContent>
      </ResponsiveDrawer>
    </div>
  );
}
