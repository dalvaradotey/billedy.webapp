import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { SessionProvider } from '@/components/providers/session-provider';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
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
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
