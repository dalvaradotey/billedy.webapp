/**
 * Utilidades de formateo para Billedy
 * Centraliza funciones de formateo duplicadas en el proyecto
 */

/**
 * Formatea un número como moneda
 * @param amount - Monto a formatear (number o string)
 * @param currency - Código de moneda ISO 4217 (default: CLP)
 * @returns String formateado (ej: "$150.000")
 */
export function formatCurrency(
  amount: number | string,
  currency: string = 'CLP'
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  // CLP no usa decimales, otras monedas sí
  const decimals = currency === 'CLP' ? 0 : 2;

  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Formatea una fecha en formato corto
 * @param date - Fecha a formatear
 * @returns String formateado (ej: "15 ene")
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;

  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Formatea una fecha en formato largo
 * @param date - Fecha a formatear
 * @returns String formateado (ej: "15 ene 2025")
 */
export function formatDateLong(date: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;

  return d.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Formatea una fecha para inputs de tipo date
 * @param date - Fecha a formatear
 * @returns String en formato YYYY-MM-DD
 */
export function formatDateInput(date: Date | null): string {
  if (!date) return '';
  return date.toISOString().split('T')[0];
}

/**
 * Parsea un string de moneda a número
 * @param value - String con formato de moneda (ej: "$150.000")
 * @returns Número parseado
 */
export function parseCurrencyToNumber(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
}

/**
 * Formatea un número como porcentaje
 * @param value - Número entre 0 y 100
 * @returns String formateado (ej: "75%")
 */
export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

/**
 * Formatea un número con separador de miles
 * @param value - Número a formatear
 * @returns String formateado (ej: "1.500.000")
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-CL').format(value);
}
