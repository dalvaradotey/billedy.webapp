"use client";

export function HeroVisual() {
  return (
    <div className="relative w-full h-[200px] sm:h-[280px] lg:h-[500px]">
      {/* Glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 lg:w-64 h-40 lg:h-64 bg-blue-500/30 rounded-full blur-[60px] lg:blur-[80px]" />
      <div className="absolute top-1/3 right-1/4 w-20 lg:w-32 h-20 lg:h-32 bg-emerald-500/30 rounded-full blur-[40px] lg:blur-[60px]" />

      {/* Main balance card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 sm:w-56 lg:w-72 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-2xl border border-slate-700/50 animate-float-card">
        <p className="text-slate-400 text-[10px] sm:text-xs lg:text-sm mb-0.5 sm:mb-1">Balance total</p>
        <p className="text-lg sm:text-xl lg:text-3xl font-bold text-white mb-1 sm:mb-2 lg:mb-4">$12,450.00</p>
        <div className="flex items-center gap-1 sm:gap-2 text-emerald-400 text-[10px] sm:text-xs lg:text-sm">
          <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <span>+12.5% este mes</span>
        </div>

        {/* Mini chart */}
        <div className="mt-2 sm:mt-3 lg:mt-4 flex items-end gap-0.5 sm:gap-1 h-6 sm:h-8 lg:h-12">
          {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-gradient-to-t from-blue-500 to-emerald-500 rounded-sm opacity-80"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>

      {/* Income card - floating top right */}
      <div className="absolute top-0 sm:top-2 lg:top-8 right-2 sm:right-4 lg:right-8 bg-emerald-500 rounded-lg lg:rounded-xl p-1.5 sm:p-2 lg:p-4 shadow-xl shadow-emerald-500/30 animate-float-card-delayed scale-[0.65] sm:scale-85 lg:scale-100 origin-top-right">
        <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
          <div className="w-6 sm:w-8 lg:w-10 h-6 sm:h-8 lg:h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <svg className="w-3 sm:w-4 lg:w-5 h-3 sm:h-4 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="text-emerald-100 text-[9px] sm:text-[10px] lg:text-xs">Ingreso</p>
            <p className="text-white font-bold text-xs sm:text-sm lg:text-base">+$2,500</p>
          </div>
        </div>
      </div>

      {/* Expense card - floating bottom left */}
      <div className="absolute bottom-0 sm:bottom-4 lg:bottom-12 left-2 sm:left-4 lg:left-8 bg-white dark:bg-slate-800 rounded-lg lg:rounded-xl p-1.5 sm:p-2 lg:p-4 shadow-xl border border-slate-200 dark:border-slate-700 animate-float-card-slow scale-[0.65] sm:scale-85 lg:scale-100 origin-bottom-left">
        <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
          <div className="w-6 sm:w-8 lg:w-10 h-6 sm:h-8 lg:h-10 bg-red-100 dark:bg-red-900/50 rounded-lg flex items-center justify-center">
            <svg className="w-3 sm:w-4 lg:w-5 h-3 sm:h-4 lg:h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-[9px] sm:text-[10px] lg:text-xs">Gasto</p>
            <p className="text-slate-900 dark:text-white font-bold text-xs sm:text-sm lg:text-base">-$890</p>
          </div>
        </div>
      </div>

      {/* Budget progress - floating top left (hidden on small mobile) */}
      <div className="absolute top-4 sm:top-8 lg:top-16 left-0 sm:left-4 lg:left-16 bg-white dark:bg-slate-800 rounded-lg lg:rounded-xl p-2 sm:p-3 lg:p-4 shadow-xl border border-slate-200 dark:border-slate-700 animate-float-card-reverse scale-75 sm:scale-90 lg:scale-100 origin-top-left hidden sm:block">
        <p className="text-slate-500 dark:text-slate-400 text-[10px] lg:text-xs mb-1 lg:mb-2">Presupuesto</p>
        <div className="flex items-center gap-2">
          <div className="w-16 lg:w-24 h-1.5 lg:h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="w-3/4 h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full" />
          </div>
          <span className="text-[10px] lg:text-xs font-medium text-slate-700 dark:text-slate-300">75%</span>
        </div>
      </div>

      {/* Savings goal - floating bottom right (hidden on small mobile) */}
      <div className="absolute bottom-8 sm:bottom-12 lg:bottom-20 right-0 sm:right-4 lg:right-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg lg:rounded-xl p-2 sm:p-3 lg:p-4 shadow-xl shadow-blue-500/30 animate-float-card-delayed scale-75 sm:scale-90 lg:scale-100 origin-bottom-right hidden sm:block">
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="w-8 lg:w-10 h-8 lg:h-10 bg-white/20 rounded-full flex items-center justify-center">
            <span className="text-sm lg:text-lg">🎯</span>
          </div>
          <div>
            <p className="text-blue-100 text-[10px] lg:text-xs">Meta de ahorro</p>
            <p className="text-white font-bold text-xs lg:text-sm">$3,200 / $5,000</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes floatCard {
          0%, 100% { transform: translate(-50%, -50%) translateY(0); }
          50% { transform: translate(-50%, -50%) translateY(-10px); }
        }
        @keyframes floatCardDelayed {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes floatCardSlow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes floatCardReverse {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }
        .animate-float-card {
          animation: floatCard 4s ease-in-out infinite;
        }
        .animate-float-card-delayed {
          animation: floatCardDelayed 5s ease-in-out infinite;
          animation-delay: 1s;
        }
        .animate-float-card-slow {
          animation: floatCardSlow 6s ease-in-out infinite;
          animation-delay: 2s;
        }
        .animate-float-card-reverse {
          animation: floatCardReverse 4.5s ease-in-out infinite;
          animation-delay: 0.5s;
        }
      `}</style>
    </div>
  );
}
