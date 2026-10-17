import { describe, expect, it } from 'vitest';
import { createAccountTransferSchema, createTransactionSchema, payCreditCardSchema } from './schemas';

const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

describe('createTransactionSchema', () => {
  const base = {
    projectId: uuid(1),
    accountId: uuid(2),
    type: 'expense' as const,
    originalAmount: 15990,
    date: new Date('2026-10-17T02:40:00Z'),
    description: 'Lider',
  };

  it('acepta un gasto válido y guarda la fecha de Chile', () => {
    const r = createTransactionSchema.parse(base);
    expect(r.date.toISOString()).toBe('2026-10-16T00:00:00.000Z');
  });

  it('rechaza montos no positivos, ids inválidos y descripciones vacías', () => {
    expect(createTransactionSchema.safeParse({ ...base, originalAmount: 0 }).success).toBe(false);
    expect(createTransactionSchema.safeParse({ ...base, accountId: 'x' }).success).toBe(false);
    expect(createTransactionSchema.safeParse({ ...base, description: '' }).success).toBe(false);
    expect(createTransactionSchema.safeParse({ ...base, nature: 'otra' }).success).toBe(false);
  });

  it('permite categoría vacía', () => {
    expect(createTransactionSchema.safeParse({ ...base, categoryId: '' }).success).toBe(true);
  });
});

describe('createAccountTransferSchema', () => {
  it('exige cuentas distintas', () => {
    const r = createAccountTransferSchema.safeParse({
      projectId: uuid(1),
      fromAccountId: uuid(2),
      toAccountId: uuid(2),
      amount: 1000,
      date: new Date(),
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(['toAccountId']);
  });
});

describe('payCreditCardSchema', () => {
  it('exige al menos un movimiento e intereses no negativos', () => {
    const base = { projectId: uuid(1), transactionIds: [uuid(3)], sourceAccountId: uuid(2), creditCardAccountId: uuid(4), date: new Date() };
    expect(payCreditCardSchema.safeParse(base).success).toBe(true);
    expect(payCreditCardSchema.safeParse({ ...base, transactionIds: [] }).success).toBe(false);
    expect(payCreditCardSchema.safeParse({ ...base, interestAmount: -1 }).success).toBe(false);
  });
});
