import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { VirtualWindow } from './virtual-window';
import { virtualWindow } from './virtual-window';

export type VirtualRows = VirtualWindow & {
  /**
   * The ref callback a rendered row puts on its element so its real height is
   * learned. Taken by row key rather than by position: a list that grows at the
   * top shifts every index, and a position-keyed callback would then be a new
   * function for every row, defeating `memo` on all of them.
   */
  readonly measureRow: (rowKey: string) => (element: HTMLElement | null) => void;
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
  keyAt,
  overscan,
}: {
  readonly count: number;
  readonly estimatedRowHeight: number;
  readonly scrollElementRef: { current: HTMLElement | null };
  /** The key of the row at a position, so a measured height follows its row. */
  readonly keyAt: (index: number) => string;
  readonly overscan?: number;
}): VirtualRows {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [measured, setMeasured] = useState<ReadonlyMap<string, number>>(new Map());

  const heights = useMemo(() => {
    const next = new Array<number>(count);
    for (let index = 0; index < count; index += 1) {
      next[index] = measured.get(keyAt(index)) ?? estimatedRowHeight;
    }
    return next;
  }, [count, estimatedRowHeight, keyAt, measured]);

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

  const measurers = useRef(new Map<string, (element: HTMLElement | null) => void>());

  const measureRow = useCallback((rowKey: string) => {
    const existing = measurers.current.get(rowKey);
    if (existing !== undefined) {
      return existing;
    }

    const measure = (element: HTMLElement | null): void => {
      if (element === null) {
        return;
      }
      const height = element.getBoundingClientRect().height;
      if (height <= 0) {
        return;
      }
      setMeasured(current => {
        if (current.get(rowKey) === height) {
          return current;
        }
        const next = new Map(current);
        next.set(rowKey, height);
        return next;
      });
    };
    measurers.current.set(rowKey, measure);

    return measure;
  }, []);

  const window = useMemo(
    () => virtualWindow({ heights, scrollTop, viewportHeight, overscan }),
    [heights, scrollTop, viewportHeight, overscan]
  );

  return { ...window, measureRow };
}
