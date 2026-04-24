import { Temporal } from 'temporal-polyfill';

import type { IAxisTick } from './types';
import { ETimeScale } from './types';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/** Base nice multipliers — scaled by powers of 10 to cover any range. */
const NICE_BASES = [1, 2, 5];
const TARGET_Y_TICK_COUNT = 8;
const MIN_Y_TICK_COUNT = 2;

/** Approximate width of a tick label in pixels for spacing calculations. */
const X_LABEL_WIDTH_PX = 70;
const Y_LABEL_HEIGHT_PX = 20;
const MIN_LABEL_GAP_PX = 10;

function epochToInstant(epochSeconds: number): Temporal.Instant {
  const ns = BigInt(Math.trunc(epochSeconds)) * 1_000_000_000n;
  return Temporal.Instant.fromEpochNanoseconds(ns);
}

function formatHourMinute(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Thin out ticks so that labels don't overlap.
 * Keeps only ticks that are at least `minPixelGap` apart in pixel space.
 */
function thinTicks(
  ticks: IAxisTick[],
  rangeStart: number,
  rangeEnd: number,
  axisLengthPx: number,
  labelSizePx: number
): IAxisTick[] {
  if (ticks.length <= 1 || axisLengthPx <= 0) {
    return ticks;
  }

  const range = rangeEnd - rangeStart;

  if (range <= 0) {
    return ticks;
  }

  const minGap = labelSizePx + MIN_LABEL_GAP_PX;
  const result: IAxisTick[] = [];
  let lastPixel = Number.NEGATIVE_INFINITY;

  for (const tick of ticks) {
    const pixel = ((tick.position - rangeStart) / range) * axisLengthPx;

    if (pixel - lastPixel >= minGap) {
      result.push(tick);
      lastPixel = pixel;
    }
  }

  return result;
}

/**
 * Generate X-axis ticks for the given time range and scale.
 * Positions are in epoch seconds.
 * `plotWidthPx` is used to skip ticks that would overlap.
 */
export function computeXTicks(
  timeStart: number,
  timeEnd: number,
  scale: ETimeScale,
  plotWidthPx: number
): IAxisTick[] {
  const rawTicks = computeRawXTicks(timeStart, timeEnd, scale);
  return thinTicks(rawTicks, timeStart, timeEnd, plotWidthPx, X_LABEL_WIDTH_PX);
}

/**
 * Generate month-boundary ticks (used for coarsest scales: Day64, Day256).
 */
function generateMonthTicks(timeStart: number, timeEnd: number): IAxisTick[] {
  const ticks: IAxisTick[] = [];
  const startDt = epochToInstant(timeStart).toZonedDateTimeISO('UTC');
  const endDt = epochToInstant(timeEnd).toZonedDateTimeISO('UTC');

  let current = startDt.with({ day: 1, hour: 0, minute: 0, second: 0, nanosecond: 0 });
  if (Temporal.ZonedDateTime.compare(current, startDt) < 0) {
    current = current.add({ months: 1 });
  }

  while (Temporal.ZonedDateTime.compare(current, endDt) <= 0) {
    ticks.push({
      position: Number(current.epochNanoseconds / 1_000_000_000n),
      label: current.toPlainDate().toLocaleString('en-US', { month: 'short' }),
    });
    current = current.add({ months: 1 });
  }

  return ticks;
}

/**
 * Generate day-boundary ticks (used for Day4, Day16).
 */
function generateDayTicks(timeStart: number, timeEnd: number): IAxisTick[] {
  const ticks: IAxisTick[] = [];
  const startDt = epochToInstant(timeStart).toZonedDateTimeISO('UTC');
  const endDt = epochToInstant(timeEnd).toZonedDateTimeISO('UTC');

  let current = startDt.with({ hour: 0, minute: 0, second: 0, nanosecond: 0 });
  if (Temporal.ZonedDateTime.compare(current, startDt) < 0) {
    current = current.add({ days: 1 });
  }

  while (Temporal.ZonedDateTime.compare(current, endDt) <= 0) {
    ticks.push({
      position: Number(current.epochNanoseconds / 1_000_000_000n),
      label: String(current.day),
    });
    current = current.add({ days: 1 });
  }

  return ticks;
}

/**
 * Generate hourly ticks (used for Day1).
 */
function generateHourlyTicks(timeStart: number, timeEnd: number): IAxisTick[] {
  const ticks: IAxisTick[] = [];
  const startHour = Math.ceil(timeStart / SECONDS_PER_HOUR);
  const endHour = Math.floor(timeEnd / SECONDS_PER_HOUR);

  for (let h = startHour; h <= endHour; h++) {
    const epochSec = h * SECONDS_PER_HOUR;
    const hourOfDay = ((h % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
    ticks.push({
      position: epochSec,
      label: formatHourMinute(hourOfDay, 0),
    });
  }

  return ticks;
}

/**
 * Generate per-minute ticks (used for Hour1, Hour12).
 */
function generateMinuteTicks(timeStart: number, timeEnd: number): IAxisTick[] {
  const ticks: IAxisTick[] = [];
  const startSlot = Math.ceil(timeStart / SECONDS_PER_MINUTE);
  const endSlot = Math.floor(timeEnd / SECONDS_PER_MINUTE);

  for (let s = startSlot; s <= endSlot; s++) {
    const epochSec = s * SECONDS_PER_MINUTE;
    const minuteOfDay = Math.floor((epochSec % SECONDS_PER_DAY) / SECONDS_PER_MINUTE);
    const hour = Math.floor(minuteOfDay / MINUTES_PER_HOUR);
    const minute = minuteOfDay % MINUTES_PER_HOUR;
    ticks.push({
      position: epochSec,
      label: formatHourMinute(((hour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY, minute),
    });
  }

  return ticks;
}

function computeRawXTicks(timeStart: number, timeEnd: number, scale: ETimeScale): IAxisTick[] {
  switch (scale) {
    case ETimeScale.Day256:
    case ETimeScale.Day64:
      return generateMonthTicks(timeStart, timeEnd);

    case ETimeScale.Day16:
    case ETimeScale.Day4:
      return generateDayTicks(timeStart, timeEnd);

    case ETimeScale.Day1:
      return generateHourlyTicks(timeStart, timeEnd);

    case ETimeScale.Hour12:
    case ETimeScale.Hour1:
      return generateMinuteTicks(timeStart, timeEnd);
  }
}

/**
 * Find a "nice" step size close to the rough step, using 1/2/5 x 10^n pattern.
 * Works for any magnitude — tiny (0.001) or huge (10000).
 */
function niceStep(roughStep: number): number {
  if (roughStep <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(roughStep));
  const magnitude = 10 ** exponent;

  const normalized = roughStep / magnitude;

  for (const base of NICE_BASES) {
    if (base >= normalized) {
      return base * magnitude;
    }
  }

  // Next magnitude: 10 x magnitude
  return NICE_BASES[0] * magnitude * 10;
}

/**
 * Compute nice Y-axis ticks for the given value range.
 * Dynamically picks step size to fit the range.
 * `plotHeightPx` is used to ensure labels don't overlap.
 */
export function computeYTicks(
  valueMin: number,
  valueMax: number,
  plotHeightPx: number
): IAxisTick[] {
  const range = valueMax - valueMin;

  if (range <= 0) {
    return [{ position: valueMin, label: formatYLabel(valueMin, 1) }];
  }

  // Pick step that gives roughly TARGET_Y_TICK_COUNT ticks
  let step = niceStep(range / TARGET_Y_TICK_COUNT);

  // If too few ticks would show, try a smaller step
  const tickCount = Math.floor(range / step);
  if (tickCount < MIN_Y_TICK_COUNT) {
    step = niceStep(range / MIN_Y_TICK_COUNT);
  }

  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  const ticks: IAxisTick[] = [];
  const start = Math.ceil(valueMin / step) * step;

  for (let v = start; v <= valueMax + step * 0.01; v += step) {
    if (v >= valueMin && v <= valueMax) {
      ticks.push({
        position: v,
        label: formatYLabel(v, decimals),
      });
    }
  }

  return thinTicks(ticks, valueMin, valueMax, plotHeightPx, Y_LABEL_HEIGHT_PX);
}

function formatYLabel(value: number, decimals: number): string {
  return value.toFixed(decimals);
}
