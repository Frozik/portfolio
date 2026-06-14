import type { ReactElement } from 'react';

import { binanceT } from '../translations';

export function TradeBucketPopupHeader({
  time,
  volume,
  vwap,
  tradeCount,
  onClose,
}: {
  readonly time: string;
  readonly volume: string;
  readonly vwap: string;
  readonly tradeCount: number;
  readonly onClose: () => void;
}): ReactElement {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
      <div className="font-mono">
        <div className="text-text">{time}</div>
        <div className="text-text">
          {binanceT.tradePopup.headerAggregates(volume, vwap, tradeCount)}
        </div>
      </div>
      <button
        type="button"
        aria-label={binanceT.tradePopup.close}
        className="rounded px-1.5 py-0.5 text-text-muted hover:bg-surface hover:text-text"
        onClick={onClose}
      >
        ×
      </button>
    </header>
  );
}
