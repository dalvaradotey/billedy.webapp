'use client';

import { signIn } from 'next-auth/react';
import {
  ArrowDownUp,
  CalendarClock,
  CreditCard,
  PiggyBank,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { BrandMark } from '@/components/layout/brand-mark';
import { PulseChart } from '@/components/pulse-chart';

/** Datos de ejemplo para la vista previa (no son de ningún usuario). */
const DEMO_POINTS = [12, 18, 18, 31, 35, 41, 43, 58, 64, 66, 75, 75, 92, 102, 106, 118, 139, 156].map((v, i) => ({
  day: i + 1,
  total: v * 5_000 + 180_000,
}));

const FEATURES: { icon: LucideIcon; tone: string; title: string; text: string }[] = [
  {
    icon: Wallet,
    tone: 'bg-jade-soft text-jade',
    title: 'Lo que te queda libre',
    text: 'El saldo del ciclo después de pagar la tarjeta y de ahorrar, y cuánto puedes gastar por día hasta el cierre.',
  },
  {
    icon: CreditCard,
    tone: 'bg-amber-soft text-amber',
    title: 'El ritmo de la tarjeta',
    text: 'Tu gasto propio contra el techo que definiste, con la proyección al cierre. Lo que es de otros o reembolsable no cuenta.',
  },
  {
    icon: PiggyBank,
    tone: 'bg-violet-soft text-violet',
    title: 'Fondos dentro de tus cuentas',
    text: 'Divide una cuenta corriente en fondos para el dentista, la mantención o lo que venga, y mira lo libre de verdad.',
  },
  {
    icon: CalendarClock,
    tone: 'bg-sky-soft text-sky',
    title: 'Ciclos, no meses',
    text: 'Todo se ordena de sueldo a sueldo. Cada ciclo cierra con su saldo y te avisa si algo no calza.',
  },
  {
    icon: ArrowDownUp,
    tone: 'bg-coral-soft text-coral',
    title: 'Registrar en segundos',
    text: 'Monto, una sugerencia de lo que ya registraste y listo. La categoría y la cuenta se completan solas.',
  },
  {
    icon: Target,
    tone: 'bg-rose-soft text-rose',
    title: 'Presupuestos con ritmo',
    text: 'Cada presupuesto marca dónde deberías ir hoy, para darte cuenta antes de que se agote.',
  },
];

export default function LandingPage() {
  const login = () => signIn('google', { callbackUrl: '/dashboard' });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
          <BrandMark />
          <button
            type="button"
            onClick={login}
            className="flex min-h-11 items-center rounded-full border border-line-strong bg-surface px-5 text-sm font-bold transition-colors hover:bg-surface-2"
          >
            Entrar
          </button>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 md:grid-cols-[1.05fr_1fr] md:px-8 md:pt-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-jade-soft px-3 py-1.5 text-xs font-bold text-jade-text">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-jade" />
              Finanzas personales para el día a día
            </span>
            <h1 className="mt-5 text-[44px] font-extrabold leading-[1.02] tracking-[-0.045em] md:text-[64px]">
              Tu plata,
              <br />
              a buen ritmo.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
              Billedy reemplaza la planilla: te dice cuánto te queda libre en el ciclo, a qué ritmo gastas con la
              tarjeta y qué viene antes del próximo sueldo.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={login}
                className="flex min-h-14 items-center justify-center gap-2.5 rounded-full bg-jade px-7 text-base font-extrabold text-jade-ink transition-opacity hover:opacity-90"
              >
                <GoogleIcon />
                Empezar con Google
              </button>
              <a
                href="#funciones"
                className="flex min-h-14 items-center justify-center rounded-full px-6 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
              >
                Ver qué hace
              </a>
            </div>
          </div>

          {/* Vista previa con datos de ejemplo */}
          <div aria-label="Vista previa de Billedy con datos de ejemplo" className="rounded-[28px] border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Te quedan libres</span>
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-muted-foreground">ejemplo</span>
            </div>
            <p className="num mt-1 text-[44px] font-extrabold leading-none">$356.775</p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              ≈ <span className="num font-bold text-foreground">$27.444</span> por día hasta el cierre
            </p>
            <div className="mt-5 rounded-[22px] bg-background p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Ritmo de la tarjeta</span>
                <span className="num text-lg font-extrabold text-amber">$273.843 libres</span>
              </div>
              <div className="mt-3">
                <PulseChart
                  points={DEMO_POINTS}
                  daysTotal={31}
                  cap={1_142_000}
                  baseline={180_000}
                  projection={1_302_931}
                  startLabel="25 sep"
                  midLabel="10 oct"
                  endLabel="25 oct"
                  todayLabel="12 oct"
                  height={170}
                  ariaLabel="Ejemplo: gasto con tarjeta acumulado contra el techo"
                />
              </div>
            </div>
          </div>
        </section>

        <section id="funciones" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20 md:px-8">
          <h2 className="text-[28px] font-extrabold tracking-[-0.035em] md:text-[36px]">Lo que hace por ti</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <article key={f.title} className="rounded-[24px] border border-line bg-surface p-5">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-[13px] ${f.tone}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-extrabold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-5 rounded-[28px] bg-jade p-6 text-jade-ink md:flex-row md:items-center md:p-8">
            <div>
              <h2 className="text-2xl font-extrabold tracking-[-0.03em] md:text-[28px]">Deja la planilla hoy.</h2>
              <p className="mt-1 text-sm font-semibold opacity-80">Entra con tu cuenta de Google y arma tu primer ciclo.</p>
            </div>
            <button
              type="button"
              onClick={login}
              className="flex min-h-12 items-center gap-2.5 rounded-full bg-jade-ink px-6 text-sm font-extrabold text-jade-text"
            >
              Empezar
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-faint md:flex-row md:px-8">
          <BrandMark className="opacity-70" />
          <span>© {new Date().getFullYear()} Billedy</span>
        </div>
      </footer>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
