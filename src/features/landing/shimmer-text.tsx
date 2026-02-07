"use client";

import { type ReactNode } from "react";

interface ShimmerTextProps {
  children: ReactNode;
  className?: string;
}

export function ShimmerText({ children, className = "" }: ShimmerTextProps) {
  return (
    <span
      className={`
        relative inline-block bg-clip-text text-transparent
        bg-gradient-to-r from-slate-500 via-slate-300 to-slate-500
        dark:from-slate-400 dark:via-white dark:to-slate-400
        bg-[length:200%_100%] animate-shimmer
        ${className}
      `}
    >
      {children}
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 100% 50%; }
          100% { background-position: -100% 50%; }
        }
        .animate-shimmer {
          animation: shimmer 3s ease-in-out infinite;
        }
      `}</style>
    </span>
  );
}
