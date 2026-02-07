'use client';

import { AlertTriangle, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/formatting';
import type { DebtCapacityReport } from '../types';

interface DebtCapacityCardProps {
  report: DebtCapacityReport;
}

export function DebtCapacityCard({ report }: DebtCapacityCardProps) {
  if (report.maxInstallmentAmount === null) {
    return null; // No mostrar si no hay límite configurado
  }

  const getStatusColor = () => {
    if (report.isOverLimit) return 'text-destructive';
    if (report.usedPercentage >= 80) return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  return (
    <Card className={report.isOverLimit ? 'border-destructive' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            Capacidad de Endeudamiento
            {report.isOverLimit && (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            )}
          </CardTitle>
          <span className={`text-lg font-bold ${getStatusColor()}`}>
            {report.usedPercentage}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Progress
            value={Math.min(report.usedPercentage, 100)}
            className="h-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Cargo mensual: {formatCurrency(report.personalDebt)}</span>
            <span>Límite: {formatCurrency(report.maxInstallmentAmount)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground block">Disponible</span>
            <span className={`font-medium ${report.isOverLimit ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {report.isOverLimit
                ? `-${formatCurrency(report.personalDebt - report.maxInstallmentAmount)}`
                : formatCurrency(report.availableCapacity)}
            </span>
          </div>
          {report.externalDebt > 0 && (
            <div>
              <span className="text-muted-foreground block flex items-center gap-1">
                <Users className="h-3 w-3" />
                Cuotas externas
              </span>
              <span className="font-medium">
                {formatCurrency(report.externalDebt)}
              </span>
            </div>
          )}
        </div>

        {report.isOverLimit && (
          <div className="bg-destructive/10 text-destructive text-xs p-2 rounded flex items-center gap-2">
            <AlertTriangle className="h-3 w-3" />
            Has excedido tu límite mensual de cuotas
          </div>
        )}
      </CardContent>
    </Card>
  );
}
