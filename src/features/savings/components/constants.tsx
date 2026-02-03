import { PiggyBank, TrendingUp, Target, Wallet } from 'lucide-react';

export const FUND_TYPE_LABELS: Record<string, string> = {
  emergency: 'Emergencia',
  investment: 'Inversión',
  goal: 'Meta',
  other: 'Otro',
};

export const FUND_TYPE_ICONS: Record<string, React.ReactNode> = {
  emergency: <Wallet className="h-4 w-4" />,
  investment: <TrendingUp className="h-4 w-4" />,
  goal: <Target className="h-4 w-4" />,
  other: <PiggyBank className="h-4 w-4" />,
};

export const ACCOUNT_TYPE_OPTIONS = [
  'Cuenta de ahorro',
  'Depósito a plazo',
  'Cuenta corriente',
  'Efectivo',
  'Inversiones',
  'Otro',
];
