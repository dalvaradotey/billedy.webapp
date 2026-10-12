import { getAccountFunds } from '@/features/accounts/lib/funds';

/**
 * Valida que un gasto pueda pagarse con un fondo: el fondo debe ser de la misma
 * cuenta, estar activo y tener saldo suficiente. Al editar, el monto anterior del
 * mismo gasto vuelve a estar disponible en el fondo.
 */
export async function validateFundPayment(input: {
  projectId: string;
  accountId: string;
  fundId: string;
  amount: number;
  previous?: { fundId: string | null; amount: number };
}): Promise<string | null> {
  const fund = (await getAccountFunds(input.projectId)).find((f) => f.id === input.fundId);
  if (!fund) return 'El fondo no existe o está archivado';
  if (fund.accountId !== input.accountId) return 'El fondo debe ser de la misma cuenta del gasto';

  const available = fund.balance + (input.previous?.fundId === input.fundId ? input.previous.amount : 0);
  if (input.amount > available) {
    return `El fondo "${fund.name}" solo tiene $${available.toLocaleString('es-CL')}`;
  }
  return null;
}
