import { assert } from '@frozik/utils/assert/assert';
import type { ReactElement, ReactNode } from 'react';
import { createContext, memo, useContext, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Center slot in the {@link TopNav} bar that pages register controls
 * into via {@link TopNavCenterPortal}. Replaces the previous hardcoded
 * landing-only section list — every page (landing, binance-view, …)
 * now portals its own content into the same physical slot.
 *
 * Mechanism: {@link TopNavCenterProvider} owns a piece of state for
 * the host `<div>`'s DOM element. {@link TopNav} sets the element via
 * {@link useTopNavCenterHostSetter}; consumers render through
 * {@link TopNavCenterPortal} which `createPortal`s its children into
 * the host the moment it's available.
 */

type SetHost = (element: HTMLDivElement | null) => void;

const HostContext = createContext<HTMLDivElement | null>(null);
const SetHostContext = createContext<SetHost | null>(null);

interface ITopNavCenterProviderProps {
  readonly children: ReactNode;
}

export const TopNavCenterProvider = memo(({ children }: ITopNavCenterProviderProps) => {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <SetHostContext.Provider value={setHost}>
      <HostContext.Provider value={host}>{children}</HostContext.Provider>
    </SetHostContext.Provider>
  );
});

/**
 * Wired up by {@link TopNav}: the center `<div>` ref is published into
 * the context so portals can attach. Asserts that the consumer sits
 * inside a {@link TopNavCenterProvider} — the layouts always wrap.
 */
export function useTopNavCenterHostSetter(): SetHost {
  const setter = useContext(SetHostContext);
  assert(setter !== null, 'useTopNavCenterHostSetter must be used inside <TopNavCenterProvider>');
  return setter;
}

interface ITopNavCenterPortalProps {
  readonly children: ReactNode;
}

/**
 * Renders `children` into the {@link TopNav} center slot via a React
 * portal. Returns `null` until the slot's DOM element is available
 * (first paint of the layout) — subsequent re-renders update the
 * portal in place. Safe to render unconditionally.
 */
export const TopNavCenterPortal = memo(
  ({ children }: ITopNavCenterPortalProps): ReactElement | null => {
    const host = useContext(HostContext);
    if (host === null) {
      return null;
    }
    return createPortal(children, host);
  }
);
