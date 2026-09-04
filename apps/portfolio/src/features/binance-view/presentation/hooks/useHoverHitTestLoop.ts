import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

import type { BinanceViewStore } from '../../application/BinanceViewStore';
import { buildTradeHitTestPointerFromCss } from '../build-trade-hit-test-pointer';

interface IPointerPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * Re-resolves what sits under a hovering pointer every animation frame, so
 * follow-mode auto-pan and inertia keep the tooltip current under a
 * stationary mouse.
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
  const pendingPointerRef = useRef<IPointerPosition | undefined>(undefined);
  const hoverActiveRef = useRef(false);
  const rafIdRef = useRef<number | undefined>(undefined);

  const hoverLoop = useFunction(() => {
    rafIdRef.current = undefined;
    if (!hoverActiveRef.current) {
      return;
    }
    const point = pendingPointerRef.current;
    if (!isNil(point)) {
      void store.orderbookStore?.resolveCellAt(point);

      const tradesStore = store.tradesStore;
      const chartState = store.chartState;
      const canvas = canvasRef.current;
      if (!isNil(tradesStore) && !isNil(chartState) && !isNil(canvas)) {
        const rect = canvas.getBoundingClientRect();
        const pointer = buildTradeHitTestPointerFromCss(rect, point.x, point.y, chartState);
        if (!isNil(pointer)) {
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
    pendingPointerRef.current = undefined;
  });

  const stopHoverLoop = useFunction(() => {
    hoverActiveRef.current = false;
    if (rafIdRef.current !== undefined) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = undefined;
    }
    pendingPointerRef.current = undefined;
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
