'use client';

import { useMemo } from 'react';
import { Building2, PiggyBank, Wallet, CreditCard } from 'lucide-react';
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/searchable-select';
import {
  ACCOUNT_TYPE_LABELS,
  type AccountType,
  type AccountWithEntity,
} from '@/features/accounts/types';

interface AccountSelectorProps {
  accounts: AccountWithEntity[];
  value: string | null | undefined;
  onValueChange: (value: string | null) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  filterByType?: AccountType[];
  disabled?: boolean;
}

function getAccountTypeIcon(type: AccountType) {
  const className = 'h-4 w-4 text-muted-foreground';
  switch (type) {
    case 'checking':
      return <Building2 className={className} />;
    case 'savings':
      return <PiggyBank className={className} />;
    case 'cash':
      return <Wallet className={className} />;
    case 'credit_card':
      return <CreditCard className={className} />;
    default:
      return <Wallet className={className} />;
  }
}

export function AccountSelector({
  accounts,
  value,
  onValueChange,
  label,
  placeholder = 'Selecciona una cuenta',
  searchPlaceholder = 'Buscar cuenta...',
  allowNone = false,
  noneLabel = 'Sin cuenta',
  filterByType,
  disabled = false,
}: AccountSelectorProps) {
  // Filter accounts by type if specified
  const filteredAccounts = useMemo(() => {
    if (!filterByType || filterByType.length === 0) {
      return accounts;
    }
    return accounts.filter((a) => filterByType.includes(a.type as AccountType));
  }, [accounts, filterByType]);

  // Convert accounts to SearchableSelect options
  const options: SearchableSelectOption[] = useMemo(() => {
    return filteredAccounts.map((account) => ({
      id: account.id,
      label: account.name,
      searchValue: `${account.name} ${ACCOUNT_TYPE_LABELS[account.type as AccountType]}`,
      group: account.type,
      // Use entity image if available, otherwise use account type icon
      image: account.entity?.imageUrl ?? null,
      icon: !account.entity?.imageUrl
        ? getAccountTypeIcon(account.type as AccountType)
        : undefined,
    }));
  }, [filteredAccounts]);

  return (
    <SearchableSelect
      options={options}
      value={value}
      onValueChange={onValueChange}
      label={label}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage="No se encontraron cuentas."
      allowNone={allowNone}
      noneLabel={noneLabel}
      noneIcon={<Wallet className="h-4 w-4 text-muted-foreground" />}
      disabled={disabled}
      groupLabels={ACCOUNT_TYPE_LABELS}
    />
  );
}
