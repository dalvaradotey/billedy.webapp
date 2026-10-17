'use client';

import { useEffect } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { DEFAULT_THEME, THEMES, faviconSvg, themeById } from '@/lib/themes';

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * La barra del navegador del teléfono toma el fondo del tema y el favicon, sus
 * colores (el pulso con el acento del tema). Con Ciruela queda el ícono original.
 */
function ThemeColorMeta() {
  const { theme } = useTheme();
  useEffect(() => {
    const t = themeById(theme);
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = t.background;

    const id = 'theme-favicon';
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (t.id === DEFAULT_THEME) {
      link?.remove();
      return;
    }
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'icon';
      link.type = 'image/svg+xml';
    }
    link.href = `data:image/svg+xml,${encodeURIComponent(faviconSvg(t))}`;
    // Al final del <head>: el navegador usa el último ícono declarado
    document.head.appendChild(link);
  }, [theme]);
  return null;
}

/**
 * Tema de color en el atributo data-theme del <html>. La elección se guarda en
 * este navegador (cada dispositivo puede tener el suyo).
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      themes={THEMES.map((t) => t.id)}
      defaultTheme={DEFAULT_THEME}
      enableSystem={false}
      storageKey="billedy-theme"
      disableTransitionOnChange
    >
      <ThemeColorMeta />
      {children}
    </NextThemesProvider>
  );
}
