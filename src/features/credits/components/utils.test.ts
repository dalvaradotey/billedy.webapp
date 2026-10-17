import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculatePaidInstallments } from './utils';

describe('calculatePaidInstallments', () => {
  afterEach(() => vi.useRealTimers());

  it('cuenta las cuotas cuya fecha ya pasó', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 16));
    expect(calculatePaidInstallments(new Date(2026, 6, 5), 'monthly', 32)).toBe(4); // jul, ago, sep, oct
    expect(calculatePaidInstallments(new Date(2026, 9, 1), 'weekly', 10)).toBe(3);
    expect(calculatePaidInstallments(new Date(2026, 8, 1), 'biweekly', 2)).toBe(2); // tope: total de cuotas
  });

  it('cero si empieza hoy o después, o faltan datos', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 16));
    expect(calculatePaidInstallments(new Date(2026, 9, 16), 'monthly', 12)).toBe(0);
    expect(calculatePaidInstallments(undefined, 'monthly', 12)).toBe(0);
    expect(calculatePaidInstallments(new Date(2026, 0, 1), undefined, 12)).toBe(0);
  });
});
