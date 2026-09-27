import type { RefObject } from 'react';
import { useEffect } from 'react';

/** Reports the rendered height of a row or the header to `measure` whenever it changes. */
export function useRowMeasure(
  rowRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  measure: (height: number) => void
): void {
  useEffect(() => {
    const element = rowRef.current;
    if (!enabled || element === null) {
      return undefined;
    }
    const report = (): void => {
      const height = element.getBoundingClientRect().height;
      if (height > 0) {
        measure(height);
      }
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [rowRef, enabled, measure]);
}
