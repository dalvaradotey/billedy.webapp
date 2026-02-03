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
    <div className="flex flex-col items-center justify-center py-12">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold">Algo salió mal</h2>
      <p className="mt-2 text-muted-foreground text-center max-w-md">
        Hubo un error al cargar esta página. Por favor intenta de nuevo.
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-muted-foreground">
          Código: {error.digest}
        </p>
      )}
      <Button onClick={reset} className="mt-6">
        <RefreshCw className="mr-2 h-4 w-4" />
        Intentar de nuevo
      </Button>
    </div>
  );
}
