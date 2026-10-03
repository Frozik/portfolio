import type { RefObject } from 'react';
import { useLayoutEffect, useRef } from 'react';

interface IRestingPlace {
  readonly index: number;
  readonly left: number;
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const CSS_DURATION = /^(\d*\.?\d+)(ms|s)$/;
const MS_PER_S = 1000;

function durationOf(value: string): number {
  const match = CSS_DURATION.exec(value.trim());
  if (match === null) {
    return 0;
  }
  return Number(match[1]) * (match[2] === 's' ? MS_PER_S : 1);
}

/**
 * Slides a cell from where it stood to where it stands once its place among
 * the columns changed — a move, a pin, a neighbour hidden — never on a width
 * change alone. Places are measured rather than taken from the layout, so a
 * sticky column whose row offset changed while its spot on screen did not
 * stays still. A reorder mid-slide continues from where the cell is seen.
 */
export function useSlideOnReorder(ref: RefObject<HTMLElement | null>, index: number): void {
  const resting = useRef<IRestingPlace | null>(null);
  const slide = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    const previous = resting.current;
    const inFlight = slide.current?.playState === 'running' ? slide.current : null;
    const seen = element.getBoundingClientRect().left;
    inFlight?.cancel();
    const left = inFlight === null ? seen : element.getBoundingClientRect().left;
    resting.current = { index, left };
    slide.current = null;
    if (previous === null || previous.index === index) {
      return;
    }
    const delta = (inFlight === null ? previous.left : seen) - left;
    if (delta === 0 || window.matchMedia(REDUCED_MOTION).matches) {
      return;
    }
    const style = getComputedStyle(element);
    const duration = durationOf(style.getPropertyValue('--table-motion'));
    if (duration === 0) {
      return;
    }
    slide.current = element.animate(
      [{ transform: `translateX(${delta}px)` }, { transform: 'translateX(0)' }],
      { duration, easing: style.getPropertyValue('--table-easing').trim() || 'ease' }
    );
  });
}
