import { useFunction } from '@frozik/components/hooks/useFunction';
import { useEffect, useRef, useState } from 'react';

interface IAnchorPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Canvas-relative anchor (CSS px) for the hover popup.
 *
 * The anchor follows the cursor on every `pointermove`. Writing it
 * straight to React state re-rendered the whole observer content tree per
 * event; instead the latest position is stashed in a ref and a single rAF
 * flushes it to state, coalescing a burst of pointer events into one
 * render per frame. Clears stay synchronous so the popup disappears in
 * the same tick the pointer leaves.
 */
export function useHoverAnchor(): {
  readonly hoverAnchor: IAnchorPoint | null;
  readonly scheduleHoverAnchor: (point: IAnchorPoint) => void;
  readonly clearHoverAnchor: VoidFunction;
} {
  const [hoverAnchor, setHoverAnchor] = useState<IAnchorPoint | null>(null);
  const pendingAnchorRef = useRef<IAnchorPoint | null>(null);
  const rafIdRef = useRef<number | undefined>(undefined);

  const flushHoverAnchor = useFunction(() => {
    rafIdRef.current = undefined;
    const next = pendingAnchorRef.current;
    if (next !== null) {
      setHoverAnchor(next);
    }
  });

  const scheduleHoverAnchor = useFunction((point: IAnchorPoint) => {
    pendingAnchorRef.current = point;
    if (rafIdRef.current === undefined) {
      rafIdRef.current = requestAnimationFrame(flushHoverAnchor);
    }
  });

  const clearHoverAnchor = useFunction(() => {
    pendingAnchorRef.current = null;
    if (rafIdRef.current !== undefined) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = undefined;
    }
    setHoverAnchor(null);
  });

  useEffect(
    () => (): void => {
      if (rafIdRef.current !== undefined) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = undefined;
      }
    },
    []
  );

  return { hoverAnchor, scheduleHoverAnchor, clearHoverAnchor };
}
