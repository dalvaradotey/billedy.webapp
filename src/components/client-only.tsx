'use client';

import { useEffect, useState, type ReactNode } from 'react';

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Wrapper component that only renders its children on the client side.
 * Useful for components with Radix UI that have hydration mismatch issues.
 *
 * @example
 * ```tsx
 * <ClientOnly fallback={<Skeleton className="h-8 w-8" />}>
 *   <DropdownMenu>...</DropdownMenu>
 * </ClientOnly>
 * ```
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
