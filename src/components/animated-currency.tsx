'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/formatting';
import { cn } from '@/lib/utils';

interface AnimatedCurrencyProps {
  value: number;
  duration?: number;
  className?: string;
  showSign?: boolean;
  prefix?: string;
}

/**
 * Componente que anima cambios en valores monetarios
 * Usa interpolación lineal para transiciones suaves
 */
export function AnimatedCurrency({
  value,
  duration = 400,
  className,
  showSign = false,
  prefix = '',
}: AnimatedCurrencyProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    // Si el valor no cambió, no animar
    if (previousValue.current === value) return;

    const startValue = previousValue.current;
    const endValue = value;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function: easeOutCubic para una sensación más natural
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const currentValue = startValue + (endValue - startValue) * easeProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        previousValue.current = endValue;
      }
    };

    // Cancelar animación anterior si existe
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  // Inicializar con el valor actual si es la primera renderización
  useEffect(() => {
    previousValue.current = value;
    setDisplayValue(value);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formattedValue = formatCurrency(Math.abs(displayValue));
  const sign = showSign && displayValue < 0 ? '-' : showSign && displayValue > 0 ? '+' : '';

  return (
    <span className={cn('tabular-nums transition-colors duration-300', className)}>
      {prefix}{sign}{formattedValue}
    </span>
  );
}
