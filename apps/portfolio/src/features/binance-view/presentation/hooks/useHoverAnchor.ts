import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { useEffect, useRef, useState } from 'react';

interface IAnchorPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Canvas-relative anchor (CSS px) for the hover popup. Pointer bursts are
 * coalesced into one state write per animation frame; clears stay
 * synchronous so the popup disappears the tick the pointer leaves.
 */
export function useHoverAnchor(): {
  readonly hoverAnchor: IAnchorPoint | undefined;
  readonly scheduleHoverAnchor: (point: IAnchorPoint) => void;
  readonly clearHoverAnchor: VoidFunction;
} {
  const [hoverAnchor, setHoverAnchor] = useState<IAnchorPoint | undefined>(undefined);
  const pendingAnchorRef = useRef<IAnchorPoint | undefined>(undefined);
  const rafIdRef = useRef<number | undefined>(undefined);

  const flushHoverAnchor = useFunction(() => {
    rafIdRef.current = undefined;
    const next = pendingAnchorRef.current;
    if (!isNil(next)) {
      setHoverAnchor(next);
    }
  });

  const scheduleHoverAnchor = useFunction((point: IAnchorPoint) => {
    pendingAnchorRef.current = point;
    if (isNil(rafIdRef.current)) {
      rafIdRef.current = requestAnimationFrame(flushHoverAnchor);
    }
  });

  const clearHoverAnchor = useFunction(() => {
    pendingAnchorRef.current = undefined;
    if (!isNil(rafIdRef.current)) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = undefined;
    }
    setHoverAnchor(undefined);
  });

  useEffect(
    () => (): void => {
      if (!isNil(rafIdRef.current)) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = undefined;
      }
    },
    []
  );

  return { hoverAnchor, scheduleHoverAnchor, clearHoverAnchor };
}
