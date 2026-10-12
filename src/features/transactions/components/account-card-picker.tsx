'use client';

import { useEffect, useRef } from 'react';
import { AccountPickCard } from '@/features/accounts/components/wallet-card';
import type { AccountWithEntity } from '@/features/accounts/types';

interface AccountCardPickerProps {
  label: string;
  accounts: AccountWithEntity[];
  value: string;
  onChange: (accountId: string) => void;
  invalid?: boolean;
}

/** "¿Con qué pagas?": las cuentas como mini tarjetas en una fila deslizable. */
export function AccountCardPicker({ label, accounts, value, onChange, invalid }: AccountCardPickerProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  // La cuenta elegida siempre a la vista (p. ej. al completar desde una sugerencia)
  useEffect(() => {
    const row = rowRef.current;
    const selected = row?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!row || !selected) return;
    const r = row.getBoundingClientRect();
    const c = selected.getBoundingClientRect();
    if (c.left < r.left + 16 || c.right > r.right - 16) {
      row.scrollBy({ left: c.left - r.left - 16, behavior: 'smooth' });
    }
  }, [value]);

  return (
    <fieldset className="min-w-0">
      <legend className={invalid ? 'mb-2 text-[13px] font-extrabold text-coral-text' : 'mb-2 text-[13px] font-extrabold'}>{label}</legend>
      <div
        ref={rowRef}
        role="radiogroup"
        aria-label={label}
        data-vaul-no-drag
        className="scrollbar-hide -mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 py-1"
      >
        {accounts.map((account) => (
          <AccountPickCard
            key={account.id}
            account={account}
            selected={account.id === value}
            onSelect={() => onChange(account.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}
