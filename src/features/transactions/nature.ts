/**
 * Naturaleza de una transacción: separa lo propio de lo que se compensa.
 * Ver docs/PLAN_SALDOS_CICLOS_Y_TECHO_TC.md §4.
 */

export const TRANSACTION_NATURES = ['own', 'external', 'reimbursable', 'fund', 'reimbursement'] as const;
export type TransactionNature = (typeof TRANSACTION_NATURES)[number];

export const EXPENSE_NATURES = ['own', 'external', 'reimbursable', 'fund'] as const;
export const INCOME_NATURES = ['own', 'reimbursement'] as const;

export const NATURE_LABELS: Record<TransactionNature, string> = {
  own: 'Propio',
  external: 'De otra persona',
  reimbursable: 'Reembolsable',
  fund: 'Del fondo',
  reimbursement: 'Abono',
};

export const NATURE_DESCRIPTIONS: Record<TransactionNature, string> = {
  own: 'Gasto o ingreso tuyo',
  external: 'Lo paga otra persona; se espera un abono',
  reimbursable: 'Te lo devuelven (trabajo u otro)',
  fund: 'Sale del fondo de imprevistos y viajes',
  reimbursement: 'Devuelve un gasto que no era tuyo',
};

export function naturesForType(type: 'income' | 'expense'): readonly TransactionNature[] {
  return type === 'income' ? INCOME_NATURES : EXPENSE_NATURES;
}

export function isNatureValidForType(nature: TransactionNature, type: 'income' | 'expense'): boolean {
  return (naturesForType(type) as readonly string[]).includes(nature);
}

/** Naturaleza efectiva: si no aplica al tipo, se usa 'own' */
export function normalizeNature(
  nature: TransactionNature | null | undefined,
  type: 'income' | 'expense'
): TransactionNature {
  return nature && isNatureValidForType(nature, type) ? nature : 'own';
}
