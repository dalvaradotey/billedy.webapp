/**
 * Valor cuota diario de los fondos de pensiones (por AFP y fondo) y del fondo de
 * la Cuenta Individual de Cesantía (AFC). Lo publica la Superintendencia de
 * Pensiones como CSV (separado por ";", números con formato chileno, latin1).
 */

export const AFP_PROVIDERS = ['CAPITAL', 'CUPRUM', 'HABITAT', 'MODELO', 'PLANVITAL', 'PROVIDA', 'UNO'] as const;
export const AFP_FUNDS = ['A', 'B', 'C', 'D', 'E'] as const;
/** Fondo de la Cuenta Individual de Cesantía */
export const AFC_PROVIDER = 'AFC';
export const AFC_FUND = 'CIC';

export type QuotaValue = { provider: string; fund: string; date: string; value: number };

const BASE = 'https://www.spensiones.cl/apps/valoresCuotaFondo';

const chileanNumber = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));

async function fetchCsv(url: string): Promise<string[][]> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Billedy' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Valor cuota: ${res.status} en ${url}`);
  const text = new TextDecoder('latin1').decode(await res.arrayBuffer());
  return text
    .split(/\r?\n/)
    .map((line) => line.split(';').map((c) => c.trim()))
    .filter((cols) => cols.length > 1);
}

/**
 * Valores de un fondo de AFP (A–E) para todas las AFP en un año.
 * Columnas: Fecha; AFP1 valor cuota; AFP1 patrimonio; AFP2 valor cuota; …
 */
export async function fetchAfpQuotaValues(year: number, fund: string): Promise<QuotaValue[]> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rows = await fetchCsv(`${BASE}/vcfAFPxls.php?aaaaini=${year}&aaaafin=${year}&tf=${fund}&fecconf=${today}`);
  const header = rows.find((r) => r[0] === 'Fecha');
  if (!header) throw new Error('Valor cuota AFP: formato desconocido');
  // Cada AFP ocupa dos columnas (valor cuota y patrimonio); el nombre va sobre el valor cuota
  const columns = header
    .map((name, i) => ({ name: name.toUpperCase(), i }))
    .filter((c) => (AFP_PROVIDERS as readonly string[]).includes(c.name));
  const values: QuotaValue[] = [];
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row[0])) continue;
    for (const c of columns) {
      const value = chileanNumber(row[c.i] ?? '');
      if (value > 0) values.push({ provider: c.name, fund, date: row[0], value });
    }
  }
  return values;
}

/** Valores del fondo de la Cuenta Individual de Cesantía en un año. */
export async function fetchAfcQuotaValues(year: number): Promise<QuotaValue[]> {
  const rows = await fetchCsv(`${BASE}/vcfAFCxls.php?aaaa=${year}`);
  const values: QuotaValue[] = [];
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row[0])) continue;
    const value = chileanNumber(row[1] ?? '');
    if (value > 0) values.push({ provider: AFC_PROVIDER, fund: AFC_FUND, date: row[0], value });
  }
  return values;
}
