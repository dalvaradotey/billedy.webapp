import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_THEME, THEMES, faviconSvg, themeById } from './themes';

describe('temas', () => {
  it('son 6: tres oscuros y tres claros, con Ciruela por defecto', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['ciruela', 'grafito', 'niebla', 'arena', 'papel', 'nube']);
    expect(THEMES.filter((t) => t.mode === 'dark')).toHaveLength(3);
    expect(DEFAULT_THEME).toBe('ciruela');
  });

  it('un tema desconocido cae en el por defecto', () => {
    expect(themeById(undefined).id).toBe('ciruela');
    expect(themeById('neon').id).toBe('ciruela');
  });

  it('cada tema nuevo tiene su bloque de variables en globals.css', () => {
    const css = readFileSync(join(__dirname, '../app/globals.css'), 'utf8');
    for (const t of THEMES.filter((t) => t.id !== 'ciruela')) {
      expect(css).toContain(`[data-theme='${t.id}']`);
    }
  });

  it('el favicon usa la superficie y el acento del tema', () => {
    const nube = themeById('nube');
    const svg = faviconSvg(nube);
    expect(svg).toContain(`fill="${nube.surface}"`);
    expect(svg).toContain(`stroke="${nube.accent}"`);
  });
});
