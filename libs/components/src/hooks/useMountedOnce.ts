import { useState } from 'react';

/**
 * `true` from the first render in which `active` is true, and forever after.
 * For overlays that are code-split and should mount on first open but stay
 * mounted (closed) afterwards, so their exit animation can play and the next
 * open is instant.
 */
export function useMountedOnce(active: boolean): boolean {
  const [mounted, setMounted] = useState(active);
  if (active && !mounted) {
    setMounted(true);
  }
  return mounted || active;
}
