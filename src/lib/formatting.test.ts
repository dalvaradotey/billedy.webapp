import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  appDateString,
  daysBetween,
  formatCurrency,
  formatDate,
  formatDateInput,
  formatDateLong,
  formatNumber,
  formatPercentage,
  getToday,
  parseChileanDecimal,
  parseClp,
  parseCurrencyToNumber,
  parseFlexibleDecimal,
  toAppDate,
  toCalendarDate,
} from './formatting';

describe('formatCurrency', () => {
  it('formatea CLP sin decimales y con punto de miles', () => {
    expect(formatCurrency(150000)).toBe('$150.000');
    expect(formatCurrency('1234567.6')).toBe('$1.234.568');
  });

  it('usa dos decimales en otras monedas', () => {
    expect(formatCurrency(10.5, 'USD')).toMatch(/10,50/);
  });

  it('formatea negativos como lo hace Intl en es-CL', () => {
    expect(formatCurrency(-5000)).toBe('$-5.000');
  });
});

describe('formatos de fecha', () => {
  it('formatDate y formatDateLong leen la fecha en UTC', () => {
    const d = new Date('2026-01-15T00:00:00Z');
    expect(formatDate(d)).toMatch(/15.*ene/);
    expect(formatDateLong('2026-01-15')).toMatch(/15.*ene.*2026/);
  });

  it('devuelve "-" o vacío sin fecha', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDateLong(null)).toBe('-');
    expect(formatDateInput(null)).toBe('');
  });

  it('formatDateInput entrega YYYY-MM-DD', () => {
    expect(formatDateInput(new Date('2026-10-16T00:00:00Z'))).toBe('2026-10-16');
  });
});

describe('números', () => {
  it('parseCurrencyToNumber ignora símbolos', () => {
    expect(parseCurrencyToNumber('$-150')).toBe(-150);
    expect(parseCurrencyToNumber('abc')).toBe(0);
  });

  it('formatPercentage redondea', () => {
    expect(formatPercentage(74.6)).toBe('75%');
  });

  it('formatNumber usa separador chileno', () => {
    expect(formatNumber(1500000)).toBe('1.500.000');
  });
});

describe('fechas de Chile', () => {
  afterEach(() => vi.useRealTimers());

  it('getToday entrega el día de Chile, aunque en UTC ya sea mañana', () => {
    // 23:40 del 16 de octubre en Chile (UTC-3) = 02:40 del 17 en UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17T02:40:00Z'));
    expect(getToday().toISOString()).toBe('2026-10-16T00:00:00.000Z');
  });

  it('toAppDate pasa "ahora" a la fecha calendario de Chile', () => {
    expect(toAppDate(new Date('2026-10-17T02:40:00Z')).toISOString()).toBe('2026-10-16T00:00:00.000Z');
    expect(appDateString(new Date('2026-10-16T15:00:00Z'))).toBe('2026-10-16');
  });

  it('toAppDate respeta una fecha que ya está a medianoche UTC', () => {
    const d = new Date('2026-10-17T00:00:00Z');
    expect(toAppDate(d)).toBe(d);
  });

  it('toCalendarDate quita la hora y daysBetween cuenta días calendario', () => {
    expect(toCalendarDate('2026-10-16T22:10:00Z').toISOString()).toBe('2026-10-16T00:00:00.000Z');
    expect(daysBetween('2026-09-25', '2026-10-25T23:00:00Z')).toBe(30);
    expect(daysBetween(new Date('2026-10-25'), new Date('2026-09-25'))).toBe(-30);
  });
});

describe('números con formato chileno', () => {
  it('parseClp y parseChileanDecimal', () => {
    expect(parseClp('$ 1.234.567')).toBe(1_234_567);
    expect(parseChileanDecimal('77.542,73')).toBe(77542.73);
  });

  it('parseFlexibleDecimal entiende coma o punto decimal', () => {
    expect(parseFlexibleDecimal('566,17')).toBe(566.17);
    expect(parseFlexibleDecimal('566.17')).toBe(566.17);
    expect(parseFlexibleDecimal(' 1.234,5678 ')).toBe(1234.5678);
    expect(parseFlexibleDecimal('56.617')).toBe(56.617);
    expect(parseFlexibleDecimal('1.234.567')).toBe(1_234_567);
  });
});
