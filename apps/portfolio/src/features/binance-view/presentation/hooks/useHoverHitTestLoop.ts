import { useFunction } from '@frozik/components/hooks/useFunction';
import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

import type { BinanceViewStore } from '../../application/BinanceViewStore';
import { buildTradeHitTestPointerFromCss } from '../build-trade-hit-test-pointer';

interface IPointerPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * Re-resolves what sits underneath a hovering (non-dragging) pointer on
 * every animation frame. This catches viewport motion — follow-mode
 * auto-pan, rAF-driven zoom / pan inertia — that changes what's under a
 * stationary mouse; without it the tooltip would freeze on the last
 * snapshot the cursor moved over. The trades hit-test runs alongside the
 * orderbook cell tooltip so the hover-pill / scale-up updates as buckets
 * pan under the cursor.
 */
export function useHoverHitTestLoop({
  store,
  canvasRef,
}: {
  readonly store: BinanceViewStore;
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
}): {
  readonly trackPointer: (point: IPointerPosition) => void;
  readonly clearTrackedPointer: VoidFunction;
  readonly stopHoverLoop: VoidFunction;
} {
  const pendingPointerRef = useRef<IPointerPosition | null>(null);
  const hoverActiveRef = useRef(false);
  const rafIdRef = useRef<number | undefined>(undefined);

  const hoverLoop = useFunction(() => {
    rafIdRef.current = undefined;
    if (!hoverActiveRef.current) {
      return;
    }
    const point = pendingPointerRef.current;
    if (point !== null) {
      void store.resolveCellAt(point);

      const tradesStore = store.tradesStore;
      const chartState = store.chartStateView;
      const canvas = canvasRef.current;
      if (tradesStore !== undefined && chartState !== undefined && canvas !== null) {
        const rect = canvas.getBoundingClientRect();
        const pointer = buildTradeHitTestPointerFromCss(rect, point.x, point.y, chartState);
        if (pointer !== undefined) {
          tradesStore.setHoveredBucketAt(pointer);
        }
      }
    }
    rafIdRef.current = requestAnimationFrame(hoverLoop);
  });

  const trackPointer = useFunction((point: IPointerPosition) => {
    pendingPointerRef.current = point;
    if (hoverActiveRef.current) {
      return;
    }
    hoverActiveRef.current = true;
    if (rafIdRef.current === undefined) {
      rafIdRef.current = requestAnimationFrame(hoverLoop);
    }
  });

  const clearTrackedPointer = useFunction(() => {
    pendingPointerRef.current = null;
  });

  const stopHoverLoop = useFunction(() => {
    hoverActiveRef.current = false;
    if (rafIdRef.current !== undefined) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = undefined;
    }
    pendingPointerRef.current = null;
  });

  useEffect(
    () => (): void => {
      hoverActiveRef.current = false;
      if (rafIdRef.current !== undefined) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = undefined;
      }
    },
    []
  );

  return { trackPointer, clearTrackedPointer, stopHoverLoop };
}
