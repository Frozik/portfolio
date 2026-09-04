import { Temporal } from 'temporal-polyfill';

import { VOLUME_BARS_CSS_PX } from './constants';
import { plotHeightCssPx, plotWidthCssPx } from './math';

export interface IAxisRect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface ICanvasDimensions {
  readonly canvasWidthPx: number;
  readonly canvasHeightPx: number;
  readonly devicePixelRatio: number;
}

function canvasCss(dimensions: ICanvasDimensions): {
  readonly width: number;
  readonly height: number;
} {
  return {
    width: dimensions.canvasWidthPx / dimensions.devicePixelRatio,
    height: dimensions.canvasHeightPx / dimensions.devicePixelRatio,
  };
}

/**
 * The plot rect is the price area in CSS pixels — the canvas minus the
 * right-hand Y-axis panel and the volume panel below. The GPU shaders map
 * time and price across the same rect, so labels align with cells.
 */
export function buildPlotRect(dimensions: ICanvasDimensions): IAxisRect {
  const { width, height } = canvasCss(dimensions);
  return { left: 0, right: plotWidthCssPx(width), top: 0, bottom: plotHeightCssPx(height) };
}

/** Right-hand strip that hosts per-level price rectangles, spanning the price area. */
export function buildYAxisRect(dimensions: ICanvasDimensions): IAxisRect {
  const { width, height } = canvasCss(dimensions);
  return { left: plotWidthCssPx(width), right: width, top: 0, bottom: plotHeightCssPx(height) };
}

/** Band under the price area where the per-second volume bars live. */
export function buildVolumeBarsRect(dimensions: ICanvasDimensions): IAxisRect {
  const { width, height } = canvasCss(dimensions);
  const top = plotHeightCssPx(height);
  return { left: 0, right: plotWidthCssPx(width), top, bottom: top + VOLUME_BARS_CSS_PX };
}

/** Strip along the canvas bottom, under the volume bars, that hosts the time labels. */
export function buildTimeAxisLabelsRect(dimensions: ICanvasDimensions): IAxisRect {
  const { width, height } = canvasCss(dimensions);
  const top = plotHeightCssPx(height) + VOLUME_BARS_CSS_PX;
  return { left: 0, right: plotWidthCssPx(width), top, bottom: height };
}

export function priceToY(
  price: number,
  rect: IAxisRect,
  priceMin: number,
  priceMax: number
): number {
  const range = priceMax - priceMin;
  if (range <= 0) {
    return rect.bottom;
  }
  const heightPx = rect.bottom - rect.top;
  const normalized = (price - priceMin) / range;
  return rect.bottom - normalized * heightPx;
}

export const PRICE_DEFAULT_FRACTION_DIGITS = 2;
const MAX_FRACTION_DIGITS = 8;

export function fractionDigitsFor(step: number): number {
  if (step >= 1) {
    return 0;
  }
  return Math.min(MAX_FRACTION_DIGITS, Math.ceil(-Math.log10(step)));
}

export function priceFractionDigits(priceStep: number): number {
  return Math.max(PRICE_DEFAULT_FRACTION_DIGITS, fractionDigitsFor(priceStep));
}

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const MIN_X_TICK_SPACING_PX = 80;
const MIN_TARGET_TICKS = 2;

const TIME_STEP_CANDIDATES_MS: readonly number[] = [
  SECOND_MS,
  2 * SECOND_MS,
  5 * SECOND_MS,
  10 * SECOND_MS,
  15 * SECOND_MS,
  30 * SECOND_MS,
  MINUTE_MS,
  2 * MINUTE_MS,
  5 * MINUTE_MS,
  10 * MINUTE_MS,
  15 * MINUTE_MS,
  30 * MINUTE_MS,
  HOUR_MS,
];

export function pickTimeStepMs(rangeMs: number, plotWidthPx: number): number {
  const maxTicks = Math.max(MIN_TARGET_TICKS, Math.floor(plotWidthPx / MIN_X_TICK_SPACING_PX));
  const rawStep = rangeMs / maxTicks;
  return TIME_STEP_CANDIDATES_MS.find(candidate => candidate >= rawStep) ?? HOUR_MS;
}

export function isMinuteBoundary(timestampMs: number): boolean {
  return timestampMs % MINUTE_MS === 0;
}

export function floorToSecond(timestampMs: number): number {
  return Math.floor(timestampMs / SECOND_MS) * SECOND_MS;
}

const TIME_PAD = 2;

export function formatTimeLabel(timestampMs: number): string {
  const time = Temporal.Instant.fromEpochMilliseconds(timestampMs)
    .toZonedDateTimeISO('UTC')
    .toPlainTime();
  const hours = time.hour.toString().padStart(TIME_PAD, '0');
  const minutes = time.minute.toString().padStart(TIME_PAD, '0');
  const seconds = time.second.toString().padStart(TIME_PAD, '0');
  return `${hours}:${minutes}:${seconds}`;
}

const THOUSAND = 1e3;
const MILLION = 1e6;
const VOLUME_K_FRACTION_DIGITS = 3;
const VOLUME_M_FRACTION_DIGITS = 3;
const VOLUME_DEFAULT_FRACTION_DIGITS = 2;

/** Compact `458.886K` / `2.696M` volume label that fits inside a narrow bar. */
export function formatVolumeLabel(volume: number): string {
  if (volume >= MILLION) {
    return `${(volume / MILLION).toFixed(VOLUME_M_FRACTION_DIGITS)}M`;
  }
  if (volume >= THOUSAND) {
    return `${(volume / THOUSAND).toFixed(VOLUME_K_FRACTION_DIGITS)}K`;
  }
  return volume.toFixed(VOLUME_DEFAULT_FRACTION_DIGITS);
}
