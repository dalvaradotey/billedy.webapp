/**
 * Lectura de los documentos de AFC (texto por líneas, ver statements/lib/pdf-lines):
 * - Certificado de cotizaciones: período, empleador, renta imponible, monto y fecha
 *   de pago (dos líneas por mes: parte del afiliado y del empleador).
 * - Cartola de movimientos: cotizaciones con sus cuotas y el saldo en cuotas al cierre.
 */

export type ParsedContribution = {
  /** YYYY-MM-01 */
  period: string;
  /** YYYY-MM-DD */
  paidDate: string;
  taxableIncome: number | null;
  amount: number;
  quotas: number | null;
  employerRut: string | null;
};

export type AfcDocument =
  | { kind: 'certificado'; contributions: ParsedContribution[] }
  | { kind: 'cartola'; contributions: ParsedContribution[]; closing: { date: string; quotas: number } | null };

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pesos = (s: string) => parseInt(s.replace(/[$\s.]/g, ''), 10);
const decimal = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));
const iso = (d: string, m: string, y: string) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

/** Une las líneas del mismo período (afiliado + empleador, o varios empleadores) */
function mergeByPeriod(rows: ParsedContribution[]): ParsedContribution[] {
  const map = new Map<string, ParsedContribution>();
  for (const r of rows) {
    const prev = map.get(r.period);
    if (!prev) {
      map.set(r.period, { ...r });
    } else {
      prev.amount += r.amount;
      prev.quotas = prev.quotas != null || r.quotas != null ? Math.round(((prev.quotas ?? 0) + (r.quotas ?? 0)) * 10000) / 10000 : null;
      prev.taxableIncome = Math.max(prev.taxableIncome ?? 0, r.taxableIncome ?? 0) || null;
      if (r.paidDate > prev.paidDate) prev.paidDate = r.paidDate;
    }
  }
  return [...map.values()].sort((a, b) => a.period.localeCompare(b.period));
}

function parseCertificado(lines: string[]): ParsedContribution[] {
  const rows: ParsedContribution[] = [];
  const re = new RegExp(
    `^\\s*(${MONTHS.join('|')})\\s+(\\d{4})\\s+([\\d.]+-[\\dkK])\\b.*?\\$\\s?([\\d.]+)\\s+\\$\\s?([\\d.]+)\\s+(\\d{2})\\/(\\d{2})\\/(\\d{4})`,
    'i'
  );
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
    rows.push({
      period: `${m[2]}-${String(month).padStart(2, '0')}-01`,
      paidDate: iso(m[6], m[7], m[8]),
      taxableIncome: pesos(m[4]),
      amount: pesos(m[5]),
      quotas: null,
      employerRut: m[3],
    });
  }
  return mergeByPeriod(rows);
}

function parseCartola(lines: string[]): { contributions: ParsedContribution[]; closing: { date: string; quotas: number } | null } {
  const rows: ParsedContribution[] = [];
  // fecha operación, fecha movimiento, código, folio, tipo, mes remun., imponible, abono $, abono cuotas, …
  const re = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2})-(\d{2})-(\d{4})\s+(10[14])-\d{2}\s+\d+\s+COT\.(?:AFIL|EMP)\.\s+(\d{2})\/(\d{4})\s+([\d.]+)\s+([\d.]+)\s+([\d.,]+)\s+.*?([\d.]+-[\dkK])/;
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    rows.push({
      period: `${m[9]}-${m[8]}-01`,
      // Las cuotas quedan en la cuenta en la fecha de movimiento
      paidDate: iso(m[4], m[5], m[6]),
      taxableIncome: pesos(m[10]),
      amount: pesos(m[11]),
      quotas: decimal(m[12]),
      employerRut: m[13],
    });
  }

  // Saldo al cierre: el último "Saldo total" de la cartola, con su fecha
  let closing: { date: string; quotas: number } | null = null;
  let lastDate: string | null = null;
  for (const line of lines) {
    const d = line.match(/Saldo de la cartola anterior al:\s*(\d{2})-(\d{2})-(\d{4})/i);
    if (d) lastDate = iso(d[1], d[2], d[3]);
    const t = line.match(/Saldo total:\s*([\d.,]+)/i);
    if (t && lastDate) closing = { date: lastDate, quotas: decimal(t[1]) };
  }
  return { contributions: mergeByPeriod(rows), closing };
}

export function parseAfcDocument(lines: string[]): AfcDocument | null {
  const text = lines.join(' ');
  if (/Cartola de movimientos/i.test(text)) return { kind: 'cartola', ...parseCartola(lines) };
  if (/Certificado de cotizaciones previsionales/i.test(text) && /Cesant/i.test(text)) {
    return { kind: 'certificado', contributions: parseCertificado(lines) };
  }
  return null;
}
