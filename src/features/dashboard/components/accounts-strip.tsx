'use client';

import Link from 'next/link';
import { ScrollRow } from '@/components/ui/scroll-row';
import { formatCurrency } from '@/lib/formatting';
import { useDashboard } from '../hooks';

/** Resumen de cuentas como mini tarjetas de billetera. */
export function DashboardAccountsStrip() {
  const { accountsSummary: s } = useDashboard();
  const free = s.freeLiquidBalance ?? s.totalDebitBalance;
  const saved = s.totalDebitBalance - free;

  const cards = [
    { name: 'Libre en corrientes', label: 'PARA GASTAR', value: formatCurrency(free), bg: 'bg-[#EC6A62]', ink: 'text-[#3A0F0C]' },
    { name: 'Fondos y ahorro', label: 'APARTADO', value: formatCurrency(saved), bg: 'bg-sky', ink: 'text-sky-ink' },
    { name: 'Tarjetas', label: 'DEUDA', value: `−${formatCurrency(s.totalCreditBalance)}`, bg: 'bg-amber', ink: 'text-amber-ink' },
    { name: 'Previsión', label: 'AFP · APV · CESANTÍA', value: formatCurrency(s.totalProvisionBalance), bg: 'bg-[#8FD08A]', ink: 'text-[#14301A]' },
  ];

  return (
    <section aria-label="Tus cuentas">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-extrabold tracking-[-0.02em]">Tus cuentas</h2>
        <Link href="/dashboard/accounts" className="-my-2 inline-flex min-h-10 items-center px-1 text-xs font-bold text-jade">Ver todas</Link>
      </div>
      <ScrollRow className="-mx-4 mt-2.5 flex snap-x gap-2.5 px-4 md:mx-0 md:grid md:grid-cols-4 md:px-0">
        {cards.map((c) => (
          <Link
            key={c.name}
            href="/dashboard/accounts"
            className={`relative flex h-[106px] w-[168px] flex-none snap-start flex-col justify-between overflow-hidden rounded-2xl px-3.5 py-3 md:w-auto ${c.bg} ${c.ink}`}
          >
            <svg aria-hidden width="168" height="106" viewBox="0 0 168 106" className="absolute right-0 top-0">
              <circle cx="168" cy="0" r="50" fill="none" stroke="currentColor" strokeOpacity=".1" strokeWidth="14" />
              <circle cx="168" cy="0" r="84" fill="none" stroke="currentColor" strokeOpacity=".06" strokeWidth="14" />
            </svg>
            <span className="relative text-xs font-extrabold">{c.name}</span>
            <span className="relative">
              <span className="block text-[10px] font-bold opacity-70">{c.label}</span>
              <span className="num text-[17px] font-extrabold">{c.value}</span>
            </span>
          </Link>
        ))}
      </ScrollRow>
    </section>
  );
}
