import type { MetadataRoute } from 'next';

/** Para "Agregar a pantalla de inicio": se abre como app, sin la barra del navegador */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Billedy',
    short_name: 'billedy',
    description: 'Gestión financiera personal',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#15121A',
    theme_color: '#15121A',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
