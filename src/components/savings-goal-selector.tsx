'use client';

import { useMemo } from 'react';
import { PiggyBank } from 'lucide-react';
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/searchable-select';

interface SavingsGoal {
  id: string;
  name: string;
}

interface SavingsGoalSelectorProps {
  savingsGoals: SavingsGoal[];
  value: string | null | undefined;
  onValueChange: (value: string | null) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
  valid?: boolean;
  invalid?: boolean;
}

export function SavingsGoalSelector({
  savingsGoals,
  value,
  onValueChange,
  label,
  placeholder = 'Selecciona una meta',
  searchPlaceholder = 'Buscar meta...',
  allowNone = true,
  noneLabel = 'Sin meta de ahorro',
  disabled = false,
  valid,
  invalid,
}: SavingsGoalSelectorProps) {
  const options: SearchableSelectOption[] = useMemo(() => {
    return savingsGoals.map((goal) => ({
      id: goal.id,
      label: goal.name,
      icon: <PiggyBank className="h-4 w-4 text-muted-foreground" />,
    }));
  }, [savingsGoals]);

  return (
    <SearchableSelect
      options={options}
      value={value}
      onValueChange={onValueChange}
      label={label}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage="No se encontraron metas de ahorro."
      allowNone={allowNone}
      noneLabel={noneLabel}
      noneIcon={<PiggyBank className="h-4 w-4 text-muted-foreground" />}
      disabled={disabled}
      valid={valid}
      invalid={invalid}
    />
  );
}
