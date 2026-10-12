/**
 * Fechas de ciclo como días calendario (sin zona horaria): las fechas de la BD
 * llegan a medianoche UTC y en Chile se correrían un día si se formatean en hora local.
 */
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function toUtcDay(d: Date | string): Date {
  const iso = typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  return new Date(`${iso}T00:00:00Z`);
}

export function addDays(d: Date | string, days: number): Date {
  const base = toUtcDay(d);
  base.setUTCDate(base.getUTCDate() + days);
  return base;
}

/** "25 sep" */
export function shortDate(d: Date | string): string {
  const day = toUtcDay(d);
  return `${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}`;
}
