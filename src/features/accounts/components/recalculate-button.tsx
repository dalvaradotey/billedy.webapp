'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { recalculateAllAccountBalances } from '../actions';

interface RecalculateButtonProps {
  userId: string;
  onMutationStart: () => void;
  onMutationSuccess: (toastId: string | number, message: string) => void;
  onMutationError: (toastId: string | number, error: string) => void;
}

export function RecalculateButton({
  userId,
  onMutationStart,
  onMutationSuccess,
  onMutationError,
}: RecalculateButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleRecalculate = () => {
    const toastId = toast.loading('Recalculando saldos...');
    onMutationStart();

    startTransition(async () => {
      const result = await recalculateAllAccountBalances(userId);
      if (result.success) {
        onMutationSuccess(toastId, `${result.data.updated} cuentas actualizadas`);
      } else {
        onMutationError(toastId, result.error);
      }
    });
  };

  return (
    <Button
      variant="action"
      className="gap-2 flex-1 sm:flex-none"
      onClick={handleRecalculate}
      disabled={isPending}
    >
      <span className="sm:hidden">Recalcular</span>
      <span className="hidden sm:inline">Recalcular saldos</span>
      <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
    </Button>
  );
}
