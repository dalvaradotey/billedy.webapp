'use client';

import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768; // md breakpoint

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Check initial
    checkMobile();

    // Listen for resize
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    mql.addEventListener('change', checkMobile);

    return () => mql.removeEventListener('change', checkMobile);
  }, []);

  return isMobile;
}
