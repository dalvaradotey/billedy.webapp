"use client";

import Link from "next/link";
import { type ReactNode } from "react";

interface GradientButtonProps {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

export function GradientButton({ href, onClick, children, className = "" }: GradientButtonProps) {
  const buttonClasses = `
    group relative inline-flex items-center justify-center overflow-hidden
    px-8 py-4 text-base font-semibold text-white rounded-xl
    transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]
    ${className}
  `;

  const content = (
    <>
      {/* Animated gradient background */}
      <span className="absolute inset-0 bg-gradient-to-r from-blue-600 via-emerald-500 to-blue-600 bg-[length:200%_100%] animate-gradient" />

      {/* Glow effect */}
      <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-blue-400 via-emerald-400 to-blue-400 blur-xl bg-[length:200%_100%] animate-gradient" />

      {/* Border highlight */}
      <span className="absolute inset-[1px] rounded-[11px] bg-gradient-to-r from-blue-600 via-emerald-500 to-blue-600 bg-[length:200%_100%] animate-gradient" />

      {/* Content */}
      <span className="relative z-10 flex items-center gap-2">
        {children}
      </span>

      <style jsx>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          animation: gradient 3s ease-in-out infinite;
        }
      `}</style>
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={buttonClasses}>
        {content}
      </button>
    );
  }

  return (
    <Link href={href || "#"} className={buttonClasses}>
      {content}
    </Link>
  );
}
