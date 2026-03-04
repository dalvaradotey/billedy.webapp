'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';

export interface PageAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
}

interface BottomNavContextValue {
  actions: PageAction[];
  setActions: (actions: PageAction[]) => void;
}

const BottomNavContext = createContext<BottomNavContextValue>({
  actions: [],
  setActions: () => {},
});

export function BottomNavActionProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<PageAction[]>([]);

  return (
    <BottomNavContext.Provider value={{ actions, setActions }}>
      {children}
    </BottomNavContext.Provider>
  );
}

export function usePageActions() {
  return useContext(BottomNavContext);
}

/**
 * Hook para que las páginas registren acciones disponibles en el bottom nav.
 * Las acciones deben estar memoizadas con useMemo para evitar re-renders innecesarios.
 */
export function useRegisterPageActions(actions: PageAction[]) {
  const { setActions } = useContext(BottomNavContext);

  useEffect(() => {
    setActions(actions);
    return () => setActions([]);
  }, [actions, setActions]);
}
