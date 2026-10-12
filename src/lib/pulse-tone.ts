/**
 * Lleva cualquier color (p. ej. el color guardado de una categoría) al tono Pulso
 * más cercano, para que la app use siempre la misma paleta suave.
 */
export type PulseTone = 'jade' | 'coral' | 'amber' | 'sky' | 'violet' | 'rose' | 'neutral';

export const TONE_CLASSES: Record<PulseTone, { soft: string; text: string; bar: string }> = {
  jade: { soft: 'bg-jade-soft', text: 'text-jade', bar: 'bg-jade' },
  coral: { soft: 'bg-coral-soft', text: 'text-coral', bar: 'bg-coral' },
  amber: { soft: 'bg-amber-soft', text: 'text-amber', bar: 'bg-amber' },
  sky: { soft: 'bg-sky-soft', text: 'text-sky', bar: 'bg-sky' },
  violet: { soft: 'bg-violet-soft', text: 'text-violet', bar: 'bg-violet' },
  rose: { soft: 'bg-rose-soft', text: 'text-rose', bar: 'bg-rose' },
  neutral: { soft: 'bg-surface-3', text: 'text-[#CFC6D6]', bar: 'bg-[#CFC6D6]' },
};

export function pulseTone(hex: string | null | undefined): PulseTone {
  if (!hex) return 'neutral';
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!m) return 'neutral';
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.12) return 'neutral';
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 20 || h >= 345) return 'coral';
  if (h < 55) return 'amber';
  if (h < 170) return 'jade';
  if (h < 230) return 'sky';
  if (h < 290) return 'violet';
  return 'rose';
}

const NAME_TONES: PulseTone[] = ['amber', 'sky', 'rose', 'violet', 'coral', 'jade'];

/** Tono estable a partir de un nombre (misma categoría, mismo color en toda la app). */
export function toneForName(name: string | null | undefined): PulseTone {
  if (!name) return 'neutral';
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return NAME_TONES[h % NAME_TONES.length];
}

/** Paleta para elegir colores de categoría: tonos plenos de Pulso. */
export const PULSE_PALETTE = [
  '#5CC3A4', // jade
  '#8FD08A', // verde
  '#6FD0EE', // cian
  '#7CB7EE', // celeste
  '#A897FF', // violeta
  '#E191E8', // lila
  '#EE8FB2', // rosa
  '#F08A74', // coral
  '#F2A35E', // naranja
  '#F0B45C', // ámbar
  '#D9C4A0', // arena
  '#BEB5C7', // gris ciruela
];

function hueOf(hex: string): { h: number; sat: number } | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!m) return null;
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return { h: 0, sat: 0 };
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, sat: d / (1 - Math.abs(max + min - 1) || 1) };
}

/** Color guardado (p. ej. de una categoría) → el tono más cercano de la paleta Pulso. */
export function pulseColor(hex: string | null | undefined): string {
  if (!hex) return '#BEB5C7';
  if (PULSE_PALETTE.includes(hex.toUpperCase())) return hex.toUpperCase();
  const src = hueOf(hex);
  if (!src || src.sat < 0.15) return '#BEB5C7';
  let best = PULSE_PALETTE[0];
  let bestDist = Infinity;
  for (const p of PULSE_PALETTE) {
    const t = hueOf(p);
    if (!t || t.sat < 0.15) continue;
    const dh = Math.min(Math.abs(t.h - src.h), 360 - Math.abs(t.h - src.h));
    if (dh < bestDist) {
      bestDist = dh;
      best = p;
    }
  }
  return best;
}
