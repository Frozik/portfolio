import type { ReactElement } from 'react';
import { useLayoutEffect, useRef } from 'react';

import {
  POPUP_EDGE_MARGIN_PX,
  POPUP_MAX_HEIGHT_PX,
  POPUP_OFFSET_PX,
  POPUP_WIDTH_PX,
} from './constants';

interface IDesktopAnchoredPopupProps {
  readonly pointerPx: { readonly x: number; readonly y: number };
  /** Dependencies that should re-trigger the edge-aware position pass. */
  readonly reflowDeps: ReadonlyArray<unknown>;
  readonly children: ReactElement | ReactElement[];
}

/**
 * Edge-aware absolute-positioned wrapper used on desktop. Mirrors the
 * orderbook `CellTooltip` policy: prefer bottom-right of the click
 * point, flip to the opposite quadrant if the popup would clip the
 * parent edges, then clamp to the edge margin.
 */
export function DesktopAnchoredPopup({
  pointerPx,
  reflowDeps,
  children,
}: IDesktopAnchoredPopupProps): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (node === null) {
      return;
    }
    const parent = node.offsetParent as HTMLElement | null;
    const parentRect = parent?.getBoundingClientRect();
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
  }, reflowDeps);

  return (
    <div
      ref={rootRef}
      // Start hidden: the layout effect measures the actual size, flips
      // direction if needed, then sets `visibility` — without this we
      // paint once at the raw pointer position before correcting.
      style={{
        visibility: 'hidden',
        left: 0,
        top: 0,
        width: POPUP_WIDTH_PX,
        maxHeight: POPUP_MAX_HEIGHT_PX,
      }}
      className="absolute z-40 flex flex-col rounded-md border border-border bg-surface-elevated/95 text-xs text-text-secondary shadow-xl backdrop-blur"
    >
      {children}
    </div>
  );
}
