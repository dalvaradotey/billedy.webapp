'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface ScrollRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Barrita bajo la fila que muestra cuánto falta por deslizar */
  indicator?: boolean;
  /** Ref al contenedor que hace scroll */
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

const FADE = 28;

function readScroll(el: HTMLDivElement) {
  const max = el.scrollWidth - el.clientWidth;
  const overflow = max > 2;
  return {
    overflow,
    start: !overflow || el.scrollLeft <= 2,
    end: !overflow || el.scrollLeft >= max - 2,
    ratio: overflow ? el.clientWidth / el.scrollWidth : 1,
    pos: overflow ? el.scrollLeft / max : 0,
  };
}

/**
 * Fila con scroll horizontal que avisa que sigue: los bordes se desvanecen donde
 * hay más contenido y una barrita sutil marca la posición. Si todo cabe (p. ej. en
 * desktop, donde la fila pasa a grilla), no muestra nada.
 */
export function ScrollRow({ indicator = true, scrollRef, className, children, onScroll, style, ...props }: ScrollRowProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const ref = scrollRef ?? innerRef;
  const [state, setState] = useState({ overflow: false, start: true, end: true, ratio: 1, pos: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // El observer también avisa al empezar a observar: sirve de primera medición
    const ro = new ResizeObserver(() => setState(readScroll(el)));
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [ref, children]);

  const mask = state.overflow
    ? `linear-gradient(to right, ${state.start ? '#000' : 'transparent'} 0, #000 ${FADE}px, #000 calc(100% - ${FADE}px), ${state.end ? '#000' : 'transparent'} 100%)`
    : undefined;

  return (
    <>
      <div
        ref={ref}
        onScroll={(e) => {
          setState(readScroll(e.currentTarget));
          onScroll?.(e);
        }}
        className={cn('scrollbar-hide overflow-x-auto', className)}
        style={{ ...style, maskImage: mask, WebkitMaskImage: mask }}
        {...props}
      >
        {children}
      </div>
      {indicator && state.overflow && (
        <div aria-hidden className="relative mx-auto mt-2 h-1 w-10 overflow-hidden rounded-full bg-surface-3">
          <span
            className="absolute inset-y-0 rounded-full bg-faint transition-[left] duration-75"
            style={{ width: `${state.ratio * 100}%`, left: `${state.pos * (1 - state.ratio) * 100}%` }}
          />
        </div>
      )}
    </>
  );
}
