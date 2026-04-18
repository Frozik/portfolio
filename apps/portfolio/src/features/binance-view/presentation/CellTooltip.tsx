import { millisecondsToISO8601 } from '@frozik/utils';
import { observer } from 'mobx-react-lite';
import { useLayoutEffect, useRef } from 'react';

import { useBinanceViewStore } from '../application/useBinanceViewStore';

import { binanceT } from './translations';

const TOOLTIP_OFFSET_PX = 14;
const TOOLTIP_EDGE_MARGIN_PX = 4;

function formatSide(side: 'bid' | 'ask' | 'padding'): string {
  switch (side) {
    case 'bid':
      return binanceT.tooltip.bid;
    case 'ask':
      return binanceT.tooltip.ask;
    case 'padding':
      return '—';
  }
}

function formatNumber(value: number, fractionDigits: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export const CellTooltip = observer(() => {
  const store = useBinanceViewStore();
  const cell = store.selectedCell;
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (node === null || cell === undefined) {
      return;
    }
    const parent = node.offsetParent as HTMLElement | null;
    const parentRect = parent?.getBoundingClientRect();
    const parentWidth = parentRect?.width ?? window.innerWidth;
    const parentHeight = parentRect?.height ?? window.innerHeight;
    const tooltipRect = node.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;

    // Prefer the bottom-right quadrant; if the pointer is close to
    // the right / bottom edge of the canvas, flip the tooltip to the
    // opposite side so it never clips out of the viewport.
    let left = cell.pointerPx.x + TOOLTIP_OFFSET_PX;
    if (left + tooltipWidth + TOOLTIP_EDGE_MARGIN_PX > parentWidth) {
      left = cell.pointerPx.x - tooltipWidth - TOOLTIP_OFFSET_PX;
    }

    let top = cell.pointerPx.y + TOOLTIP_OFFSET_PX;
    if (top + tooltipHeight + TOOLTIP_EDGE_MARGIN_PX > parentHeight) {
      top = cell.pointerPx.y - tooltipHeight - TOOLTIP_OFFSET_PX;
    }

    const clampedLeft = Math.max(
      TOOLTIP_EDGE_MARGIN_PX,
      Math.min(left, parentWidth - tooltipWidth - TOOLTIP_EDGE_MARGIN_PX)
    );
    const clampedTop = Math.max(
      TOOLTIP_EDGE_MARGIN_PX,
      Math.min(top, parentHeight - tooltipHeight - TOOLTIP_EDGE_MARGIN_PX)
    );

    node.style.left = `${clampedLeft}px`;
    node.style.top = `${clampedTop}px`;
    node.style.visibility = 'visible';
  }, [cell]);

  if (cell === undefined) {
    return null;
  }

  const timeIso = millisecondsToISO8601(cell.timestampMs);

  return (
    <div
      ref={rootRef}
      // Start hidden: the layout effect measures actual size, flips
      // direction if needed, then sets `visibility` — without this we
      // paint once at the raw pointer position before correcting.
      style={{ visibility: 'hidden', left: 0, top: 0 }}
      className="pointer-events-none absolute z-20 min-w-[180px] rounded-md border border-border bg-surface-elevated/95 px-3 py-2 text-xs text-text-secondary shadow-lg backdrop-blur"
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono">
        <dt className="text-text-muted">{binanceT.tooltip.time}</dt>
        <dd className="text-text">{timeIso}</dd>
        <dt className="text-text-muted">{binanceT.tooltip.price}</dt>
        <dd className="text-text">{formatNumber(cell.price, 2)}</dd>
        <dt className="text-text-muted">{binanceT.tooltip.volume}</dt>
        <dd className="text-text">{formatNumber(cell.volume, 6)}</dd>
        <dt className="text-text-muted">{binanceT.tooltip.side}</dt>
        <dd className="text-text">{formatSide(cell.side)}</dd>
      </dl>
    </div>
  );
});
