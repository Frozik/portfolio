import type { BinanceChartState } from '../application/chart-state';
import { VOLUME_BARS_CSS_PX } from '../domain/constants';
import { plotHeightCssPx, plotWidthCssPx } from '../domain/math';
import type { ITradeHitTestPointer } from '../domain/trades-hit-test';
import type { UnixTimeMs } from '../domain/types';

/**
 * Pointer descriptor for the trades hit-test, in CSS pixels so the popup
 * anchors agree with the DOM on Retina displays. `undefined` outside the
 * volume panel — the only surface where trade buckets are hoverable.
 */
export function buildTradeHitTestPointer(
  event: { clientX: number; clientY: number; currentTarget: EventTarget | null },
  chartState: BinanceChartState
): ITradeHitTestPointer | undefined {
  const target = event.currentTarget;
  if (!(target instanceof HTMLCanvasElement)) {
    return undefined;
  }
  const rect = target.getBoundingClientRect();
  return buildTradeHitTestPointerFromCss(
    rect,
    event.clientX - rect.left,
    event.clientY - rect.top,
    chartState
  );
}

/** Same projection from a cached CSS-px offset, for the per-frame hover loop. */
export function buildTradeHitTestPointerFromCss(
  canvasRect: { readonly width: number; readonly height: number },
  cssX: number,
  cssY: number,
  chartState: BinanceChartState
): ITradeHitTestPointer | undefined {
  const plotWidthCss = plotWidthCssPx(canvasRect.width);
  const panelTopCss = plotHeightCssPx(canvasRect.height);
  const isOverVolumePanel =
    cssX >= 0 &&
    cssX <= plotWidthCss &&
    cssY > panelTopCss &&
    cssY <= panelTopCss + VOLUME_BARS_CSS_PX;
  if (plotWidthCss <= 0 || !isOverVolumePanel) {
    return undefined;
  }

  const viewTimeStartMs = chartState.viewportController.viewTimeStartMsForPlotWidth(plotWidthCss);
  const timeRangeMs = chartState.viewport.viewTimeEndMs - viewTimeStartMs;
  if (timeRangeMs <= 0) {
    return undefined;
  }
  const worldTimeMs = (viewTimeStartMs + (cssX / plotWidthCss) * timeRangeMs) as UnixTimeMs;
  return { worldTimeMs, pointerPx: { x: cssX, y: cssY } };
}
