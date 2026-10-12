'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollRow } from '@/components/ui/scroll-row';
import { AccountPickCard } from '@/features/accounts/components/wallet-card';
import type { AccountWithEntity } from '@/features/accounts/types';

interface AccountCardPickerProps {
  label: string;
  accounts: AccountWithEntity[];
  value: string;
  onChange: (accountId: string) => void;
  invalid?: boolean;
}

/**
 * "¿Con qué pagas?": las cuentas como mini tarjetas en una fila deslizable.
 * La elegida va primero; si cambia desde afuera (presupuesto, sugerencia) pasa
 * al frente. Si la toca el usuario se queda en su lugar para que nada salte.
 */
export function AccountCardPicker({ label, accounts, value, onChange, invalid }: AccountCardPickerProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [frontId, setFrontId] = useState(value);
  const [tappedId, setTappedId] = useState<string | null>(null);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value !== tappedId) setFrontId(value);
  }

  useEffect(() => {
    rowRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, [frontId]);

  const ordered = useMemo(() => {
    const front = accounts.find((a) => a.id === frontId);
    return front ? [front, ...accounts.filter((a) => a.id !== frontId)] : accounts;
  }, [accounts, frontId]);

  return (
    <fieldset className="min-w-0">
      <legend className={invalid ? 'mb-2 text-[13px] font-extrabold text-coral-text' : 'mb-2 text-[13px] font-extrabold'}>{label}</legend>
      <ScrollRow
        scrollRef={rowRef}
        role="radiogroup"
        aria-label={label}
        data-vaul-no-drag
        className="-mx-4 flex snap-x scroll-px-4 gap-2 px-4 py-1"
      >
        {ordered.map((account) => (
          <AccountPickCard
            key={account.id}
            account={account}
            selected={account.id === value}
            onSelect={() => {
              setTappedId(account.id);
              onChange(account.id);
            }}
          />
        ))}
      </ScrollRow>
    </fieldset>
  );
}
