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
  placeholder?: string;
  searchPlaceholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
}

function ColorDot({ color }: { color: string | null | undefined }) {
  if (!color) {
    return <PieChart className="h-4 w-4 text-muted-foreground" />;
  }
  return (
    <span
      className="h-3 w-3 rounded-full shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

export function BudgetSelector({
  budgets,
  value,
  onValueChange,
  placeholder = 'Selecciona un presupuesto',
  searchPlaceholder = 'Buscar presupuesto...',
  allowNone = true,
  noneLabel = 'Sin presupuesto',
  disabled = false,
}: BudgetSelectorProps) {
  // Convert budgets to SearchableSelect options
  const options: SearchableSelectOption[] = useMemo(() => {
    return budgets.map((budget) => ({
      id: budget.id,
      label: budget.name,
      searchValue: `${budget.name} ${budget.categoryName ?? ''}`.trim(),
      // Use color dot as icon if category has color
      icon: <ColorDot color={budget.categoryColor} />,
    }));
  }, [budgets]);

  return (
    <SearchableSelect
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage="No se encontraron presupuestos."
      allowNone={allowNone}
      noneLabel={noneLabel}
      noneIcon={<PieChart className="h-4 w-4 text-muted-foreground" />}
      disabled={disabled}
    />
  );
}
