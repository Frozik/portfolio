import { isNil } from 'lodash-es';
import type { ReactElement } from 'react';
import { useLayoutEffect, useRef } from 'react';

import { POPUP_EDGE_MARGIN_PX, POPUP_OFFSET_PX } from './constants';

/**
 * Edge-aware absolute-positioned wrapper used on desktop: prefers
 * bottom-right of the click point, flips to the opposite quadrant near the
 * parent edges, then clamps to the edge margin.
 */
export function DesktopAnchoredPopup({
  pointerPx,
  children,
}: {
  readonly pointerPx: { readonly x: number; readonly y: number };
  readonly children: ReactElement | ReactElement[];
}): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (isNil(node)) {
      return undefined;
    }

    const reflow = (): void => {
      const parentRect = node.offsetParent?.getBoundingClientRect();
      const parentWidth = parentRect?.width ?? window.innerWidth;
      const parentHeight = parentRect?.height ?? window.innerHeight;
      const popupRect = node.getBoundingClientRect();
      const popupWidth = popupRect.width;
      const popupHeight = popupRect.height;

      let nextLeft = pointerPx.x + POPUP_OFFSET_PX;
      if (nextLeft + popupWidth + POPUP_EDGE_MARGIN_PX > parentWidth) {
        nextLeft = pointerPx.x - popupWidth - POPUP_OFFSET_PX;
      }

      let nextTop = pointerPx.y + POPUP_OFFSET_PX;
      if (nextTop + popupHeight + POPUP_EDGE_MARGIN_PX > parentHeight) {
        nextTop = pointerPx.y - popupHeight - POPUP_OFFSET_PX;
      }

      const clampedLeft = Math.max(
        POPUP_EDGE_MARGIN_PX,
        Math.min(nextLeft, parentWidth - popupWidth - POPUP_EDGE_MARGIN_PX)
      );
      const clampedTop = Math.max(
        POPUP_EDGE_MARGIN_PX,
        Math.min(nextTop, parentHeight - popupHeight - POPUP_EDGE_MARGIN_PX)
      );

      node.style.left = `${clampedLeft}px`;
      node.style.top = `${clampedTop}px`;
      node.style.visibility = 'visible';
    };

    reflow();

    // Content arriving later (loading → data) resizes the popup and can push it past an edge.
    const resizeObserver = new ResizeObserver(reflow);
    resizeObserver.observe(node);

    return () => resizeObserver.disconnect();
  }, [pointerPx.x, pointerPx.y]);

  return (
    <div
      ref={rootRef}
      // Starts invisible so the layout effect can measure and place it before the first paint.
      className="invisible absolute left-0 top-0 z-40 flex max-h-[320px] w-[340px] flex-col rounded-md border border-border bg-surface-elevated/95 text-xs text-text-secondary shadow-xl backdrop-blur"
    >
      {children}
    </div>
  );
}
