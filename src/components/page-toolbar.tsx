interface PageToolbarProps {
  /** Texto informativo (ej: "5 presupuestos") */
  label: string;
  /** Acciones opcionales a la derecha (flex-wrap si no caben en una línea) */
  children?: React.ReactNode;
}

export function PageToolbar({ label, children }: PageToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-muted/50 dark:bg-muted/30 px-4 py-2.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      {children}
    </div>
  );
}
