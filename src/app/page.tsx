"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Logo } from "@/components/logo";
import { TypingText, GradientButton, ShimmerText, HeroVisual } from "@/features/landing";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const budgets = [
  { name: "Alimentación", percent: 75, color: "bg-white" },
  { name: "Transporte", percent: 45, color: "bg-white" },
  { name: "Entretenimiento", percent: 120, color: "bg-amber-400", exceeded: true },
];
// import { FloatingCard } from "@/components/landing"; // Para versión Bento Grid

function SavingsGoal() {
  const [amount, setAmount] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const goal = 5000;

  useEffect(() => {
    const runAnimation = () => {
      const interval = setInterval(() => {
        setAmount((prev) => {
          if (prev >= goal) {
            clearInterval(interval);
            setShowCelebration(true);
            // Reset after 2 seconds and start again
            setTimeout(() => {
              setShowCelebration(false);
              setAmount(0);
            }, 2000);
            return goal;
          }
          return prev + 100;
        });
      }, 120);
    };

    runAnimation();
    // Repeat the entire cycle every 10 seconds
    const cycleInterval = setInterval(runAnimation, 10000);
    return () => clearInterval(cycleInterval);
  }, []);

  return (
    <div className={`flex items-center gap-3 transition-all duration-300 ${showCelebration ? "scale-105" : ""}`}>
      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
        {showCelebration ? "🎉" : "🎯"}
      </div>
      <div>
        <p className="text-emerald-200 text-sm">Meta de viaje</p>
        <p className={`font-bold transition-all duration-300 tabular-nums ${
          showCelebration ? "text-white scale-105" : "text-white"
        }`}>
          <span className="inline-block w-14 text-right">${amount.toLocaleString()}</span> / ${goal.toLocaleString()}
          {showCelebration && <span className="ml-2 text-sm">¡Completada!</span>}
        </p>
      </div>
    </div>
  );
}

function BudgetSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % budgets.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative h-12 overflow-hidden">
        {budgets.map((b, i) => (
          <div
            key={b.name}
            className={`absolute inset-0 transition-all duration-500 ease-in-out ${
              i === currentIndex
                ? "opacity-100 translate-y-0"
                : i < currentIndex
                ? "opacity-0 -translate-y-full"
                : "opacity-0 translate-y-full"
            }`}
          >
            <div className="flex justify-between text-sm mb-2">
              <span className="text-blue-200">{b.name}</span>
              <span className={`font-medium flex items-center gap-1.5 ${b.exceeded ? "text-amber-300" : "text-white"}`}>
                {b.percent}%
                {b.exceeded && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/30 text-amber-200 rounded-full">
                    Excedido
                  </span>
                )}
              </span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${b.color}`}
                style={{ width: `${Math.min(b.percent, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {/* Dots indicator */}
      <div className="flex justify-center gap-1.5 pt-1">
        {budgets.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              i === currentIndex ? "bg-white w-4" : "bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        {/* Glows grandes */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/20 rounded-full blur-[128px] animate-float" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-emerald-500/20 rounded-full blur-[128px] animate-float-delayed" />

        {/* Partículas flotantes en toda la página */}
        <div className="absolute w-24 h-24 rounded-full bg-blue-500/25 blur-xl top-[8%] left-[8%] animate-particle-1" />
        <div className="absolute w-36 h-36 rounded-full bg-emerald-500/20 blur-xl top-[12%] right-[12%] animate-particle-2" />
        <div className="absolute w-20 h-20 rounded-full bg-blue-500/30 blur-lg top-[25%] left-[5%] animate-particle-3" />
        <div className="absolute w-28 h-28 rounded-full bg-emerald-500/25 blur-xl top-[20%] right-[25%] animate-particle-4" />
        <div className="absolute w-32 h-32 rounded-full bg-blue-500/20 blur-xl top-[35%] left-[15%] animate-particle-5" />
        <div className="absolute w-24 h-24 rounded-full bg-emerald-500/30 blur-lg top-[40%] right-[8%] animate-particle-6" />
        <div className="absolute w-20 h-20 rounded-full bg-blue-500/25 blur-xl top-[50%] left-[3%] animate-particle-7" />
        <div className="absolute w-36 h-36 rounded-full bg-emerald-500/20 blur-xl top-[55%] right-[15%] animate-particle-8" />
        <div className="absolute w-28 h-28 rounded-full bg-blue-500/20 blur-xl top-[65%] left-[20%] animate-particle-1" />
        <div className="absolute w-24 h-24 rounded-full bg-emerald-500/25 blur-lg top-[70%] right-[5%] animate-particle-3" />
        <div className="absolute w-20 h-20 rounded-full bg-blue-500/30 blur-xl top-[78%] left-[10%] animate-particle-5" />
        <div className="absolute w-32 h-32 rounded-full bg-emerald-500/20 blur-xl top-[85%] right-[20%] animate-particle-7" />
        <div className="absolute w-24 h-24 rounded-full bg-blue-500/25 blur-lg top-[90%] left-[40%] animate-particle-2" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-6xl mx-auto py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-tl from-emerald-500 to-blue-600 [color:white]">
              <Logo className="h-8 w-auto" />
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              Billedy
            </span>
          </div>

          {/* Botón Entrar que abre drawer */}
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerTrigger className="group text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1">
              Entrar
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle className="text-center">Iniciar sesión</DrawerTitle>
              </DrawerHeader>
              <div className="p-6 pt-2 pb-10 flex flex-col items-center gap-4">
                <p className="text-center text-sm text-slate-600 dark:text-slate-400 mb-2">
                  Inicia sesión para acceder a tu cuenta
                </p>
                <button
                  onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                  className="w-full max-w-xs flex items-center justify-center gap-3 py-3 px-4 font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continuar con Google
                </button>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6 relative" style={{ zIndex: 1 }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Text content */}
            <div>
              <div className="inline-block px-3 py-1 mb-6 text-xs font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 rounded-full">
                <TypingText
                  texts={[
                    "Finanzas personales sin complicaciones",
                    "Tu dinero, tu control",
                    "Simple, rápido y efectivo",
                  ]}
                  typingSpeed={80}
                  pauseDuration={3000}
                />
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white leading-[1.1] tracking-tight">
                Deja el Excel.<br />
                <ShimmerText className="text-4xl md:text-5xl lg:text-6xl font-bold">
                  Toma el control.
                </ShimmerText>
              </h1>

              <p className="mt-6 text-lg text-slate-600 dark:text-slate-300 max-w-xl">
                Billedy te ayuda a organizar ingresos, gastos, presupuestos y ahorros
                en un solo lugar. Simple, rápido y diseñado para tu día a día.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-3">
                <GradientButton onClick={() => setDrawerOpen(true)}>
                  Comenzar ahora
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </GradientButton>
                <Link
                  href="#como-funciona"
                  className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors group"
                >
                  Ver cómo funciona
                  <svg className="ml-2 w-4 h-4 group-hover:translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Visual - desktop only */}
            <div className="hidden lg:block">
              <HeroVisual />
            </div>

            {/* Mobile glow effect */}
            <div className="lg:hidden absolute left-1/2 -translate-x-1/2 top-[320px] w-72 h-40 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/40 via-emerald-500/40 to-blue-500/40 rounded-full blur-[80px] animate-glow-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid - Versión Original (comentada)
      <section id="como-funciona" className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-4">
            <FloatingCard className="md:col-span-2">
              <div className="h-full p-8 bg-gradient-to-br from-blue-50 via-white to-emerald-50 dark:from-slate-800 dark:via-slate-800/80 dark:to-slate-800 rounded-2xl border border-blue-100 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Ingresos y gastos</h3>
                </div>
                <p className="text-slate-600 dark:text-slate-300 mb-6">Registra cada movimiento en segundos. Categoriza automáticamente y mantén un historial claro de a dónde va tu dinero.</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 rounded-full animate-pulse-subtle">+$2,500</span>
                  <span className="px-3 py-1 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded-full">-$890</span>
                  <span className="px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded-full">Alimentación</span>
                </div>
              </div>
            </FloatingCard>
            <FloatingCard>
              <div className="h-full p-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl text-white shadow-xl shadow-blue-500/30">
                <div className="w-10 h-10 rounded-xl bg-white/25 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">Presupuestos</h3>
                <p className="text-blue-100 text-sm">Define límites mensuales y recibe alertas antes de pasarte.</p>
              </div>
            </FloatingCard>
            <FloatingCard>
              <div className="h-full p-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl text-white shadow-xl shadow-emerald-500/30">
                <div className="w-10 h-10 rounded-xl bg-white/25 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">Fondos de ahorro</h3>
                <p className="text-emerald-100 text-sm">Crea metas y visualiza tu progreso hacia cada objetivo.</p>
              </div>
            </FloatingCard>
            <FloatingCard className="md:col-span-2">
              <div className="h-full p-8 bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl text-white shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold">Todas tus cuentas en un lugar</h3>
                </div>
                <p className="text-slate-300 mb-6">Banco, efectivo, billeteras digitales, tarjetas de crédito. Consolida todo y ve tu situación financiera real.</p>
                <div className="flex flex-wrap gap-3">
                  <div className="px-4 py-2 bg-slate-600/50 rounded-lg text-sm"><span className="text-slate-400 text-xs block">Banco</span><span className="font-medium text-white">$4,250</span></div>
                  <div className="px-4 py-2 bg-slate-600/50 rounded-lg text-sm"><span className="text-slate-400 text-xs block">Efectivo</span><span className="font-medium text-white">$320</span></div>
                  <div className="px-4 py-2 bg-slate-600/50 rounded-lg text-sm"><span className="text-slate-400 text-xs block">Crédito</span><span className="font-medium text-red-400">-$1,200</span></div>
                </div>
              </div>
            </FloatingCard>
          </div>
        </div>
      </section>
      */}

      {/* Bento Grid */}
      <section id="como-funciona" className="py-20 px-6 relative" style={{ zIndex: 1 }}>
        <div className="max-w-5xl mx-auto relative">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Todo lo que necesitas
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-lg">
              Herramientas simples pero poderosas para tomar el control de tu dinero
            </p>
          </div>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Ingresos y gastos - Grande (2x2) */}
            <div className="col-span-2 row-span-2 group relative rounded-3xl p-[3px] animated-gradient-border">
              <div className="h-full bg-slate-900 rounded-[22px] p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white">Ingresos y gastos</h3>
                </div>
                <p className="text-slate-400 text-base mb-4 flex-1">
                  Registra cada movimiento. Categoriza y visualiza a dónde va tu dinero.
                </p>
                {/* Visual de barras */}
                <div className="flex items-end gap-1.5 h-20 mt-auto">
                  {[40, 65, 45, 80, 55, 90, 70, 85, 60].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                {/* Tags */}
                <div className="flex gap-2 mt-4">
                  <span className="px-2 py-1 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-full">+$2,500</span>
                  <span className="px-2 py-1 text-xs font-medium bg-red-500/20 text-red-400 rounded-full">-$890</span>
                </div>
              </div>
            </div>

            {/* Presupuestos - Mediano (2x1) */}
            <div className="col-span-2 group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-blue-700 p-5">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-white">Presupuestos</h3>
                </div>
                <p className="text-blue-100 text-sm mb-3">Define límites y recibe alertas antes de pasarte.</p>
                <BudgetSlider />
              </div>
            </div>

            {/* Fondos de ahorro - Mediano (2x1) */}
            <div className="col-span-2 group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-5">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-white">Fondos de ahorro</h3>
                </div>
                <p className="text-emerald-100 text-sm mb-3">Crea metas y visualiza tu progreso.</p>
                <SavingsGoal />
              </div>
            </div>

            {/* Cuentas - Barra horizontal */}
            <div className="col-span-2 md:col-span-4 rounded-2xl bg-slate-800 p-4 md:p-5">
              <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                {/* Info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">Tus cuentas</p>
                    <p className="text-slate-400 text-xs">Todo en un lugar</p>
                  </div>
                </div>
                {/* Separador */}
                <div className="hidden md:block w-px h-10 bg-slate-700" />
                {/* Cuentas */}
                <div className="flex flex-1 justify-between md:justify-start gap-4 md:gap-8">
                  <div className="text-center md:text-left">
                    <p className="text-slate-500 text-xs mb-0.5">Banco</p>
                    <p className="text-white font-bold">$4,250</p>
                  </div>
                  <div className="text-center md:text-left">
                    <p className="text-slate-500 text-xs mb-0.5">Efectivo</p>
                    <p className="text-white font-bold">$320</p>
                  </div>
                  <div className="text-center md:text-left">
                    <p className="text-slate-500 text-xs mb-0.5">Crédito</p>
                    <p className="text-red-400 font-bold">-$1,200</p>
                  </div>
                </div>
                {/* Total */}
                <div className="hidden md:block w-px h-10 bg-slate-700" />
                <div className="hidden md:block text-right">
                  <p className="text-slate-500 text-xs mb-0.5">Balance total</p>
                  <p className="text-emerald-400 font-bold">$3,370</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-6 relative" style={{ zIndex: 1 }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Empieza hoy, es gratis
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mb-8">
            Sin tarjeta de crédito. Sin compromisos. Solo tú y tus finanzas.
          </p>
          <GradientButton onClick={() => setDrawerOpen(true)}>
            Crear mi cuenta
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </GradientButton>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-200 dark:border-slate-800 relative" style={{ zIndex: 1 }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <div className="text-slate-300 dark:text-slate-400">
              <Logo className="h-8 w-auto" />
            </div>
            <span>Billedy {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Privacidad
            </Link>
            <Link href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Términos
            </Link>
          </div>
        </div>
      </footer>

      {/* Global animations */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.05); }
        }
        .animate-float {
          animation: float 8s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float 8s ease-in-out infinite;
          animation-delay: 4s;
        }
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
        @keyframes glow-pulse {
          0%, 100% {
            opacity: 0.6;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.2);
          }
        }
        .animate-glow-pulse {
          animation: glow-pulse 3s ease-in-out infinite;
        }
        .animated-gradient-border {
          background: linear-gradient(
            90deg,
            #3b82f6,
            #10b981,
            #3b82f6,
            #10b981,
            #3b82f6
          );
          background-size: 200% 100%;
          animation: gradient-flow 12s ease-in-out infinite;
        }
        @keyframes gradient-flow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        /* Partículas animadas */
        .animate-particle-1 { animation: particle-float-1 8s ease-in-out infinite; }
        .animate-particle-2 { animation: particle-float-2 10s ease-in-out infinite; }
        .animate-particle-3 { animation: particle-float-3 7s ease-in-out infinite; }
        .animate-particle-4 { animation: particle-float-4 9s ease-in-out infinite; }
        .animate-particle-5 { animation: particle-float-5 8s ease-in-out infinite; }
        .animate-particle-6 { animation: particle-float-6 11s ease-in-out infinite; }
        .animate-particle-7 { animation: particle-float-7 10s ease-in-out infinite; }
        .animate-particle-8 { animation: particle-float-8 9s ease-in-out infinite; }

        @keyframes particle-float-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(60px, -30px) scale(1.1); }
          50% { transform: translate(80px, -80px) scale(1); }
          75% { transform: translate(40px, -50px) scale(0.9); }
        }
        @keyframes particle-float-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(-50px, 40px) scale(0.9); }
          50% { transform: translate(-100px, 60px) scale(1.1); }
          75% { transform: translate(-60px, 30px) scale(1); }
        }
        @keyframes particle-float-3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(50px, 70px) scale(1.15); }
          66% { transform: translate(30px, 40px) scale(0.85); }
        }
        @keyframes particle-float-4 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(-70px, -40px) scale(1.1); }
          50% { transform: translate(-90px, -90px) scale(0.95); }
          75% { transform: translate(-50px, -60px) scale(1.05); }
        }
        @keyframes particle-float-5 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(60px, 80px) scale(1.2); }
        }
        @keyframes particle-float-6 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-60px, -70px) scale(0.9); }
          66% { transform: translate(-40px, -30px) scale(1.1); }
        }
        @keyframes particle-float-7 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(70px, 30px) scale(1.05); }
          50% { transform: translate(100px, 50px) scale(1.15); }
          75% { transform: translate(50px, 40px) scale(0.95); }
        }
        @keyframes particle-float-8 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-50px, 60px) scale(1.1); }
        }
        `}</style>
    </div>
  );
}
