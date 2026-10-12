import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatting';
import type { AccountType, AccountWithEntity } from '../types';

/** Colores de "plástico" para las tarjetas: plenos, con tinta oscura encima. */
const WALLET_COLORS = [
  { bg: 'bg-[#EC6A62]', ink: 'text-[#3A0F0C]' },
  { bg: 'bg-sky', ink: 'text-sky-ink' },
  { bg: 'bg-amber', ink: 'text-amber-ink' },
  { bg: 'bg-[#E191E8]', ink: 'text-[#36123A]' },
  { bg: 'bg-[#8FD08A]', ink: 'text-[#14301A]' },
  { bg: 'bg-[#6FD0EE]', ink: 'text-[#0B2C36]' },
  { bg: 'bg-[#F2A35E]', ink: 'text-[#3A2410]' },
  { bg: 'bg-violet', ink: 'text-violet-ink' },
];

const KIND_LABELS: Record<AccountType, string> = {
  checking: 'CUENTA CORRIENTE',
  savings: 'AHORRO',
  cash: 'EFECTIVO',
  credit_card: 'TARJETA DE CRÉDITO',
  pension: 'PREVISIÓN',
  unemployment: 'CESANTÍA',
};

/** Colores reconocibles para bancos comunes; el resto toma uno estable por nombre. */
const BANK_COLORS: [RegExp, number][] = [
  [/santander/, 0],
  [/fintual/, 1],
  [/estado/, 6],
  [/mercado ?pago/, 5],
  [/latam|world ?member|bci|falabella/, 3],
  [/afp|modelo|habitat|provida|capital|cuprum|planvital|uno/, 4],
  [/afc|cesant/, 4],
];

/** Color estable por banco (o por nombre si no hay banco). */
export function walletColor(account: AccountWithEntity) {
  const key = (account.entity?.name ?? account.bankName ?? account.name).toLowerCase();
  const known = BANK_COLORS.find(([re]) => re.test(key) || re.test(account.name.toLowerCase()));
  if (known) return WALLET_COLORS[known[1]];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return WALLET_COLORS[h % WALLET_COLORS.length];
}

export function accountKindLabel(type: string) {
  return KIND_LABELS[type as AccountType] ?? '';
}

function Rings({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 300 189" preserveAspectRatio="xMaxYMin slice" className={cn('absolute inset-0 h-full w-full', className)}>
      <circle cx="300" cy="0" r="90" fill="none" stroke="currentColor" strokeOpacity=".10" strokeWidth="22" />
      <circle cx="300" cy="0" r="150" fill="none" stroke="currentColor" strokeOpacity=".07" strokeWidth="22" />
      <circle cx="300" cy="0" r="210" fill="none" stroke="currentColor" strokeOpacity=".05" strokeWidth="22" />
    </svg>
  );
}

interface WalletCardProps {
  account: AccountWithEntity;
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
}

/** Tarjeta de billetera con proporción de tarjeta real. */
export function WalletCard({ account, selected, onSelect, className }: WalletCardProps) {
  const color = walletColor(account);
  const balance = parseFloat(account.currentBalance);
  const isCredit = account.type === 'credit_card';
  const limit = account.creditLimit ? parseFloat(account.creditLimit) : null;
  const usedPct = isCredit && limit ? Math.min(100, Math.round((balance / limit) * 100)) : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        '@container relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-[22px] px-5 py-[18px] text-left transition-[transform,opacity]',
        color.bg,
        color.ink,
        selected ? 'ring-2 ring-cream ring-offset-2 ring-offset-background' : 'opacity-90 hover:opacity-100',
        account.isArchived && 'opacity-50',
        className
      )}
    >
      <Rings />
      <span className="relative flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[11px] font-extrabold tracking-[0.06em] opacity-70">{accountKindLabel(account.type)}</span>
          <span className="mt-0.5 block truncate text-lg font-extrabold tracking-[-0.02em]">{account.name}</span>
        </span>
        <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden className="shrink-0">
          <rect x="1" y="1" width="32" height="24" rx="6" fill="currentColor" fillOpacity=".14" stroke="currentColor" strokeOpacity=".35" />
          <path d="M1 9h10M1 17h10M23 9h10M23 17h10M11 1v24M23 1v24" stroke="currentColor" strokeOpacity=".35" />
        </svg>
      </span>
      <span className="relative">
        {usedPct != null && (
          <span aria-hidden className="mb-2 block h-1 rounded-full bg-current/20">
            <span className="block h-1 rounded-full bg-current" style={{ width: `${usedPct}%` }} />
          </span>
        )}
        <span className="block text-xs font-semibold opacity-75">
          {isCredit ? (usedPct != null ? `Deuda · cupo usado ${usedPct}%` : 'Deuda') : 'Saldo'}
        </span>
        <span className="flex items-baseline justify-between gap-2">
          <span className="num whitespace-nowrap text-[22px] font-extrabold leading-tight @[250px]:text-[28px]">
            {isCredit && balance > 0 ? '−' : ''}
            {formatCurrency(Math.abs(balance), account.currency)}
          </span>
          <span className="hidden truncate text-xs font-bold opacity-75 @[280px]:inline">{account.entity?.name ?? account.bankName ?? ''}</span>
        </span>
      </span>
    </button>
  );
}

/** Mini tarjeta para listas. */
export function WalletChip({ account }: { account: AccountWithEntity }) {
  const color = walletColor(account);
  return (
    <span aria-hidden className={cn('relative block h-[30px] w-[46px] shrink-0 overflow-hidden rounded-[7px]', color.bg, color.ink)}>
      <span className="absolute -right-2.5 -top-2.5 h-[26px] w-[26px] rounded-full border-[5px] border-current opacity-15" />
      <span className="absolute bottom-[5px] left-1.5 text-[9px] font-extrabold">
        {(account.entity?.name ?? account.bankName ?? account.name).slice(0, 3).toUpperCase()}
      </span>
    </span>
  );
}
