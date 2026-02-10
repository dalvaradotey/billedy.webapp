'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';

interface SummaryCardsSliderProps {
  children: ReactNode[];
}

export function SummaryCardsSlider({ children }: SummaryCardsSliderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalPages = Math.ceil(children.length / 2);

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

  return (
    <div>
      {/* Mobile: Horizontal scroll slider */}
      <div className="lg:hidden">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Page 1: First 2 cards */}
          <div className="flex-shrink-0 w-full snap-center">
            <div className="grid grid-cols-2 gap-3">
              {children.slice(0, 2)}
            </div>
          </div>
          {/* Page 2: Last 2 cards */}
          <div className="flex-shrink-0 w-full snap-center">
            <div className="grid grid-cols-2 gap-3">
              {children.slice(2, 4)}
            </div>
          </div>
        </div>

        {/* Dots indicator */}
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
      </div>

      {/* Desktop: Normal grid */}
      <div className="hidden lg:grid gap-3 grid-cols-4">
        {children}
      </div>
    </div>
  );
}
