import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const MAX_ATTEMPTS = 60;

/**
 * Scrolls the matching section into view when a URL hash is present.
 *
 * Triggers on:
 *  - initial mount with an existing hash (covers SPA navigations from
 *    inner routes to `/#anchor` — the browser does not auto-scroll on
 *    history pushes, only on full-page loads);
 *  - subsequent hash changes while the component stays mounted (covers
 *    anchor clicks inside the landing TopNav).
 *
 * Uses an rAF retry loop because the target section may not be in the DOM
 * yet at the exact moment the effect fires (lazy route chunk still
 * hydrating, canvas children still measuring layout, …). Up to
 * `MAX_ATTEMPTS` animation frames are tried before giving up.
 *
 * Relies on `scroll-margin-top` on target sections so the sticky nav does
 * not cover their titles, and on the global `scroll-behavior: smooth` in
 * `tailwind.css` for animated scrolling.
 */
export function useHashScroll(): void {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      return;
    }
    const id = hash.slice(1);

    let frameId = 0;
    let attempts = 0;

    const tryScroll = () => {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (attempts < MAX_ATTEMPTS) {
        attempts += 1;
        frameId = requestAnimationFrame(tryScroll);
      }
    };

    frameId = requestAnimationFrame(tryScroll);

    return () => {
      if (frameId !== 0) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [hash]);
}
