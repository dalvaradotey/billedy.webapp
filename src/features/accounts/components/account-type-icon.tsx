import { Building2, PiggyBank, Wallet, CreditCard } from 'lucide-react';
import { type AccountType } from '../types';

interface AccountTypeIconProps {
  type: AccountType;
  className?: string;
}

export function AccountTypeIcon({ type, className }: AccountTypeIconProps) {
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
