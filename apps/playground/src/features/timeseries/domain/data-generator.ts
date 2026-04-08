import { packColor } from './color-packing';
import { FULL_YEAR_SECONDS, GLOBAL_EPOCH_OFFSET } from './constants';
import type { IDataPoint } from './types';
import { ETimeScale } from './types';

// ── Seeded random ─────────────────────────────────────────────────────

const SEED_MULTIPLIER = 2654435761;
const SEED_SHIFT = 16;
const NORMALIZE_DIVISOR = 4294967296;

/** Deterministic hash: returns value in [0, 1) and next seed. */
function seededRandom(seed: number): { value: number; next: number } {
  const hash = Math.imul(seed, SEED_MULTIPLIER) >>> 0;
  const mixed = (hash ^ (hash >>> SEED_SHIFT)) >>> 0;
  return { value: mixed / NORMALIZE_DIVISOR, next: mixed };
}

/** Deterministic noise for a given time position. Returns value in [-0.5, 0.5). */
function noiseAt(time: number, octave: number): number {
  const seed = (Math.trunc(time * 1000) ^ Math.imul(octave, SEED_MULTIPLIER)) >>> 0;
  return seededRandom(seed).value - 0.5;
}

// ── Base backbone (year-level) ────────────────────────────────────────

const BACKBONE_POINTS = 366;
const WALK_STEP = 0.5;
const INITIAL_VALUE = 100;

let backboneCache: { times: Float64Array; values: Float64Array } | undefined;

/** Generate or return cached backbone: 366 points for the full year. */
function getBackbone(): { times: Float64Array; values: Float64Array } {
  if (backboneCache !== undefined) {
    return backboneCache;
  }

  const times = new Float64Array(BACKBONE_POINTS);
  const values = new Float64Array(BACKBONE_POINTS);

  const dataStart = GLOBAL_EPOCH_OFFSET;
  const step = FULL_YEAR_SECONDS / (BACKBONE_POINTS - 1);

  let currentSeed = 42;
  let currentValue = INITIAL_VALUE;

  for (let i = 0; i < BACKBONE_POINTS; i++) {
    times[i] = dataStart + i * step;

    const r = seededRandom(currentSeed);
    currentSeed = r.next;
    currentValue += (r.value - 0.5) * WALK_STEP;

    values[i] = currentValue;
  }

  backboneCache = { times, values };
  return backboneCache;
}

// ── Interpolation from backbone ───────────────────────────────────────

/**
 * Interpolate the backbone value at an arbitrary time using linear interpolation.
 */
function interpolateBackbone(time: number): number {
  const { times, values } = getBackbone();

  if (time <= times[0]) {
    return values[0];
  }

  if (time >= times[BACKBONE_POINTS - 1]) {
    return values[BACKBONE_POINTS - 1];
  }

  // Binary search for the interval
  let lo = 0;
  let hi = BACKBONE_POINTS - 1;

  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= time) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const t = (time - times[lo]) / (times[hi] - times[lo]);
  return values[lo] + t * (values[hi] - values[lo]);
}

// ── Noise amplitude per scale ─────────────────────────────────────────

const NOISE_AMPLITUDE: Record<ETimeScale, number> = {
  [ETimeScale.Year]: 0,
  [ETimeScale.Month]: 0.15,
  [ETimeScale.Week]: 0.08,
  [ETimeScale.Day]: 0.04,
  [ETimeScale.Hour]: 0.02,
  [ETimeScale.Minute]: 0.01,
};

// ── Point counts per scale ────────────────────────────────────────────

const POINTS_PER_SCALE: Record<ETimeScale, number> = {
  [ETimeScale.Year]: 365,
  [ETimeScale.Month]: 300,
  [ETimeScale.Week]: 168,
  [ETimeScale.Day]: 480,
  [ETimeScale.Hour]: 360,
  [ETimeScale.Minute]: 60,
};

// ── Visual properties ─────────────────────────────────────────────────

const LINE_SIZE_MIN = 1;
const LINE_SIZE_MAX = 10;
const LINE_SIZE_RANGE = LINE_SIZE_MAX - LINE_SIZE_MIN;

function computePointColor(normalized: number): number {
  const r = normalized;
  const g = 0.8 - normalized * 0.6;
  const b = 1.0 - normalized * 0.2;
  return packColor(r, g, b, 1.0);
}

function computePointSize(time: number): number {
  const noise = noiseAt(time, 7);
  return LINE_SIZE_MIN + (noise + 0.5) * LINE_SIZE_RANGE;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Generate timeseries data for a given time range and scale.
 *
 * At Year scale: returns the backbone points directly.
 * At finer scales: interpolates the backbone and adds deterministic noise
 * whose amplitude decreases with zoom level — so the overall shape is preserved
 * while finer detail appears on zoom.
 */
export function generateTimeseriesData(
  timeStart: number,
  timeEnd: number,
  scale: ETimeScale
): IDataPoint[] {
  if (scale === ETimeScale.Year) {
    return generateFromBackbone(timeStart, timeEnd);
  }

  return generateInterpolated(timeStart, timeEnd, scale);
}

/** Year scale: extract backbone points within the range. */
function generateFromBackbone(timeStart: number, timeEnd: number): IDataPoint[] {
  const { times, values } = getBackbone();
  const result: IDataPoint[] = [];
  const fullRange = times[BACKBONE_POINTS - 1] - times[0];

  for (let i = 0; i < BACKBONE_POINTS; i++) {
    if (times[i] >= timeStart && times[i] <= timeEnd) {
      const normalized = (times[i] - times[0]) / fullRange;
      result.push({
        time: times[i],
        value: values[i],
        size: computePointSize(times[i]),
        color: computePointColor(normalized),
      });
    }
  }

  return result;
}

/** Finer scales: interpolate backbone + add multi-octave noise. */
function generateInterpolated(timeStart: number, timeEnd: number, scale: ETimeScale): IDataPoint[] {
  const pointCount = POINTS_PER_SCALE[scale];
  const duration = timeEnd - timeStart;
  const step = duration / (pointCount - 1);
  const amplitude = NOISE_AMPLITUDE[scale];

  const dataStart = GLOBAL_EPOCH_OFFSET;
  const fullRange = FULL_YEAR_SECONDS;

  const points: IDataPoint[] = new Array(pointCount);

  for (let i = 0; i < pointCount; i++) {
    const time = timeStart + i * step;
    const baseValue = interpolateBackbone(time);

    // Multi-octave noise: each finer scale adds its own detail layer
    // plus accumulated noise from all coarser-but-not-year scales
    let noise = 0;
    const scaleIndex = scale as number;

    for (let octave = 1; octave <= scaleIndex; octave++) {
      const octaveAmplitude = NOISE_AMPLITUDE[octave as ETimeScale] ?? 0;
      noise += noiseAt(time, octave) * octaveAmplitude;
    }

    const value = baseValue + noise * amplitude * 10;

    const normalized = (time - dataStart) / fullRange;
    const clampedNormalized = Math.max(0, Math.min(1, normalized));

    points[i] = {
      time,
      value,
      size: computePointSize(time),
      color: computePointColor(clampedNormalized),
    };
  }

  return points;
}
