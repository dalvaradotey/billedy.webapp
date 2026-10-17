import type { Metadata, Viewport } from 'next';
import { Geist_Mono, Manrope } from 'next/font/google';
import { SessionProvider } from '@/components/providers/session-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Billedy - Gestión Financiera Personal',
  description:
    'Aplicación web de gestión financiera personal. Controla tus ingresos, gastos, presupuestos y ahorros.',
  appleWebApp: { capable: true, title: 'billedy', statusBarStyle: 'black' },
};

/** Barra del navegador del color de la app en el teléfono */
export const viewport: Viewport = {
  themeColor: '#15121A',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body
        className={`${manrope.variable} ${geistMono.variable} antialiased font-sans`}
      >
        <ThemeProvider>
          <SessionProvider>{children}</SessionProvider>
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
