'use client';

import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProcessingStatus = 'loading' | 'success' | null;

interface ProcessingOverlayProps {
  status: ProcessingStatus;
  loadingText?: string;
  successText?: string;
}

/**
 * ProcessingOverlay - Overlay bloqueante para mostrar estados de carga y éxito
 *
 * Flujo típico:
 * 1. status='loading' - Muestra spinner con animación
 * 2. status='success' - Muestra checkmark con animación de éxito
 * 3. status=null - Oculta el overlay
 */
export function ProcessingOverlay({
  status,
  loadingText,
  successText,
}: ProcessingOverlayProps) {
  if (!status) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm overflow-hidden">
      {status === 'loading' ? (
        <LoadingContent text={loadingText} />
      ) : (
        <SuccessContent text={successText} />
      )}
    </div>
  );
}

function LoadingContent({ text }: { text?: string }) {
  return (
    <>
      {/* Partículas flotantes suaves para loading */}
      <div
        className="absolute w-20 h-20 rounded-full bg-sky/15 blur-xl animate-float-slow"
        style={{ top: '20%', left: '20%' }}
      />
      <div
        className="absolute w-16 h-16 rounded-full bg-jade/15 blur-xl animate-float-slow"
        style={{ top: '60%', right: '25%', animationDelay: '1s' }}
      />
      <div
        className="absolute w-14 h-14 rounded-full bg-sky-soft blur-lg animate-float-slow"
        style={{ bottom: '30%', left: '30%', animationDelay: '0.5s' }}
      />

      {/* Spinner central */}
      <div className="flex flex-col items-center gap-4 relative">
        <div className="relative">
          {/* Anillo exterior pulsante */}
          <div className="absolute inset-0 rounded-full border-2 border-jade/30 animate-ping" />
          {/* Contenedor del spinner */}
          <div className="rounded-full bg-jade p-4 text-jade-ink">
            <Loader2 className="size-10 text-jade-ink animate-spin" />
          </div>
        </div>
        {text && (
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            {text}
          </p>
        )}
      </div>
    </>
  );
}

function SuccessContent({ text }: { text?: string }) {
  return (
    <>
      {/* Partículas de éxito que explotan */}
      <div
        className="absolute w-16 h-16 rounded-full bg-jade/25 blur-xl animate-success-particle"
        style={{ '--tx': '-80px', '--ty': '-60px' } as React.CSSProperties}
      />
      <div
        className="absolute w-20 h-20 rounded-full bg-sky/20 blur-xl animate-success-particle"
        style={{ '--tx': '90px', '--ty': '-50px', animationDelay: '0.1s' } as React.CSSProperties}
      />
      <div
        className="absolute w-14 h-14 rounded-full bg-jade/30 blur-lg animate-success-particle"
        style={{ '--tx': '-70px', '--ty': '80px', animationDelay: '0.15s' } as React.CSSProperties}
      />
      <div
        className="absolute w-18 h-18 rounded-full bg-jade-soft blur-xl animate-success-particle"
        style={{ '--tx': '100px', '--ty': '60px', animationDelay: '0.2s' } as React.CSSProperties}
      />
      <div
        className="absolute w-12 h-12 rounded-full bg-sky/30 blur-lg animate-success-particle"
        style={{ '--tx': '0px', '--ty': '-100px', animationDelay: '0.05s' } as React.CSSProperties}
      />
      <div
        className="absolute w-16 h-16 rounded-full bg-jade-soft blur-xl animate-success-particle"
        style={{ '--tx': '-110px', '--ty': '0px', animationDelay: '0.25s' } as React.CSSProperties}
      />

      {/* Anillos de pulso */}
      <div className="absolute rounded-full border-2 border-jade/40 w-24 h-24 animate-pulse-ring" />
      <div
        className="absolute rounded-full border-2 border-jade/30 w-24 h-24 animate-pulse-ring"
        style={{ animationDelay: '0.2s' }}
      />

      {/* Checkmark */}
      <div className="flex flex-col items-center gap-3 relative">
        <div className="rounded-full bg-jade p-4 text-jade-ink animate-scale-in">
          <Check className="size-10 text-jade-ink" />
        </div>
        {text && (
          <p className="text-sm font-medium text-foreground animate-fade-in">
            {text}
          </p>
        )}
      </div>
    </>
  );
}
