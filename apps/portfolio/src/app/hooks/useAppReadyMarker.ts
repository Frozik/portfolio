import { useEffect } from 'react';

/**
 * Marks `<html data-app-ready>` once React has committed its first render —
 * hydration of the prerendered landing included. Until then the landing's
 * buttons are visible but inert, so automation (the e2e suite, monitoring)
 * waits for this before it clicks.
 */
export function useAppReadyMarker(): void {
  useEffect(() => {
    document.documentElement.dataset.appReady = 'true';
  }, []);
}
