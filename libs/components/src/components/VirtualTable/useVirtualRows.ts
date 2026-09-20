import { useCallback, useEffect, useMemo, useState } from 'react';

import type { VirtualWindow } from './virtual-window';
import { virtualWindow } from './virtual-window';

export type VirtualRows = VirtualWindow & {
  /** Ref callback every rendered row puts on its element so its real height is learned. */
  readonly measureRow: (index: number) => (element: HTMLElement | null) => void;
};

/**
 * Which rows to render for a scrolled container, and how much empty space to
 * leave above and below them.
 *
 * Returns plain values — indices and pixel offsets — rather than an object
 * whose methods must be called during render. That matters beyond taste: a
 * hook handing back a stable instance with mutating internals is invisible to
 * static analysis, which is exactly why React Compiler refuses to memoise
 * components built on such APIs. Numbers it can see.
 */
export function useVirtualRows({
  count,
  estimatedRowHeight,
  scrollElementRef,
  overscan,
}: {
  readonly count: number;
  readonly estimatedRowHeight: number;
  readonly scrollElementRef: { current: HTMLElement | null };
  readonly overscan?: number;
}): VirtualRows {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [measured, setMeasured] = useState<readonly number[]>([]);

  const heights = useMemo(() => {
    const next = new Array<number>(count);
    for (let index = 0; index < count; index += 1) {
      next[index] = measured[index] ?? estimatedRowHeight;
    }
    return next;
  }, [count, estimatedRowHeight, measured]);

  useEffect(() => {
    const element = scrollElementRef.current;
    if (element === null) {
      return undefined;
    }

    const readGeometry = (): void => {
      setScrollTop(element.scrollTop);
      setViewportHeight(element.clientHeight);
    };
    readGeometry();

    const controller = new AbortController();
    element.addEventListener('scroll', readGeometry, {
      passive: true,
      signal: controller.signal,
    });
    const observer = new ResizeObserver(readGeometry);
    observer.observe(element);

    return () => {
      controller.abort();
      observer.disconnect();
    };
  }, [scrollElementRef]);

  const measureRow = useCallback(
    (index: number) => (element: HTMLElement | null) => {
      if (element === null) {
        return;
      }
      const height = element.getBoundingClientRect().height;
      if (height <= 0) {
        return;
      }
      setMeasured(current => {
        if (current[index] === height) {
          return current;
        }
        const next = [...current];
        next[index] = height;
        return next;
      });
    },
    []
  );

  const window = useMemo(
    () => virtualWindow({ heights, scrollTop, viewportHeight, overscan }),
    [heights, scrollTop, viewportHeight, overscan]
  );

  return { ...window, measureRow };
}
