'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log del error para debugging (solo en desarrollo)
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="mx-auto mt-8 flex max-w-sm flex-col items-center justify-center rounded-[28px] border border-line bg-surface p-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-coral-soft">
        <AlertCircle className="h-7 w-7 text-coral" />
      </div>
      <h2 className="text-xl font-extrabold tracking-[-0.02em]">Algo salió mal</h2>
      <p className="mt-2 text-muted-foreground text-center max-w-md">
        Hubo un error al cargar esta página. Por favor intenta de nuevo.
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-muted-foreground">
          Código: {error.digest}
        </p>
      )}
      <Button onClick={reset} className="mt-6 w-full">
        <RefreshCw className="mr-2 h-4 w-4" />
        Intentar de nuevo
      </Button>
    </div>
  );
}
