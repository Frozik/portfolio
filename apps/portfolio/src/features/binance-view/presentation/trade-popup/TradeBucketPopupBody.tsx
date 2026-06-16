import { useVirtualizer } from '@tanstack/react-virtual';
import type { ReactElement } from 'react';
import { useMemo, useRef } from 'react';

import { Spinner } from '../../../../shared/ui/Spinner';
import { COLOR_BUY, COLOR_SELL } from '../../domain/trades-constants';
import type { ITrade } from '../../domain/trades-types';
import { binanceT } from '../translations';

import { buildWeightBarBackground } from './build-weight-bar-background';
import {
  PRICE_FRACTION_DIGITS,
  QUANTITY_FRACTION_DIGITS,
  ROW_HEIGHT_PX,
  ROW_OVERSCAN,
} from './constants';
import { formatTradeTime } from './format-trade-time';

export function TradeBucketPopupBody({
  trades,
  totalNotional,
  isLoading,
  maxHeightPx,
}: {
  readonly trades: readonly ITrade[];
  readonly totalNotional: number;
  readonly isLoading: boolean;
  readonly maxHeightPx: number;
}): ReactElement {
  // Sort by descending quantity. The bucket can hold up to ~2000 trades,
  // and this body re-renders on every scroll frame (the virtualizer drives
  // re-renders) — memoize so the sort only re-runs when the source array
  // identity changes, not on each scroll tick.
  const sorted = useMemo(
    () => [...trades].sort((left, right) => (right.quantity as number) - (left.quantity as number)),
    [trades]
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: ROW_OVERSCAN,
  });

  if (isLoading && sorted.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-2 py-4 text-center text-text-muted">
        <Spinner size="sm" />
        <span>{binanceT.tradePopup.loading}</span>
      </div>
    );
  }
  if (sorted.length === 0) {
    return <div className="px-2 py-3 text-center text-text-muted">{binanceT.tradePopup.empty}</div>;
  }
  return (
    <div
      ref={parentRef}
      className="overflow-y-auto px-1 py-1 font-mono"
      style={{ maxHeight: maxHeightPx }}
    >
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          position: 'relative',
          width: '100%',
        }}
      >
        {rowVirtualizer.getVirtualItems().map(virtualRow => {
          const trade = sorted[virtualRow.index];
          const quantityNumeric = trade.quantity as number;
          const weightFraction =
            totalNotional > 0 ? (trade.price * quantityNumeric) / totalNotional : 0;
          const sideHex = trade.isBuyerMaker ? COLOR_SELL : COLOR_BUY;
          const priceCellBackground = buildWeightBarBackground(weightFraction, sideHex);
          return (
            <div
              key={trade.tradeId}
              className="grid grid-cols-[auto_auto_auto_1fr] items-center gap-x-2 px-2"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <span className="text-text-muted">{formatTradeTime(trade.eventTimeMs)}</span>
              <span className={trade.isBuyerMaker ? 'text-error' : 'text-success'}>
                {trade.isBuyerMaker ? binanceT.tradePopup.sell : binanceT.tradePopup.buy}
              </span>
              <span className="text-text">{quantityNumeric.toFixed(QUANTITY_FRACTION_DIGITS)}</span>
              <span
                className="rounded-sm px-1.5 py-0.5 text-right text-text"
                style={{ background: priceCellBackground }}
              >
                {trade.price.toFixed(PRICE_FRACTION_DIGITS)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
