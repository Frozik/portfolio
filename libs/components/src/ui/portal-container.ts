import { createContext, useContext } from 'react';

/**
 * Where popups, menus and dialogs mount. A part of the page with its own theme (`data-theme` on
 * an inner element) provides itself, so what it opens paints in that theme instead of the
 * document's; `null` keeps Radix's default, the document body.
 */
export const PortalContainerContext = createContext<HTMLElement | null>(null);

export function usePortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext);
}
