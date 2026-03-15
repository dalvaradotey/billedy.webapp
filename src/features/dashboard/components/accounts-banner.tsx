'use client';

import Link from 'next/link';
import { Wallet, TrendingUp, CreditCard, Scale, ArrowRight, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedCurrency } from '@/components/animated-currency';
import { formatCurrency } from '@/lib/formatting';
import { useDashboard } from '../hooks';

export function DashboardAccountsBanner() {
  const { accountsSummary, totalExternalDebt } = useDashboard();

  const totalPersonalDebt = accountsSummary.totalCreditBalance - totalExternalDebt;
  const personalNetWorth = accountsSummary.totalDebitBalance - totalPersonalDebt;
  const hasExternalDebt = totalExternalDebt > 0;
  const hasProvision = accountsSummary.totalProvisionBalance > 0;

  return (
    <div className="rounded-2xl bg-slate-800 dark:bg-slate-900 p-4 md:p-5">
      {/* Mobile Layout */}
      <div className="md:hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">Tus cuentas</p>
              <p className="text-slate-400 text-xs">
                {accountsSummary.totalAccounts} cuenta{accountsSummary.totalAccounts !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Button asChild variant="secondary" size="icon">
            <Link href="/dashboard/accounts">
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        {/* Row 1: Disponible + Deuda TC */}
        <div className="mt-4 flex justify-between">
          <div>
            <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Disponible
            </p>
            <AnimatedCurrency
              value={accountsSummary.totalDebitBalance}
              className="text-emerald-400 font-bold"
            />
          </div>
          <div className="text-right">
            <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1 justify-end">
              <CreditCard className="w-3 h-3" />
              Deuda TC
            </p>
            <AnimatedCurrency
              value={accountsSummary.totalCreditBalance}
              prefix="-"
              className="text-red-400 font-bold"
            />
            {hasExternalDebt && (
              <p className="text-slate-500 text-[10px] mt-0.5">
                Propia: {formatCurrency(totalPersonalDebt)} · Ext: {formatCurrency(totalExternalDebt)}
              </p>
            )}
          </div>
        </div>

        {/* Row 2: Patrimonio */}
        <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-slate-500 text-xs flex items-center gap-1">
              <Scale className="w-3 h-3" />
              {hasExternalDebt ? 'Saldo (sin/ext)' : 'Saldo'}
            </p>
            <AnimatedCurrency
              value={personalNetWorth}
              className={personalNetWorth >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}
            />
          </div>
          {hasProvision && (
            <div className="flex items-center justify-between">
              <p className="text-slate-500 text-xs flex items-center gap-1">
                <Landmark className="w-3 h-3" />
                Previsión
              </p>
              <AnimatedCurrency
                value={accountsSummary.totalProvisionBalance}
                className="text-violet-400 font-bold"
              />
            </div>
          )}
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex items-center gap-6">
        {/* Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-medium text-sm">Tus cuentas</p>
            <p className="text-slate-400 text-xs">
              {accountsSummary.totalAccounts} cuenta{accountsSummary.totalAccounts !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="w-px h-10 bg-slate-700" />

        {/* Cuentas */}
        <div className="flex flex-1 gap-8">
          <div>
            <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Disponible
            </p>
            <AnimatedCurrency
              value={accountsSummary.totalDebitBalance}
              className="text-emerald-400 font-bold"
            />
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1">
              <CreditCard className="w-3 h-3" />
              Deuda TC
            </p>
            <AnimatedCurrency
              value={accountsSummary.totalCreditBalance}
              prefix="-"
              className="text-red-400 font-bold"
            />
            {hasExternalDebt && (
              <p className="text-slate-500 text-[10px] mt-0.5">
                Propia: {formatCurrency(totalPersonalDebt)} · Ext: {formatCurrency(totalExternalDebt)}
              </p>
            )}
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1">
              <Scale className="w-3 h-3" />
              {hasExternalDebt ? 'Saldo (sin/ext)' : 'Saldo'}
            </p>
            <AnimatedCurrency
              value={personalNetWorth}
              className={personalNetWorth >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}
            />
          </div>
          {hasProvision && (
            <div>
              <p className="text-slate-500 text-xs mb-0.5 flex items-center gap-1">
                <Landmark className="w-3 h-3" />
                Previsión
              </p>
              <AnimatedCurrency
                value={accountsSummary.totalProvisionBalance}
                className="text-violet-400 font-bold"
              />
            </div>
          )}
        </div>

        <div className="w-px h-10 bg-slate-700" />

        {/* Botón */}
        <Link
          href="/dashboard/accounts"
          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
        >
          <ArrowRight className="w-4 h-4 text-white" />
        </Link>
      </div>
    </div>
  );
}
