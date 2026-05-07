import { useEffect, useState } from 'react';

/** Tailwind `md` breakpoint — viewport widths below this use the drawer layout. */
const MOBILE_BREAKPOINT_PX = 768;
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`;

/**
 * Reactive `matchMedia` hook for the mobile breakpoint. Returns `false`
 * during SSR / when `matchMedia` is unavailable so the desktop layout
 * is the safe default.
 */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
    const handler = (event: MediaQueryListEvent): void => setIsMobile(event.matches);
    mql.addEventListener('change', handler);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
