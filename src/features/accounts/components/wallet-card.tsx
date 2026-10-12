/* eslint-disable @next/next/no-img-element */
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatting';
import type { AccountType, AccountWithEntity } from '../types';
import { cardDesignFor, type CardDesign } from '../card-designs';

const KIND_LABELS: Record<AccountType, string> = {
  checking: 'CUENTA CORRIENTE',
  savings: 'AHORRO',
  cash: 'EFECTIVO',
  credit_card: 'TARJETA DE CRÉDITO',
  pension: 'PREVISIÓN',
  unemployment: 'CESANTÍA',
};

export function accountKindLabel(type: string) {
  return KIND_LABELS[type as AccountType] ?? '';
}

/** Fondo de la tarjeta según el diseño (foto, dibujo o liso). */
function CardBackground({ design }: { design: CardDesign }) {
  if (design.kind === 'photo' && design.image) {
    return <img src={design.image} alt="" className="absolute inset-0 h-full w-full object-cover" />;
  }
  return design.Art ? <design.Art /> : null;
}

/** Logo de la institución sobre una placa blanca, para que se lea sobre cualquier color. */
function BankLogo({ src, name, size = 'md' }: { src: string; name: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center bg-white',
        size === 'md' ? 'h-9 min-w-9 max-w-[84px] rounded-[10px] px-1.5' : 'h-[14px] min-w-[14px] max-w-[26px] rounded-[4px] px-0.5'
      )}
    >
      <img src={src} alt={name} className={cn('w-auto object-contain', size === 'md' ? 'h-6 max-w-[72px]' : 'h-[10px] max-w-[22px]')} />
    </span>
  );
}

function Chip() {
  return (
    <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden className="shrink-0">
      <rect x="1" y="1" width="32" height="24" rx="6" fill="currentColor" fillOpacity=".14" stroke="currentColor" strokeOpacity=".35" />
      <path d="M1 9h10M1 17h10M23 9h10M23 17h10M11 1v24M23 1v24" stroke="currentColor" strokeOpacity=".35" />
    </svg>
  );
}

interface WalletCardProps {
  account: AccountWithEntity;
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
}

/** Tarjeta de billetera con proporción de tarjeta real y el diseño elegido para la cuenta. */
export function WalletCard({ account, selected, onSelect, className }: WalletCardProps) {
  const design = cardDesignFor(account);
  const balance = parseFloat(account.currentBalance);
  const isCredit = account.type === 'credit_card';
  const limit = account.creditLimit ? parseFloat(account.creditLimit) : null;
  const usedPct = isCredit && limit ? Math.min(100, Math.round((balance / limit) * 100)) : null;
  const isPhoto = design.kind === 'photo';

  const amount = (
    <span className="num whitespace-nowrap text-[22px] font-extrabold leading-tight @[250px]:text-[28px]">
      {isCredit && balance > 0 ? '−' : ''}
      {formatCurrency(Math.abs(balance), account.currency)}
    </span>
  );
  const usage = usedPct != null && (
    <span aria-hidden className="mb-2 block h-1 rounded-full bg-current/20">
      <span className="block h-1 rounded-full bg-current" style={{ width: `${usedPct}%` }} />
    </span>
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${account.name}: ${isCredit ? 'deuda' : 'saldo'} ${formatCurrency(Math.abs(balance), account.currency)}`}
      className={cn(
        '@container relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-[22px] text-left transition-[transform,opacity]',
        design.bg,
        design.ink,
        isPhoto ? 'p-2.5' : 'px-5 py-[18px]',
        selected ? 'ring-2 ring-cream ring-offset-2 ring-offset-background' : 'opacity-90 hover:opacity-100',
        account.isArchived && 'opacity-50',
        className
      )}
    >
      <CardBackground design={design} />

      {isPhoto ? (
        <>
          <span />
          {/* Franja con los datos de la app: plana, sobre la esquina donde iba el número */}
          <span className="relative max-w-[78%] rounded-2xl bg-[#0E0C12]/75 px-3 py-2 backdrop-blur-[2px]">
            <span className="block truncate text-[10px] font-extrabold tracking-[0.06em] opacity-70">
              {accountKindLabel(account.type)} · {account.name}
            </span>
            {usage}
            {amount}
          </span>
        </>
      ) : (
        <>
          <span className="relative flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[11px] font-extrabold tracking-[0.06em] opacity-70">{accountKindLabel(account.type)}</span>
              <span className="mt-0.5 block truncate text-lg font-extrabold tracking-[-0.02em]">{account.name}</span>
            </span>
            {account.entity?.imageUrl ? <BankLogo src={account.entity.imageUrl} name={account.entity.name} /> : <Chip />}
          </span>
          <span className="relative">
            {usage}
            <span className="block text-xs font-semibold opacity-75">
              {isCredit ? (usedPct != null ? `Deuda · cupo usado ${usedPct}%` : 'Deuda') : 'Saldo'}
            </span>
            <span className="flex items-baseline justify-between gap-2">
              {amount}
              <span className="hidden truncate text-xs font-bold opacity-75 @[280px]:inline">
                {account.entity?.name ?? account.bankName ?? ''}
              </span>
            </span>
          </span>
        </>
      )}
    </button>
  );
}

/** Vista previa del diseño (para la galería): la tarjeta sin datos. */
export function CardDesignPreview({ design, className }: { design: CardDesign; className?: string }) {
  return (
    <span aria-hidden className={cn('relative block aspect-[1.586] w-full overflow-hidden rounded-xl', design.bg, design.ink, className)}>
      <CardBackground design={design} />
      {design.kind !== 'photo' && (
        <span className="absolute right-2 top-2 scale-75">
          <Chip />
        </span>
      )}
    </span>
  );
}

/** Mini tarjeta para listas. */
export function WalletChip({ account }: { account: AccountWithEntity }) {
  const design = cardDesignFor(account);
  return (
    <span aria-hidden className={cn('relative block h-[30px] w-[46px] shrink-0 overflow-hidden rounded-[7px]', design.bg, design.ink)}>
      <CardBackground design={design} />
      {design.kind !== 'photo' &&
        (account.entity?.imageUrl ? (
          <span className="absolute right-1 top-1">
            <BankLogo src={account.entity.imageUrl} name={account.entity.name} size="sm" />
          </span>
        ) : (
          <span className="absolute bottom-[5px] left-1.5 text-[9px] font-extrabold">
            {(account.entity?.name ?? account.bankName ?? account.name).slice(0, 3).toUpperCase()}
          </span>
        ))}
    </span>
  );
}
