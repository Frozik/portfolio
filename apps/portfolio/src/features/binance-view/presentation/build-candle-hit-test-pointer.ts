import type { BinanceChartState } from '../application/chart-state';
import type { ICandleHitTestPointer } from '../domain/candle-hit-test';
import { plotHeightCssPx, plotWidthCssPx } from '../domain/math';
import { worldTimeAtCssX } from './build-trade-hit-test-pointer';

/**
 * Pointer descriptor for the candle hit-test, in CSS pixels. `undefined`
 * outside the price area — candles never reach into the volume panel.
 */
export function buildCandleHitTestPointer(
  event: { clientX: number; clientY: number; currentTarget: EventTarget | null },
  chartState: BinanceChartState
): ICandleHitTestPointer | undefined {
  const target = event.currentTarget;
  if (!(target instanceof HTMLCanvasElement)) {
    return undefined;
  }
  const rect = target.getBoundingClientRect();
  return buildCandleHitTestPointerFromCss(
    rect,
    event.clientX - rect.left,
    event.clientY - rect.top,
    chartState
  );
}

/** Same projection from a cached CSS-px offset, for the per-frame hover loop. */
export function buildCandleHitTestPointerFromCss(
  canvasRect: { readonly width: number; readonly height: number },
  cssX: number,
  cssY: number,
  chartState: BinanceChartState
): ICandleHitTestPointer | undefined {
  const plotWidthCss = plotWidthCssPx(canvasRect.width);
  const plotHeightCss = plotHeightCssPx(canvasRect.height);
  const isOverPriceArea = cssX >= 0 && cssX <= plotWidthCss && cssY >= 0 && cssY <= plotHeightCss;
  if (plotWidthCss <= 0 || !isOverPriceArea) {
    return undefined;
  }
  const worldTimeMs = worldTimeAtCssX(cssX, plotWidthCss, chartState);
  return worldTimeMs === undefined ? undefined : { worldTimeMs, pointerPx: { x: cssX, y: cssY } };
}
