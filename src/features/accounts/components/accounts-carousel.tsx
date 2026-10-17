'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { WalletCard } from './wallet-card';
import type { AccountWithEntity } from '../types';

interface AccountsCarouselProps {
  accounts: AccountWithEntity[];
  selectedId: string | null;
  /** Se llama cuando el carrusel se detiene con otra cuenta al centro */
  onSelect: (id: string) => void;
}

/** Espera tras el último scroll para dar por terminado el deslizamiento */
const SETTLE_MS = 120;

/**
 * Carrusel de cuentas (móvil): la tarjeta al centro es la cuenta elegida. Al
 * deslizar, la que queda al centro pasa a foco y, al detenerse, cambia el detalle
 * de abajo; las de los lados quedan atenuadas. Tocar una lateral la centra.
 */
export function AccountsCarousel({ accounts, selectedId, onSelect }: AccountsCarouselProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focusedId, setFocusedId] = useState(selectedId);

  /** Cuenta cuya tarjeta está más cerca del centro del carrusel */
  const centeredId = () => {
    const row = rowRef.current;
    if (!row) return null;
    const center = row.getBoundingClientRect().left + row.clientWidth / 2;
    let best: { id: string; distance: number } | null = null;
    for (const el of row.querySelectorAll<HTMLElement>('[data-account-id]')) {
      const r = el.getBoundingClientRect();
      const distance = Math.abs(r.left + r.width / 2 - center);
      if (!best || distance < best.distance) best = { id: el.dataset.accountId!, distance };
    }
    return best?.id ?? null;
  };

  const handleScroll = () => {
    const id = centeredId();
    if (id) setFocusedId(id);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const settled = centeredId();
      if (settled && settled !== selectedId) onSelect(settled);
    }, SETTLE_MS);
  };

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  // Si se elige otra cuenta desde la lista, el carrusel la trae al centro
  useEffect(() => {
    if (!selectedId || selectedId === centeredId()) return;
    const card = rowRef.current?.querySelector<HTMLElement>(`[data-account-id="${selectedId}"]`);
    card?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedId]);

  const center = (id: string) => {
    const card = rowRef.current?.querySelector<HTMLElement>(`[data-account-id="${id}"]`);
    card?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  const active = focusedId ?? selectedId;
  const activeIndex = Math.max(0, accounts.findIndex((a) => a.id === active));
  const thumb = accounts.length > 0 ? 1 / accounts.length : 1;

  return (
    <>
      <div
        ref={rowRef}
        onScroll={handleScroll}
        // El relleno lateral deja centrar también la primera y la última tarjeta
        className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto px-[calc(50%-150px)] py-1.5"
      >
        {accounts.map((account) => {
          const isActive = account.id === active;
          return (
            <div
              key={account.id}
              data-account-id={account.id}
              className={cn(
                'w-[300px] flex-none snap-center transition-[transform,opacity,filter] duration-300 ease-out',
                !isActive && 'scale-[0.92] opacity-45 saturate-[0.6]'
              )}
            >
              <WalletCard account={account} onSelect={() => (isActive ? undefined : center(account.id))} />
            </div>
          );
        })}
      </div>
      {/* Posición en el carrusel */}
      {accounts.length > 1 && (
        <div aria-hidden className="relative mx-auto mt-2 h-1 w-10 overflow-hidden rounded-full bg-surface-3">
          <span
            className="absolute inset-y-0 rounded-full bg-faint transition-[left] duration-300"
            style={{ width: `${thumb * 100}%`, left: `${activeIndex * thumb * 100}%` }}
          />
        </div>
      )}
    </>
  );
}
