import type { RefObject } from 'react';
import { useEffect } from 'react';

import type { GridViewSlice } from '../../extensions/grid-view/core';

/**
 * The table owns its scroll. When its box has no height of its own the root
 * would grow to every row and the page would scroll instead, so the root is
 * capped at what is left of the screen below it; a box with a height keeps
 * bounding it as before. Once capped, a root stays capped for its lifetime.
 */
const MIN_CAP_PX = 120;

function capToScreen(root: HTMLElement, capped: boolean): boolean {
  if (!capped && root.clientHeight <= window.innerHeight) {
    return false;
  }
  const below = window.innerHeight - Math.max(0, root.getBoundingClientRect().top);
  root.style.maxHeight = `${below >= MIN_CAP_PX ? below : window.innerHeight}px`;
  return true;
}

/**
 * Feeds the scroll container's geometry to the view: size through a
 * ResizeObserver, scroll through a passive listener coalesced to one update
 * per frame. Also lends the container to the view as its scroll port.
 */
export function useViewportSync<TRow>(
  scrollRef: RefObject<HTMLDivElement | null>,
  view: GridViewSlice<TRow>
): void {
  useEffect(() => {
    const element = scrollRef.current;
    if (element === null) {
      return undefined;
    }
    const root = element.closest<HTMLElement>('.ft');
    let capped = false;
    let frame = 0;
    const read = (): void => {
      frame = 0;
      if (root !== null) {
        capped = capToScreen(root, capped);
      }
      view.setViewport({
        width: element.clientWidth,
        height: element.clientHeight,
        scrollTop: element.scrollTop,
        scrollLeft: element.scrollLeft,
      });
    };
    const schedule = (): void => {
      if (frame === 0) {
        frame = requestAnimationFrame(read);
      }
    };
    read();
    const controller = new AbortController();
    element.addEventListener('scroll', schedule, { passive: true, signal: controller.signal });
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    view.attachScrollPort({
      scrollTo: ({ top, left }) => element.scrollTo({ top, left }),
    });
    window.addEventListener('resize', schedule, { signal: controller.signal });
    return () => {
      controller.abort();
      observer.disconnect();
      cancelAnimationFrame(frame);
      view.attachScrollPort(undefined);
      if (root !== null) {
        root.style.maxHeight = '';
      }
    };
  }, [scrollRef, view]);
}
