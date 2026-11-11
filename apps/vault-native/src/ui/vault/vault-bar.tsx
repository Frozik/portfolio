import { useIsFocused } from 'expo-router';
import type { ReactNode } from 'react';
import { createContext, useContext, useLayoutEffect } from 'react';

type TPutTools = (tools: ReactNode) => void;

const VaultBarContext = createContext<TPutTools>(() => undefined);

export const VaultBarProvider = VaultBarContext;

/** A page's own controls for the open vault's top row, there while the page is in sight. */
export function VaultBarTools({ children }: { readonly children: ReactNode }) {
  const put = useContext(VaultBarContext);
  const focused = useIsFocused();
  useLayoutEffect(() => {
    if (!focused) {
      return undefined;
    }
    put(children);
    return () => put(null);
  }, [put, children, focused]);
  return null;
}
