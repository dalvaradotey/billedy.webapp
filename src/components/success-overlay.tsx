'use client';

import { Check } from 'lucide-react';

interface SuccessOverlayProps {
  show: boolean;
}

export function SuccessOverlay({ show }: SuccessOverlayProps) {
  if (!show) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm overflow-hidden">
      {/* Floating particles */}
      <div
        className="absolute w-16 h-16 rounded-full bg-emerald-500/30 blur-xl animate-success-particle"
        style={{ '--tx': '-80px', '--ty': '-60px' } as React.CSSProperties}
      />
      <div
        className="absolute w-20 h-20 rounded-full bg-blue-500/25 blur-xl animate-success-particle"
        style={{ '--tx': '90px', '--ty': '-50px', animationDelay: '0.1s' } as React.CSSProperties}
      />
      <div
        className="absolute w-14 h-14 rounded-full bg-emerald-400/35 blur-lg animate-success-particle"
        style={{ '--tx': '-70px', '--ty': '80px', animationDelay: '0.15s' } as React.CSSProperties}
      />
      <div
        className="absolute w-18 h-18 rounded-full bg-teal-500/25 blur-xl animate-success-particle"
        style={{ '--tx': '100px', '--ty': '60px', animationDelay: '0.2s' } as React.CSSProperties}
      />
      <div
        className="absolute w-12 h-12 rounded-full bg-cyan-400/30 blur-lg animate-success-particle"
        style={{ '--tx': '0px', '--ty': '-100px', animationDelay: '0.05s' } as React.CSSProperties}
      />
      <div
        className="absolute w-16 h-16 rounded-full bg-green-500/25 blur-xl animate-success-particle"
        style={{ '--tx': '-110px', '--ty': '0px', animationDelay: '0.25s' } as React.CSSProperties}
      />

      {/* Pulse rings */}
      <div className="absolute rounded-full border-2 border-emerald-500/40 w-24 h-24 animate-pulse-ring" />
      <div
        className="absolute rounded-full border-2 border-emerald-400/30 w-24 h-24 animate-pulse-ring"
        style={{ animationDelay: '0.2s' }}
      />

      {/* Checkmark */}
      <div className="flex flex-col items-center gap-3 relative">
        <div className="rounded-full bg-emerald-500 p-4 animate-scale-in shadow-lg shadow-emerald-500/30">
          <Check className="size-10 text-white" />
        </div>
      </div>
    </div>
  );
}
