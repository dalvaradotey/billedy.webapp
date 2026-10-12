'use client';

interface ProgressIndicatorProps {
  current: number;
  total?: number;
  className?: string;
}

/**
 * Antes mostraba puntos de avance en los formularios. En Pulso los formularios
 * no llevan ese indicador: se mantiene el componente para no romper a quien lo usa.
 */
export function ProgressIndicator(_props: ProgressIndicatorProps) {
  return null;
}
