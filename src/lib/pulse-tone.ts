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
