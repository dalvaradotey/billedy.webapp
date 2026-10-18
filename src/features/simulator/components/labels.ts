import { getToday } from '@/lib/formatting';
import { MONTHS_SHORT } from '@/lib/dates';

/** "feb 2027": el mes que viene dentro de `offset` meses (1 = el próximo) */
export function monthLabel(offset: number): string {
  const today = getToday();
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1));
  return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export const pct = (n: number) => `${(n * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`;
