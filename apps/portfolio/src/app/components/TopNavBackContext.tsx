import { assert } from '@frozik/utils/assert/assert';
import type { ReactNode } from 'react';
import { createContext, memo, useContext, useEffect, useMemo, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

export interface ITopNavBackConfig {
  readonly label: string;
  readonly onActivate: () => void;
}

interface ITopNavBackContextValue {
  readonly config: ITopNavBackConfig | null;
  readonly register: (config: ITopNavBackConfig) => void;
  readonly clear: () => void;
}

const TopNavBackContext = createContext<ITopNavBackContextValue | null>(null);

export const TopNavBackProvider = memo(({ children }: { readonly children: ReactNode }) => {
  const [config, setConfig] = useState<ITopNavBackConfig | null>(null);
  const register = useEventCallback((next: ITopNavBackConfig) => setConfig(next));
  const clear = useEventCallback(() => setConfig(null));
  const value = useMemo(() => ({ config, register, clear }), [config, register, clear]);
  return <TopNavBackContext.Provider value={value}>{children}</TopNavBackContext.Provider>;
});

export function useTopNavBack(): ITopNavBackContextValue {
  const value = useContext(TopNavBackContext);
  assert(value !== null, 'useTopNavBack must be used inside <TopNavBackProvider>');
  return value;
}

export function useRegisterTopNavBack(config: ITopNavBackConfig): void {
  const { register, clear } = useTopNavBack();
  const { label, onActivate } = config;
  // Stable-ref the callback so re-registration doesn't churn when callers
  // forget to memoise. `useEventCallback` always returns the same identity
  // while invoking the latest `onActivate` closure.
  const stableOnActivate = useEventCallback(() => onActivate());
  useEffect(() => {
    register({ label, onActivate: stableOnActivate });
    return clear;
  }, [register, clear, label, stableOnActivate]);
}
