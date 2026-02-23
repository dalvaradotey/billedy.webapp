'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SummaryCardsSliderProps {
  children: ReactNode[];
  /** Items per page on mobile (default: 2) */
  itemsPerPage?: number;
  /** Breakpoint for desktop grid (default: 'lg') */
  desktopBreakpoint?: 'md' | 'lg' | 'xl';
  className?: string;
}

export function SummaryCardsSlider({
  children,
  itemsPerPage = 2,
  desktopBreakpoint = 'lg',
  className,
}: SummaryCardsSliderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalPages = Math.ceil(children.length / itemsPerPage);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const pageWidth = container.offsetWidth;
      const newPage = Math.round(scrollLeft / pageWidth);
      setCurrentPage(newPage);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToPage = (page: number) => {
    const container = scrollRef.current;
    if (!container) return;

    const pageWidth = container.offsetWidth;
    container.scrollTo({ left: page * pageWidth, behavior: 'smooth' });
  };

  // Create pages by chunking children
  const pages: ReactNode[][] = [];
  for (let i = 0; i < children.length; i += itemsPerPage) {
    pages.push(children.slice(i, i + itemsPerPage));
  }

  const breakpointClasses = {
    md: { mobile: 'md:hidden', desktop: 'hidden md:grid' },
    lg: { mobile: 'lg:hidden', desktop: 'hidden lg:grid' },
    xl: { mobile: 'xl:hidden', desktop: 'hidden xl:grid' },
  };

  const classes = breakpointClasses[desktopBreakpoint];

  return (
    <div className={className}>
      {/* Mobile: Horizontal scroll slider */}
      <div className={classes.mobile}>
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {pages.map((pageItems, pageIndex) => (
            <div key={pageIndex} className="flex-shrink-0 w-full snap-center">
              <div className={cn('grid gap-3', `grid-cols-${itemsPerPage}`)}>
                {pageItems}
              </div>
            </div>
          ))}
        </div>

        {/* Dots indicator */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => scrollToPage(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentPage
                    ? 'bg-primary w-4'
                    : 'bg-muted-foreground/30 w-1.5'
                }`}
                aria-label={`Ir a página ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: Normal grid */}
      <div className={cn(classes.desktop, 'gap-3', `grid-cols-${children.length}`)}>
        {children}
      </div>
    </div>
  );
}
