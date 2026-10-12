import type { Metadata } from 'next';
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
