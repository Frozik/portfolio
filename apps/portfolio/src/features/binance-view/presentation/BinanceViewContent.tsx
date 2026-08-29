import { useFunction } from '@frozik/components/hooks/useFunction';
import { useKeyboardAction } from '@frozik/components/hooks/useKeyboardAction';
import { observer } from 'mobx-react-lite';
import type React from 'react';
import { useEffect, useRef } from 'react';

import { TopNavCenterPortal } from '../../../app/components/TopNavCenterContext';
import { useBinanceViewStore } from '../application/useBinanceViewStore';
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
import { TradeBucketPopup } from './TradeBucketPopup';

export const BinanceViewContent = observer(() => {
  const store = useBinanceViewStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerStartRef = useRef<{ x: number; y: number; type: string } | null>(null);
  const lastHoverProbeRef = useRef<{ x: number; y: number } | null>(null);
  const { hoverAnchor, scheduleHoverAnchor, clearHoverAnchor } = useHoverAnchor();
  const { trackPointer, clearTrackedPointer, stopHoverLoop } = useHoverHitTestLoop({
    store,
    canvasRef,
  });

  const handleCanvasPointerMove = useFunction((event: React.PointerEvent<HTMLCanvasElement>) => {
    // Suppress hover resolution while any pointer button is held — the
    // viewport controller treats that as a pan, and a lingering tooltip
    // on top of a dragged chart is distracting.
    if (event.buttons !== 0) {
      return;
    }
    // While the click-pinned popup is open, freeze the hover overlays
    // (orderbook tooltip + trade hover-pill / scale) and the crosshair.
    // The crosshair side is handled by the viewport controller's
    // `setCursorSuppressed`; here we just bail before scheduling a
    // hover hit-test or moving the popup anchor.
    if (store.tradesStore?.pinnedBucket !== undefined) {
      clearTrackedPointer();
      lastHoverProbeRef.current = null;
      clearHoverAnchor();
      return;
    }
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;
    trackPointer({ x: cssX, y: cssY });
    // Anchor for the unified hover popup — orderbook cell + trades
    // bucket sections share this position so the popup follows the
    // cursor regardless of which section is currently active. rAF-
    // throttled so a burst of pointer events coalesces into one render.
    scheduleHoverAnchor({ x: cssX, y: cssY });

    // Trades hover hit-test runs alongside the orderbook cell tooltip.
    // Touch pointers don't get hover (no preview pill) — only mouse/pen.
    if (event.pointerType === 'touch') {
      return;
    }
    const last = lastHoverProbeRef.current;
    if (last !== null) {
      const ddx = event.clientX - last.x;
      const ddy = event.clientY - last.y;
      if (Math.sqrt(ddx * ddx + ddy * ddy) < HOVER_DEAD_ZONE_PX) {
        return;
      }
    }
    lastHoverProbeRef.current = { x: event.clientX, y: event.clientY };
    const tradesStore = store.tradesStore;
    const chartState = store.chartStateView;
    if (tradesStore === undefined || chartState === undefined) {
      return;
    }
    const pointer = buildTradeHitTestPointer(event, chartState);
    if (pointer === undefined) {
      return;
    }
    tradesStore.setHoveredBucketAt(pointer);
  });

  const handleCanvasPointerDown = useFunction((event: React.PointerEvent<HTMLCanvasElement>) => {
    stopHoverLoop();
    store.clearSelectedCell();
    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      type: event.pointerType,
    };
  });

  const handleCanvasPointerUp = useFunction((event: React.PointerEvent<HTMLCanvasElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (start === null) {
      return;
    }
    // The viewport only pans along the X (time) axis — Y is auto-fitted
    // around the live mid-price. So tap-vs-drag is a horizontal-only
    // question: a finger tap that wobbles vertically must still register
    // as a tap. On Android-portrait, a thumb reaching to the top or
    // bottom of the canvas pivots a few CSS px on Y just from the natural
    // grip — with a 2D euclidean threshold those wobbles cleared 8 px and
    // the bucket popup silently failed to open. Matching the input
    // controller's X-only pan-distance keeps the two boundaries
    // consistent.
    const dx = Math.abs(event.clientX - start.x);
    const threshold =
      start.type === 'touch' ? MIN_DRAG_DISTANCE_PX_TOUCH : MIN_DRAG_DISTANCE_PX_MOUSE;
    if (dx >= threshold) {
      return;
    }
    const tradesStore = store.tradesStore;
    const chartState = store.chartStateView;
    if (tradesStore === undefined || chartState === undefined) {
      return;
    }
    const pointer = buildTradeHitTestPointer(event, chartState);
    if (pointer === undefined) {
      return;
    }
    tradesStore.selectBucketAt(pointer);
  });

  const handleCanvasPointerLeave = useFunction(() => {
    stopHoverLoop();
    store.clearSelectedCell();
    store.tradesStore?.clearHoveredBucket();
    clearHoverAnchor();
    lastHoverProbeRef.current = null;
  });

  const handleCanvasContextMenu = useFunction((event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
  });

  const handleClosePopup = useFunction(() => {
    store.tradesStore?.clearPinnedBucket();
  });

  const handleEscapeKey = useFunction(() => {
    store.tradesStore?.clearPinnedBucket();
  });

  useKeyboardAction('Escape', handleEscapeKey);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    let active = true;

    const attachAndStream = async (): Promise<void> => {
      try {
        await store.attachCanvas(canvas);
      } catch (error) {
        // Route a rejected `attachCanvas` to the `'unsupported'` overlay rather than letting
        // an unhandled rejection leave the status badge stuck on `'connecting'`.
        // biome-ignore lint/suspicious/noConsole: surfaces canvas attach failure
        console.warn('binance-view: attachCanvas failed', error);
        store.markUnsupported();
        return;
      }
      if (!active) {
        return;
      }
      store.startStream();
    };

    void attachAndStream();

    return () => {
      active = false;
      stopHoverLoop();
      clearHoverAnchor();
      store.dispose();
    };
  }, [store, stopHoverLoop, clearHoverAnchor]);

  const tradesStore = store.tradesStore;
  const isHoveringTradeBucket = tradesStore?.hoveredBucketKey !== undefined;
  const pinnedBucket = tradesStore?.pinnedBucket;
  const isPopupPinned = pinnedBucket !== undefined;
  const pinnedTrades =
    pinnedBucket === undefined || tradesStore === undefined
      ? undefined
      : (tradesStore.getRawTradesForBucket(pinnedBucket.blockId, pinnedBucket.bucketStartMs) ?? []);

  // Freeze every hover-overlay surface while the click-pinned popup is
  // open so the crosshair / orderbook tooltip / trade-bucket hover-pill
  // don't shift under the cursor as the user reads the popup. Pan and
  // zoom keep working through the native input listeners.
  useEffect(() => {
    const chartState = store.chartStateView;
    chartState?.viewportController.setCursorSuppressed(isPopupPinned);
    if (isPopupPinned) {
      clearHoverAnchor();
      store.clearSelectedCell();
      tradesStore?.clearHoveredBucket();
      lastHoverProbeRef.current = null;
    }
  }, [isPopupPinned, store, tradesStore, clearHoverAnchor]);

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
      <TopNavCenterPortal>
        <div className="flex items-center gap-2">
          <InstrumentSelector />
          <BinanceStatusBadge />
        </div>
      </TopNavCenterPortal>
      {hoverAnchor !== null ? <HoverInfoPopup anchorPx={hoverAnchor} /> : null}
      {pinnedBucket !== undefined && tradesStore !== undefined ? (
        <TradeBucketPopup
          hit={pinnedBucket}
          trades={pinnedTrades ?? []}
          tradesStore={tradesStore}
          onClose={handleClosePopup}
        />
      ) : null}
    </div>
  );
});
