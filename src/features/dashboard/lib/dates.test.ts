import { describe, expect, it } from 'vitest';
import { addDays, shortDate } from './dates';

describe('fechas del ciclo', () => {
  it('suma días sin correrse por zona horaria', () => {
    expect(addDays('2026-09-25T00:00:00Z', 30).toISOString()).toBe('2026-10-25T00:00:00.000Z');
    expect(addDays(new Date('2026-12-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2027-01-01');
  });

  it('shortDate', () => {
    expect(shortDate('2026-09-25')).toBe('25 sep');
  });
});
