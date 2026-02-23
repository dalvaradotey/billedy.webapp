'use client';

import Link from 'next/link';
import { Wallet, TrendingUp, CreditCard, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatting';
import type { AccountsSummary } from '../types';

interface AccountsSummaryBannerProps {
  summary: AccountsSummary;
}

export function AccountsSummaryBanner({ summary }: AccountsSummaryBannerProps) {
  return (
    <div className="rounded-2xl bg-slate-800 dark:bg-slate-900 p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        {/* Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-medium text-sm">Tus cuentas</p>
            <p className="text-slate-400 text-xs">{summary.totalAccounts} cuenta{summary.totalAccounts !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Separador */}
        <div className="hidden md:block w-px h-10 bg-slate-700" />

        {/* Cuentas */}
        <div className="flex flex-1 justify-between md:justify-start gap-4 md:gap-8">
          <div className="text-center md:text-left">
            <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1 justify-center md:justify-start">
              <TrendingUp className="w-3 h-3" />
              Disponible
            </p>
            <p className="text-emerald-400 font-bold">{formatCurrency(summary.totalDebitBalance)}</p>
          </div>
          <div className="text-center md:text-left">
            <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1 justify-center md:justify-start">
              <CreditCard className="w-3 h-3" />
              Deuda TC
            </p>
            <p className="text-red-400 font-bold">-{formatCurrency(summary.totalCreditBalance)}</p>
          </div>
        </div>

        {/* Link desktop */}
        <div className="hidden md:block w-px h-10 bg-slate-700" />
        <Link
          href="/dashboard/accounts"
          className="hidden md:flex p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
        >
          <ArrowRight className="w-4 h-4 text-white" />
        </Link>

        {/* Link móvil */}
        <Link
          href="/dashboard/accounts"
          className="md:hidden flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-white text-sm"
        >
          Ver cuentas
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
