import { describe, expect, it } from 'vitest';
import { isNatureValidForType, natureDescription, naturesForType, normalizeNature } from './nature';

describe('naturaleza de un movimiento', () => {
  it('cada tipo tiene sus naturalezas', () => {
    expect(naturesForType('expense')).toEqual(['own', 'external', 'reimbursable', 'fund']);
    expect(naturesForType('income')).toEqual(['own', 'reimbursement', 'external']);
  });

  it('un abono solo existe en ingresos y "del fondo" solo en gastos', () => {
    expect(isNatureValidForType('reimbursement', 'expense')).toBe(false);
    expect(isNatureValidForType('fund', 'income')).toBe(false);
    expect(isNatureValidForType('external', 'income')).toBe(true);
  });

  it('normalizeNature cae en "propio" si no aplica al tipo', () => {
    expect(normalizeNature('reimbursement', 'expense')).toBe('own');
    expect(normalizeNature(undefined, 'income')).toBe('own');
    expect(normalizeNature('reimbursable', 'expense')).toBe('reimbursable');
  });

  it('la descripción de "de otra persona" cambia en ingresos', () => {
    expect(natureDescription('external', 'income')).toMatch(/no es ingreso tuyo/);
    expect(natureDescription('external', 'expense')).toMatch(/abono/);
  });
});
