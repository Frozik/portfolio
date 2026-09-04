import { useFunction } from '@frozik/components/hooks/useFunction';
import { useKeyboardAction } from '@frozik/components/hooks/useKeyboardAction';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { TopNavCenterPortal } from '../../../app/components/TopNavCenterContext';
import { useBinanceViewStore } from '../application/useBinanceViewStore';
import { DEFAULT_INSTRUMENT, parseInstrumentSymbol } from '../domain/instruments';
import {
  HOVER_DEAD_ZONE_PX,
  MIN_DRAG_DISTANCE_PX_MOUSE,
  MIN_DRAG_DISTANCE_PX_TOUCH,
} from '../domain/trades-constants';

import { BinanceStatusBadge } from './BinanceStatusBadge';
import { buildTradeHitTestPointer } from './build-trade-hit-test-pointer';
import { HoverInfoPopup } from './HoverInfoPopup';
import { useHoverAnchor } from './hooks/useHoverAnchor';
import { useHoverHitTestLoop } from './hooks/useHoverHitTestLoop';
import { InstrumentSelector } from './InstrumentSelector';
import { instrumentRoute } from './instrument-route';
import { TradeBucketPopup } from './TradeBucketPopup';

interface IPointerStart {
  readonly x: number;
  readonly y: number;
  readonly type: string;
}

interface IClientPoint {
  readonly x: number;
  readonly y: number;
}

export const BinanceViewContent = observer(() => {
  const store = useBinanceViewStore();
  const { instrument: instrumentParam } = useParams<{ instrument: string | undefined }>();
  const routeInstrument = parseInstrumentSymbol(instrumentParam);
  const instrument = routeInstrument ?? DEFAULT_INSTRUMENT.symbol;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const pointerStartRef = useRef<IPointerStart | undefined>(undefined);
  const lastHoverProbeRef = useRef<IClientPoint | undefined>(undefined);
  const { hoverAnchor, scheduleHoverAnchor, clearHoverAnchor } = useHoverAnchor();
  const { trackPointer, clearTrackedPointer, stopHoverLoop } = useHoverHitTestLoop({
    store,
    canvasRef,
  });

  const handleCanvasPointerMove = useFunction((event: React.PointerEvent<HTMLCanvasElement>) => {
    // A held button is a pan; a lingering tooltip over a dragged chart distracts.
    if (event.buttons !== 0) {
      return;
    }
    // A pinned popup freezes every hover surface so nothing shifts under the reader.
    if (!isNil(store.tradesStore?.pinnedBucket)) {
      clearTrackedPointer();
      lastHoverProbeRef.current = undefined;
      clearHoverAnchor();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const cssPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    trackPointer(cssPoint);
    scheduleHoverAnchor(cssPoint);

    // Touch pointers get no hover preview — only mouse and pen do.
    if (event.pointerType === 'touch') {
      return;
    }
    const last = lastHoverProbeRef.current;
    if (
      !isNil(last) &&
      Math.hypot(event.clientX - last.x, event.clientY - last.y) < HOVER_DEAD_ZONE_PX
    ) {
      return;
    }
    lastHoverProbeRef.current = { x: event.clientX, y: event.clientY };

    const tradesStore = store.tradesStore;
    const chartState = store.chartState;
    if (isNil(tradesStore) || isNil(chartState)) {
      return;
    }
    const pointer = buildTradeHitTestPointer(event, chartState);
    if (!isNil(pointer)) {
      tradesStore.setHoveredBucketAt(pointer);
    }
  });

  const handleCanvasPointerDown = useFunction((event: React.PointerEvent<HTMLCanvasElement>) => {
    stopHoverLoop();
    store.orderbookStore?.clearSelectedCell();
    pointerStartRef.current = { x: event.clientX, y: event.clientY, type: event.pointerType };
  });

  const handleCanvasPointerUp = useFunction((event: React.PointerEvent<HTMLCanvasElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = undefined;
    if (isNil(start)) {
      return;
    }
    // The viewport pans along X only, so tap-vs-drag is a horizontal question: a
    // thumb wobbling vertically on a portrait phone must still register as a tap.
    const horizontalDistance = Math.abs(event.clientX - start.x);
    const threshold =
      start.type === 'touch' ? MIN_DRAG_DISTANCE_PX_TOUCH : MIN_DRAG_DISTANCE_PX_MOUSE;
    if (horizontalDistance >= threshold) {
      return;
    }
    const tradesStore = store.tradesStore;
    const chartState = store.chartState;
    if (isNil(tradesStore) || isNil(chartState)) {
      return;
    }
    const pointer = buildTradeHitTestPointer(event, chartState);
    if (!isNil(pointer)) {
      tradesStore.selectBucketAt(pointer);
    }
  });

  const handleCanvasPointerLeave = useFunction(() => {
    stopHoverLoop();
    store.orderbookStore?.clearSelectedCell();
    store.tradesStore?.clearHoveredBucket();
    clearHoverAnchor();
    lastHoverProbeRef.current = undefined;
  });

  const handleCanvasContextMenu = useFunction((event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
  });

  const handleClosePopup = useFunction(() => {
    store.tradesStore?.clearPinnedBucket();
  });

  useKeyboardAction('Escape', handleClosePopup);

  // The route is the source of truth for the instrument; the store follows it.
  useEffect(() => {
    void store.setInstrument(instrument);
  }, [store, instrument]);

  useEffect(() => {
    const chartCanvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (isNil(chartCanvas) || isNil(overlayCanvas)) {
      return undefined;
    }
    void store.attachCanvas({ chartCanvas, overlayCanvas });
    return () => {
      stopHoverLoop();
      clearHoverAnchor();
      store.detachCanvas();
    };
  }, [store, stopHoverLoop, clearHoverAnchor]);

  const tradesStore = store.tradesStore;
  const isHoveringTradeBucket = !isNil(tradesStore?.hoveredBucketKey);
  const pinnedBucket = tradesStore?.pinnedBucket;
  const isPopupPinned = !isNil(pinnedBucket);
  const pinnedTrades =
    isNil(pinnedBucket) || isNil(tradesStore)
      ? []
      : (tradesStore.getRawTradesForBucket(pinnedBucket.blockId, pinnedBucket.bucketStartMs) ?? []);

  useEffect(() => {
    store.chartState?.viewportController.setCursorSuppressed(isPopupPinned);
    if (isPopupPinned) {
      clearHoverAnchor();
      store.orderbookStore?.clearSelectedCell();
      tradesStore?.clearHoveredBucket();
      lastHoverProbeRef.current = undefined;
    }
  }, [isPopupPinned, store, tradesStore, clearHoverAnchor]);

  if (!isNil(instrumentParam) && isNil(routeInstrument)) {
    return <Navigate replace to={instrumentRoute(DEFAULT_INSTRUMENT.symbol)} />;
  }

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full select-none [-webkit-touch-callout:none] [-webkit-user-select:none] [touch-action:none] ${isHoveringTradeBucket ? 'cursor-pointer' : ''}`}
        onPointerMove={handleCanvasPointerMove}
        onPointerDown={handleCanvasPointerDown}
        onPointerUp={handleCanvasPointerUp}
        onPointerLeave={handleCanvasPointerLeave}
        onContextMenu={handleCanvasContextMenu}
      />
      <canvas
        ref={overlayCanvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      <TopNavCenterPortal>
        <div className="flex items-center gap-2">
          <InstrumentSelector />
          <BinanceStatusBadge />
        </div>
      </TopNavCenterPortal>
      {isNil(hoverAnchor) ? null : <HoverInfoPopup anchorPx={hoverAnchor} />}
      {!isNil(pinnedBucket) && !isNil(tradesStore) ? (
        <TradeBucketPopup
          hit={pinnedBucket}
          trades={pinnedTrades}
          tradesStore={tradesStore}
          onClose={handleClosePopup}
        />
      ) : null}
    </div>
  );
});
