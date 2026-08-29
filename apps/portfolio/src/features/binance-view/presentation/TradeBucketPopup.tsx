import { useFunction } from '@frozik/components/hooks/useFunction';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';

import { Drawer } from '../../../shared/ui/Drawer';
import type { TradesStreamStore } from '../application/TradesStreamStore';
import type { ITrade, ITradeBucketHitTestResult } from '../domain/trades-types';
import {
  POPUP_MAX_HEIGHT_PX,
  VOLUME_FRACTION_DIGITS,
  VWAP_FRACTION_DIGITS,
} from './trade-popup/constants';
import { DesktopAnchoredPopup } from './trade-popup/DesktopAnchoredPopup';
import { formatBucketStart } from './trade-popup/format-trade-time';
import { TradeBucketPopupBody } from './trade-popup/TradeBucketPopupBody';
import { TradeBucketPopupHeader } from './trade-popup/TradeBucketPopupHeader';
import { useIsMobileViewport } from './trade-popup/use-is-mobile-viewport';
import { useTapSelectLockout } from './trade-popup/use-tap-select-lockout';
import { binanceT } from './translations';

/**
 * Click-pinned popup that lists every raw trade aggregated into a
 * bucket. Sorted by quantity desc so whales sit at the top.
 *
 * Two layouts share the same content:
 *   - **Desktop** — absolute-positioned panel anchored at the click
 *     point, edge-aware (flips to the opposite quadrant near the
 *     canvas edges). Mirrors the orderbook tooltip policy.
 *   - **Mobile** — a {@link Drawer} bottom-sheet. Same content,
 *     full-width sheet so the table is readable without precise
 *     tap-positioning.
 *
 * Layout selection is reactive: a `matchMedia` listener flips between
 * the two when the viewport crosses the breakpoint mid-session.
 */
export const TradeBucketPopup = observer(function TradeBucketPopup({
  hit,
  trades,
  tradesStore,
  onClose,
}: {
  readonly hit: ITradeBucketHitTestResult;
  readonly trades: readonly ITrade[];
  readonly tradesStore: TradesStreamStore;
  readonly onClose: () => void;
}) {
  const handleClose = useFunction(() => {
    onClose();
  });

  const isMobile = useIsMobileViewport();
  // Suppress text-selection on the popup for the first ~400 ms after
  // mount so a touch-tap that drifts on the canvas doesn't leak its
  // residual "drag-to-select" gesture into freshly-mounted popup text
  // on Android Chrome (see hook docstring for the gesture rationale).
  const isSelectLocked = useTapSelectLockout();
  const lockedSelectClass = isSelectLocked ? 'select-none' : '';

  const [isLoading, setIsLoading] = useState(false);

  // When the bucket's block has been evicted from the in-RAM cache,
  // `trades.length === 0` is the popup's only signal to fetch from
  // IDB. The store's reload-token guard handles concurrent reloads of
  // the same block — we just kick the flow and toggle the spinner.
  useEffect(() => {
    if (trades.length > 0) {
      setIsLoading(false);
      return;
    }
    let active = true;
    setIsLoading(true);
    void tradesStore.loadRawTradesFromIDB(hit.blockId).finally(() => {
      if (active) {
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [hit.blockId, trades.length, tradesStore]);

  const vwapNumeric = hit.bucket.vwap;
  const volumeNumeric = hit.bucket.volumeTotal;
  const totalNotional = vwapNumeric * volumeNumeric;
  const volume = volumeNumeric.toFixed(VOLUME_FRACTION_DIGITS);
  const vwap = vwapNumeric.toFixed(VWAP_FRACTION_DIGITS);
  const time = formatBucketStart(hit.bucket.bucketStartMs);
  const tradeCount = trades.length;

  if (isMobile) {
    return (
      <Drawer open={true} onClose={handleClose} placement="right" title={time}>
        <div className={`flex flex-col gap-2 text-xs text-text-secondary ${lockedSelectClass}`}>
          <div className="font-mono text-text">
            {binanceT.tradePopup.headerAggregates(volume, vwap, tradeCount)}
          </div>
          <TradeBucketPopupBody
            trades={trades}
            totalNotional={totalNotional}
            isLoading={isLoading}
            // The drawer's own scrolling container handles overflow; we
            // pass a generous max-height so the inner virtualizer still
            // measures correctly without competing for vertical space.
            maxHeightPx={Number.POSITIVE_INFINITY}
          />
        </div>
      </Drawer>
    );
  }

  return (
    <DesktopAnchoredPopup pointerPx={hit.pointerPx}>
      <TradeBucketPopupHeader
        time={time}
        volume={volume}
        vwap={vwap}
        tradeCount={tradeCount}
        onClose={handleClose}
      />
      <TradeBucketPopupBody
        trades={trades}
        totalNotional={totalNotional}
        isLoading={isLoading}
        maxHeightPx={POPUP_MAX_HEIGHT_PX}
      />
    </DesktopAnchoredPopup>
  );
});
