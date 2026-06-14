import type { BinanceChartState } from '../application/chart-state';
import type { ITradeHitTestPointer } from '../application/TradesStreamStore';
import { plotWidthCssPx } from '../domain/math';
import type { UnixTimeMs } from '../domain/types';

/**
 * Build the **CSS-pixel-space** pointer descriptor consumed by
 * {@link import('../application/TradesStreamStore').TradesStreamStore.selectBucketAt}
 * / `setHoveredBucketAt`. Anchors the pointer's screen position to the
 * live viewport (X — `viewTimeStartMs..viewTimeEndMs` projected onto the
 * canvas plot area; Y — `priceMin..priceMax` mapped to canvas height).
 *
 * Why CSS px throughout — popup / hover-pill use these coordinates
 * directly as `style.left`/`style.top` in the DOM, which is CSS-px-
 * native. Mixing device px would land overlays at `dpr`× their
 * intended position on Retina displays. Hit-test math operates in the
 * same unit system because:
 *   - `pointer.priceTickPx` is the CSS-px height of one `priceStep`.
 *   - `worldToPx` returns CSS-px positions.
 *   - `visualRadius = computeRadiusPx(volume, stats, rMinPx, rMaxPx)`
 *     is in CSS px (the inputs are CSS px).
 *   - Distance comparison stays in CSS px.
 * The renderer keeps device px internally for GPU work; the unit
 * mismatch with the renderer is harmless because both ultimately
 * project to the same on-screen pixels — the hit-test is computing
 * "the same circle" in CSS-px space, the renderer in device-px space.
 *
 * Returns `undefined` when the canvas geometry is degenerate (zero
 * width/height, zero time range, zero price range) — the store's
 * hit-test would otherwise divide by zero.
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

/**
 * Same projection as {@link buildTradeHitTestPointer} but driven by a
 * pre-computed CSS-pixel offset inside the canvas rect. Used by the
 * RAF hover loop in `BinanceView.tsx` so the trades hit-test can be
 * re-evaluated each frame against the cached pointer position even
 * while no `pointermove` event fires (e.g. follow-mode auto-pan
 * scrolling the chart underneath a stationary cursor).
 */
export function buildTradeHitTestPointerFromCss(
  canvasRect: { readonly width: number; readonly height: number },
  cssX: number,
  cssY: number,
  chartState: BinanceChartState
): ITradeHitTestPointer | undefined {
  if (canvasRect.width <= 0 || canvasRect.height <= 0) {
    return undefined;
  }
  const plotWidthCss = plotWidthCssPx(canvasRect.width);
  if (plotWidthCss <= 0) {
    return undefined;
  }

  const viewport = chartState.viewport;
  const viewTimeStartMs = chartState.viewportController.viewTimeStartMsForPlotWidth(plotWidthCss);
  const viewTimeEndMs = viewport.viewTimeEndMs;
  const timeRangeMs = viewTimeEndMs - viewTimeStartMs;
  if (timeRangeMs <= 0) {
    return undefined;
  }

  const priceMin = viewport.priceMin;
  const priceMax = viewport.priceMax;
  const priceRange = priceMax - priceMin;
  if (priceRange <= 0) {
    return undefined;
  }

  const fracX = cssX / plotWidthCss;
  const worldTimeMs = (viewTimeStartMs + fracX * timeRangeMs) as UnixTimeMs;
  const msPerPx = timeRangeMs / plotWidthCss;

  const canvasHeightCssPx = canvasRect.height;
  const priceStep = chartState.currentPriceStep;
  const priceTickPx = (priceStep / priceRange) * canvasHeightCssPx;

  const worldToPx = (
    timeMs: UnixTimeMs,
    price: number
  ): { readonly x: number; readonly y: number } => {
    const x = ((timeMs - viewTimeStartMs) / timeRangeMs) * plotWidthCss;
    const y = ((priceMax - price) / priceRange) * canvasHeightCssPx;
    return { x, y };
  };

  return {
    worldTimeMs,
    priceTickPx,
    msPerPx,
    pointerPx: { x: cssX, y: cssY },
    worldToPx,
  };
}
