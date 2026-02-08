'use client';

import { useMemo } from 'react';
import { PieChart } from 'lucide-react';
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/searchable-select';

// Accepts both simple budgets and budgets with category info
interface SimpleBudget {
  id: string;
  name: string;
  categoryId: string | null;
}

interface BudgetWithCategoryInfo extends SimpleBudget {
  categoryName?: string | null;
  categoryColor?: string | null;
}

interface BudgetSelectorProps {
  budgets: BudgetWithCategoryInfo[];
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

export function BudgetSelector({
  budgets,
  value,
  onValueChange,
  label,
  placeholder = 'Selecciona un presupuesto',
  searchPlaceholder = 'Buscar presupuesto...',
  allowNone = true,
  noneLabel = 'Sin presupuesto',
  disabled = false,
  valid,
  invalid,
}: BudgetSelectorProps) {
  // Convert budgets to SearchableSelect options
  const options: SearchableSelectOption[] = useMemo(() => {
    return budgets.map((budget) => ({
      id: budget.id,
      label: budget.name,
      searchValue: `${budget.name} ${budget.categoryName ?? ''}`.trim(),
      // Use color if available, otherwise fallback to icon
      color: budget.categoryColor,
      icon: !budget.categoryColor ? (
        <PieChart className="h-4 w-4 text-muted-foreground" />
      ) : undefined,
    }));
  }, [budgets]);

  return (
    <SearchableSelect
      options={options}
      value={value}
      onValueChange={onValueChange}
      label={label}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage="No se encontraron presupuestos."
      allowNone={allowNone}
      noneLabel={noneLabel}
      noneIcon={<PieChart className="h-4 w-4 text-muted-foreground" />}
      disabled={disabled}
      valid={valid}
      invalid={invalid}
    />
  );
}
