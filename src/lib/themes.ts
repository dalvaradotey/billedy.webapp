/**
 * Temas de color de la app. Cada uno redefine las variables de color en
 * globals.css ([data-theme='…']); los componentes solo usan esas variables.
 */
export const THEMES = [
  { id: 'ciruela', name: 'Ciruela', mode: 'dark', background: '#15121A', surface: '#1E1A24', accent: '#5CC3A4', text: '#F4EFE8' },
  { id: 'grafito', name: 'Grafito', mode: 'dark', background: '#111317', surface: '#181B20', accent: '#4CC2C4', text: '#EEF1F4' },
  { id: 'niebla', name: 'Niebla', mode: 'dark', background: '#262A33', surface: '#2E333D', accent: '#7BD3AE', text: '#F1F2F5' },
  { id: 'arena', name: 'Arena', mode: 'light', background: '#E9E3D9', surface: '#F3EEE6', accent: '#2E9C7C', text: '#2A2420' },
  { id: 'papel', name: 'Papel', mode: 'light', background: '#F6F3EE', surface: '#FFFFFF', accent: '#2E9C7C', text: '#1E1A24' },
  { id: 'nube', name: 'Nube', mode: 'light', background: '#F2F5F9', surface: '#FFFFFF', accent: '#1D96A3', text: '#141821' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'ciruela';

/** Favicon con los colores del tema (mismo dibujo que src/app/icon.svg) */
export function faviconSvg(theme: (typeof THEMES)[number]): string {
  const border = theme.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="${theme.surface}"/><rect x="1.5" y="1.5" width="61" height="61" rx="16.5" fill="none" stroke="${border}" stroke-width="3"/><polyline points="10,38 21,38 27,20 36,46 42,30 54,30" fill="none" stroke="${theme.accent}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function themeById(id: string | undefined) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
