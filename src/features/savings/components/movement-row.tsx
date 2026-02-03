'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatting';
import type { SavingsMovement } from '../types';

interface MovementRowProps {
  movement: SavingsMovement;
  currencyCode: string;
}

export function MovementRow({ movement, currencyCode }: MovementRowProps) {
  const isDeposit = movement.type === 'deposit';
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        {isDeposit ? (
          <TrendingUp className="h-3 w-3 text-green-600" />
        ) : (
          <TrendingDown className="h-3 w-3 text-red-600" />
        )}
        <span className="text-muted-foreground">{formatDate(movement.date)}</span>
        {movement.description && (
          <span className="text-muted-foreground">• {movement.description}</span>
        )}
      </div>
      <span className={isDeposit ? 'text-green-600' : 'text-red-600'}>
        {isDeposit ? '+' : '-'}
        {formatCurrency(movement.amount, currencyCode)}
      </span>
    </div>
  );
}
