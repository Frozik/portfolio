import { millisecondsToISO8601 } from '@frozik/utils/date/iso8601';
import { observer } from 'mobx-react-lite';
import type React from 'react';
import { useLayoutEffect, useRef } from 'react';

import { useBinanceViewStore } from '../application/useBinanceViewStore';
import type { ITradeBucket } from '../domain/trades-types';
import type { IHitTestResult } from '../domain/types';

import { binanceT } from './translations';

const POPUP_OFFSET_PX = 14;
const POPUP_EDGE_MARGIN_PX = 4;

const VOLUME_FRACTION_DIGITS = 4;
const VWAP_FRACTION_DIGITS = 2;
const BUY_FRACTION_PERCENT_DIGITS = 0;
const PRICE_FRACTION_DIGITS = 2;
const CELL_VOLUME_FRACTION_DIGITS = 6;
const PERCENT_MULTIPLIER = 100;

function formatNumber(value: number, fractionDigits: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatCellSide(side: 'bid' | 'ask' | 'padding'): string {
  switch (side) {
    case 'bid':
      return binanceT.tooltip.bid;
    case 'ask':
      return binanceT.tooltip.ask;
    case 'padding':
      return '—';
  }
}

function TradesSection({ bucket }: { readonly bucket: ITradeBucket }): React.ReactElement {
  const sellFraction = 1 - bucket.buyFraction;
  const showBuy = bucket.buyFraction > 0;
  const showSell = sellFraction > 0;
  const volume = bucket.volumeTotal.toFixed(VOLUME_FRACTION_DIGITS);
  const vwap = bucket.vwap.toFixed(VWAP_FRACTION_DIGITS);
  const buyPercent = (bucket.buyFraction * PERCENT_MULTIPLIER).toFixed(BUY_FRACTION_PERCENT_DIGITS);
  const sellPercent = (sellFraction * PERCENT_MULTIPLIER).toFixed(BUY_FRACTION_PERCENT_DIGITS);
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 font-mono">
      <div className="text-text">{binanceT.tradePopup.summary(volume, vwap)}</div>
      {showBuy ? (
        <div className="text-success">{binanceT.tradePopup.buyShare(buyPercent)}</div>
      ) : null}
      {showSell ? (
        <div className="text-error">{binanceT.tradePopup.sellShare(sellPercent)}</div>
      ) : null}
    </div>
  );
}

function OrderbookSection({ cell }: { readonly cell: IHitTestResult }): React.ReactElement {
  const timeIso = millisecondsToISO8601(cell.timestampMs);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 px-3 py-2 font-mono">
      <dt className="text-text-muted">{binanceT.tooltip.time}</dt>
      <dd className="text-text">{timeIso}</dd>
      <dt className="text-text-muted">{binanceT.tooltip.price}</dt>
      <dd className="text-text">{formatNumber(cell.price, PRICE_FRACTION_DIGITS)}</dd>
      <dt className="text-text-muted">{binanceT.tooltip.volume}</dt>
      <dd className="text-text">{formatNumber(cell.volume, CELL_VOLUME_FRACTION_DIGITS)}</dd>
      <dt className="text-text-muted">{binanceT.tooltip.side}</dt>
      <dd className="text-text">{formatCellSide(cell.side)}</dd>
    </dl>
  );
}

/**
 * Unified hover popup that merges the orderbook cell tooltip and the
 * trades-bucket preview into a single panel anchored at the cursor.
 *
 * Sections (top-to-bottom):
 *   1. Trades aggregate (vwap, total volume, buy share, trade count) —
 *      shown when the cursor sits inside a closed bucket's hit-zone.
 *   2. Horizontal divider — shown only when both sections are active.
 *   3. Orderbook cell (price level, side, volume, time) — shown when
 *      the cursor sits over a heatmap cell with persisted volume data.
 *
 * If neither section has data the popup is unmounted entirely (returns
 * `null`); we never render an empty frame. Position is edge-aware —
 * mirrors the previous {@link CellTooltip} policy: prefer bottom-right
 * of the cursor, flip to the opposite quadrant near the parent edges,
 * clamp to the edge margin afterwards.
 */
export const HoverInfoPopup = observer(function HoverInfoPopup({
  anchorPx,
}: {
  readonly anchorPx: { readonly x: number; readonly y: number };
}) {
  const store = useBinanceViewStore();
  const cell = store.selectedCell;
  const bucket = store.tradesStore?.hoveredBucket;
  const rootRef = useRef<HTMLDivElement>(null);

  // Edge-aware repositioning — measure after layout, prefer
  // bottom-right of the cursor, flip to the opposite quadrant when the
  // popup would clip the parent edges, clamp to the margin.
  useLayoutEffect(() => {
    const node = rootRef.current;
    if (node === null || (cell === undefined && bucket === undefined)) {
      return;
    }
    const parent = node.offsetParent as HTMLElement | null;
    const parentRect = parent?.getBoundingClientRect();
    const parentWidth = parentRect?.width ?? window.innerWidth;
    const parentHeight = parentRect?.height ?? window.innerHeight;
    const popupRect = node.getBoundingClientRect();
    const popupWidth = popupRect.width;
    const popupHeight = popupRect.height;

    let nextLeft = anchorPx.x + POPUP_OFFSET_PX;
    if (nextLeft + popupWidth + POPUP_EDGE_MARGIN_PX > parentWidth) {
      nextLeft = anchorPx.x - popupWidth - POPUP_OFFSET_PX;
    }

    let nextTop = anchorPx.y + POPUP_OFFSET_PX;
    if (nextTop + popupHeight + POPUP_EDGE_MARGIN_PX > parentHeight) {
      nextTop = anchorPx.y - popupHeight - POPUP_OFFSET_PX;
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
    // Re-measure when sections appear / disappear so the popup
    // re-flips against the new content size.
  }, [anchorPx, cell, bucket]);

  if (cell === undefined && bucket === undefined) {
    return null;
  }

  return (
    <div
      ref={rootRef}
      // Start hidden: the layout effect measures actual size, flips
      // direction if needed, then sets `visibility` — without this the
      // popup paints once at the raw anchor before correcting.
      style={{ visibility: 'hidden', left: 0, top: 0 }}
      className="pointer-events-none absolute z-30 min-w-[180px] rounded-md border border-border bg-surface-elevated/95 text-xs text-text-secondary shadow-lg backdrop-blur"
    >
      {bucket !== undefined ? <TradesSection bucket={bucket} /> : null}
      {bucket !== undefined && cell !== undefined ? (
        <hr className="border-t border-border" />
      ) : null}
      {cell !== undefined ? <OrderbookSection cell={cell} /> : null}
    </div>
  );
});
