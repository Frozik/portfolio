import { Temporal } from '@js-temporal/polyfill';

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

function formatHourMinuteSecond(hour: number, minute: number, second: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
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

function computeRawXTicks(timeStart: number, timeEnd: number, scale: ETimeScale): IAxisTick[] {
  const ticks: IAxisTick[] = [];

  switch (scale) {
    case ETimeScale.Year: {
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
      break;
    }

    case ETimeScale.Month: {
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
      break;
    }

    case ETimeScale.Week: {
      const startDt = epochToInstant(timeStart).toZonedDateTimeISO('UTC');
      const endDt = epochToInstant(timeEnd).toZonedDateTimeISO('UTC');
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

      let current = startDt.with({ hour: 0, minute: 0, second: 0, nanosecond: 0 });
      if (Temporal.ZonedDateTime.compare(current, startDt) < 0) {
        current = current.add({ days: 1 });
      }

      while (Temporal.ZonedDateTime.compare(current, endDt) <= 0) {
        const dayOfWeek = current.dayOfWeek;
        ticks.push({
          position: Number(current.epochNanoseconds / 1_000_000_000n),
          label: dayNames[dayOfWeek - 1],
        });
        current = current.add({ days: 1 });
      }
      break;
    }

    case ETimeScale.Day: {
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
      break;
    }

    case ETimeScale.Hour: {
      // Generate per-minute ticks (thinning will skip the ones that don't fit)
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
      break;
    }

    case ETimeScale.Minute: {
      // Generate per-second ticks
      const startSlot = Math.ceil(timeStart);
      const endSlot = Math.floor(timeEnd);

      for (let s = startSlot; s <= endSlot; s++) {
        const secOfDay = s % SECONDS_PER_DAY;
        const hour = Math.floor(secOfDay / SECONDS_PER_HOUR);
        const minute = Math.floor((secOfDay % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
        const second = secOfDay % SECONDS_PER_MINUTE;
        ticks.push({
          position: s,
          label: formatHourMinuteSecond(
            ((hour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY,
            minute,
            second
          ),
        });
      }
      break;
    }
  }

  return ticks;
}

/**
 * Find a "nice" step size close to the rough step, using 1/2/5 × 10^n pattern.
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

  // Next magnitude: 10 × magnitude
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
