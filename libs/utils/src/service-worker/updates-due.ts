/**
 * Calls `check` on a timer and whenever a stale page may resurface, while
 * online. Safari throttles timers in background tabs and freezes iOS
 * standalone apps entirely, so the timer alone can leave a returning user on
 * an old build for a long time: coming back to the tab (`visibilitychange`)
 * and restoring from the back/forward cache (`pageshow` with `persisted`) are
 * exactly those moments.
 */
export function whenUpdatesAreDue(check: () => void, intervalMs: number): () => void {
  const checkOnline = (): void => {
    if (navigator.onLine) {
      check();
    }
  };
  const resurfaced = (): void => {
    if (document.visibilityState === 'visible') {
      checkOnline();
    }
  };
  const restored = (event: PageTransitionEvent): void => {
    if (event.persisted) {
      checkOnline();
    }
  };
  const timer = setInterval(checkOnline, intervalMs);
  document.addEventListener('visibilitychange', resurfaced);
  window.addEventListener('pageshow', restored);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', resurfaced);
    window.removeEventListener('pageshow', restored);
  };
}
