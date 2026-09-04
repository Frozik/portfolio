import { isMinuteBoundary, pickTimeStepMs } from './axis-scale';
import type { UnixTimeMs } from './types';

/** An axis-aligned grid line as a rectangle in CSS pixels of the plot area. */
export interface IGridRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface IGridLinesInput {
  readonly plotWidthCss: number;
  readonly plotHeightCss: number;
  readonly viewTimeStartMs: UnixTimeMs;
  readonly viewTimeEndMs: UnixTimeMs;
  readonly priceMin: number;
  readonly priceMax: number;
  readonly priceStep: number;
}

const MINUTE_LINE_WIDTH_PX = 3;
const DEFAULT_LINE_WIDTH_PX = 1;

function timeGridRects(input: IGridLinesInput): IGridRect[] {
  const { plotWidthCss, plotHeightCss, viewTimeStartMs, viewTimeEndMs } = input;
  const rangeMs = viewTimeEndMs - viewTimeStartMs;
  if (rangeMs <= 0 || plotWidthCss <= 0) {
    return [];
  }
  const stepMs = pickTimeStepMs(rangeMs, plotWidthCss);
  const firstTickMs = Math.ceil(viewTimeStartMs / stepMs) * stepMs;
  const rects: IGridRect[] = [];
  for (let tickMs = firstTickMs; tickMs <= viewTimeEndMs; tickMs += stepMs) {
    const width = isMinuteBoundary(tickMs) ? MINUTE_LINE_WIDTH_PX : DEFAULT_LINE_WIDTH_PX;
    const x = ((tickMs - viewTimeStartMs) / rangeMs) * plotWidthCss;
    rects.push({ left: x - width / 2, top: 0, width, height: plotHeightCss });
  }
  return rects;
}

/** One horizontal line per aggregation-bin boundary, matching the heatmap rows. */
function priceGridRects(input: IGridLinesInput): IGridRect[] {
  const { plotWidthCss, plotHeightCss, priceMin, priceMax, priceStep } = input;
  const range = priceMax - priceMin;
  if (range <= 0 || priceStep <= 0 || plotHeightCss <= 0) {
    return [];
  }
  const halfStep = priceStep / 2;
  const firstBoundary = Math.ceil((priceMin + halfStep) / priceStep) * priceStep;
  const rects: IGridRect[] = [];
  for (let boundary = firstBoundary; boundary <= priceMax + halfStep; boundary += priceStep) {
    const normalized = (boundary - halfStep - priceMin) / range;
    const y = plotHeightCss - normalized * plotHeightCss;
    rects.push({
      left: 0,
      top: y - DEFAULT_LINE_WIDTH_PX / 2,
      width: plotWidthCss,
      height: DEFAULT_LINE_WIDTH_PX,
    });
  }
  return rects;
}

/** Background grid drawn under the heatmap cells: time ticks and price-bin boundaries. */
export function computeGridRects(input: IGridLinesInput): readonly IGridRect[] {
  return [...timeGridRects(input), ...priceGridRects(input)];
}
