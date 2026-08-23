import { useEffect, useState } from 'react';

/**
 * The touch overlay belongs to devices whose *primary* pointer is a finger (§12.2): a hybrid
 * laptop with a touchscreen still reports `(pointer: fine)` and keeps the desktop experience.
 */
const COARSE_POINTER_QUERY = '(pointer: coarse)';

function matchCoarsePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia(COARSE_POINTER_QUERY).matches;
}

/** Reactive `(pointer: coarse)` check; a plugged-in mouse flips it back without a reload. */
export function useIsCoarsePointer(): boolean {
  const [isCoarsePointer, setIsCoarsePointer] = useState(matchCoarsePointer);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const query = window.matchMedia(COARSE_POINTER_QUERY);
    const handleChange = (event: MediaQueryListEvent): void => setIsCoarsePointer(event.matches);

    query.addEventListener('change', handleChange);
    setIsCoarsePointer(query.matches);

    return () => query.removeEventListener('change', handleChange);
  }, []);

  return isCoarsePointer;
}
