'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ScrollRow } from '@/components/ui/scroll-row';

/**
 * Clases de columnas escritas literalmente: Tailwind solo genera las clases que
 * encuentra completas en el código, así que no se pueden armar interpolando el número.
 */
const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};

function gridCols(count: number): string {
  return GRID_COLS[Math.min(Math.max(count, 1), 6)];
}

interface SummaryCardsSliderProps {
  children: ReactNode[];
  /** Max columns on desktop grid (default: 4) */
  desktopMaxCols?: number;
  /** Breakpoint for desktop grid (default: 'lg') */
  desktopBreakpoint?: 'md' | 'lg' | 'xl';
  className?: string;
}

export function SummaryCardsSlider({
  children,
  desktopMaxCols = 4,
  desktopBreakpoint = 'lg',
  className,
}: SummaryCardsSliderProps) {
  const [currentDesktopPage, setCurrentDesktopPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const totalDesktopPages = Math.ceil(children.length / desktopMaxCols);

  useEffect(() => {
    const container = desktopScrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const pageWidth = container.offsetWidth;
      const newPage = Math.round(scrollLeft / pageWidth);
      setCurrentDesktopPage(newPage);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollDesktopToPage = (page: number) => {
    const container = desktopScrollRef.current;
    if (!container) return;

    const pageWidth = container.offsetWidth;
    container.scrollTo({ left: page * pageWidth, behavior: 'smooth' });
  };

  const desktopPages: ReactNode[][] = [];
  for (let i = 0; i < children.length; i += desktopMaxCols) {
    desktopPages.push(children.slice(i, i + desktopMaxCols));
  }

  const breakpointClasses = {
    md: { mobile: 'md:hidden', desktop: 'hidden md:grid' },
    lg: { mobile: 'lg:hidden', desktop: 'hidden lg:grid' },
    xl: { mobile: 'xl:hidden', desktop: 'hidden xl:grid' },
  };

  const classes = breakpointClasses[desktopBreakpoint];

  return (
    <div className={className}>
      {/* Móvil: fila con scroll libre, una tarjeta asoma para invitar a deslizar */}
      <div className={classes.mobile}>
        <ScrollRow scrollRef={scrollRef} className="-mx-4 flex snap-x scroll-px-4 gap-2.5 px-4">
          {children.map((child, i) => (
            <div key={i} className="w-[46%] min-w-[150px] max-w-[190px] flex-none snap-start">
              {child}
            </div>
          ))}
        </ScrollRow>
      </div>

      {/* Desktop: Grid with slider if more than desktopMaxCols */}
      {totalDesktopPages <= 1 ? (
        <div className={cn(classes.desktop, 'gap-3', gridCols(children.length))}>
          {children}
        </div>
      ) : (
        <div className={cn(classes.desktop.replace('grid', 'block'))}>
          <div
            ref={desktopScrollRef}
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {desktopPages.map((pageItems, pageIndex) => (
              <div key={pageIndex} className="flex-shrink-0 w-full snap-center">
                <div className={cn('grid gap-3', gridCols(desktopMaxCols))}>
                  {pageItems}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop dots */}
          <div className="flex justify-center gap-1.5 mt-3">
            {Array.from({ length: totalDesktopPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => scrollDesktopToPage(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentDesktopPage
                    ? 'bg-primary w-4'
                    : 'bg-muted-foreground/30 w-1.5'
                }`}
                aria-label={`Ir a página ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
