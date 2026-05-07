import { assertNever } from '@frozik/utils/assert/assertNever';

import { lerp } from './math';
import { ScalingMode } from './trades-types';

/**
 * Pure functions that map a bucket's `volumeTotal` to a circle radius
 * in device pixels. Selected scaling mode is dev-time only — see
 * trades.md §1.3.
 *
 * Two stages by design:
 *   1. {@link computeBucketViewportStats} reduces the visible buckets'
 *      volumes to a `(vMin, vMax)` envelope once per frame.
 *   2. {@link computeRadiusPx} maps a single volume into the chosen
 *      pixel range using that envelope. Called per-bucket per-frame.
 *
 * Splitting them keeps the per-bucket call O(1) (no sort, no scan) and
 * lets the caller cache stats across modes during dev experimentation.
 */

/** Tiny epsilon used to keep the log mode away from `log(0)`. */
const LOG_MODE_EPSILON = 1e-9;

/** Lower percentile cutoff for the Percentile mode (1st percentile). */
const PERCENTILE_LOW_FRACTION = 0.01;

/** Upper percentile cutoff for the Percentile mode (99th percentile). */
const PERCENTILE_HIGH_FRACTION = 0.99;

export interface IViewportStats {
  readonly mode: ScalingMode;
  /** Lower volume envelope. Linear/Log: true min. Percentile: p1 clip. */
  readonly vMin: number;
  /** Upper volume envelope. Linear/Log: true max. Percentile: p99 clip. */
  readonly vMax: number;
}

/**
 * Reduce the per-frame visible-buckets' volumes to a `(vMin, vMax)`
 * envelope appropriate for the requested mode.
 *
 * Empty input collapses to `{ vMin: 0, vMax: 0 }` — {@link computeRadiusPx}
 * detects that and returns the floor radius without dividing by zero.
 */
export function computeBucketViewportStats(
  volumes: ReadonlyArray<number>,
  mode: ScalingMode
): IViewportStats {
  if (volumes.length === 0) {
    return { mode, vMin: 0, vMax: 0 };
  }

  switch (mode) {
    case ScalingMode.Linear:
    case ScalingMode.Log: {
      let vMin = volumes[0];
      let vMax = vMin;
      for (let index = 1; index < volumes.length; index++) {
        const value = volumes[index];
        if (value < vMin) {
          vMin = value;
        }
        if (value > vMax) {
          vMax = value;
        }
      }
      return { mode, vMin, vMax };
    }
    case ScalingMode.Percentile: {
      // Sort ascending and pick the p1 / p99 cutoffs. We sort a copy so
      // the caller's array is not mutated.
      const sorted = volumes.slice().sort((left, right) => left - right);
      const lowIndex = Math.floor(PERCENTILE_LOW_FRACTION * (sorted.length - 1));
      const highIndex = Math.floor(PERCENTILE_HIGH_FRACTION * (sorted.length - 1));
      return {
        mode,
        vMin: sorted[lowIndex],
        vMax: sorted[highIndex],
      };
    }
    default:
      return assertNever(mode);
  }
}

/**
 * Map `volumeTotal` to a pixel radius in `[rMinPx, rMaxPx]` according
 * to `mode` and the precomputed `stats` envelope.
 *
 * Edge cases:
 *  - Empty stats (`vMin === vMax === 0`) → returns `rMinPx`.
 *  - Degenerate range (`vMin === vMax`) → returns `rMinPx` (no spread
 *    to interpolate across; falling back to the floor avoids a sudden
 *    "everything maxed" frame when the viewport contains a single bucket).
 *  - Percentile clips the input volume to `[vMin, vMax]` before lerping.
 *  - Log clamps both endpoints and the input to `LOG_MODE_EPSILON` so
 *    the operands of `Math.log` stay strictly positive.
 *  - Result is always clamped to `[rMinPx, rMaxPx]`.
 */
export function computeRadiusPx(
  volumeTotal: number,
  stats: IViewportStats,
  rMinPx: number,
  rMaxPx: number,
  mode: ScalingMode
): number {
  if (stats.vMin === 0 && stats.vMax === 0) {
    return rMinPx;
  }
  if (stats.vMin >= stats.vMax) {
    return rMinPx;
  }

  switch (mode) {
    case ScalingMode.Linear: {
      const t = (volumeTotal - stats.vMin) / (stats.vMax - stats.vMin);
      return clampRadius(lerp(rMinPx, rMaxPx, t), rMinPx, rMaxPx);
    }
    case ScalingMode.Log: {
      const safeMin = Math.max(stats.vMin, LOG_MODE_EPSILON);
      const safeMax = Math.max(stats.vMax, LOG_MODE_EPSILON);
      const safeValue = Math.max(volumeTotal, LOG_MODE_EPSILON);
      const logMin = Math.log(safeMin);
      const logMax = Math.log(safeMax);
      if (logMin >= logMax) {
        return rMinPx;
      }
      const t = (Math.log(safeValue) - logMin) / (logMax - logMin);
      return clampRadius(lerp(rMinPx, rMaxPx, t), rMinPx, rMaxPx);
    }
    case ScalingMode.Percentile: {
      const clipped = Math.min(Math.max(volumeTotal, stats.vMin), stats.vMax);
      const t = (clipped - stats.vMin) / (stats.vMax - stats.vMin);
      return clampRadius(lerp(rMinPx, rMaxPx, t), rMinPx, rMaxPx);
    }
    default:
      return assertNever(mode);
  }
}

function clampRadius(radiusPx: number, rMinPx: number, rMaxPx: number): number {
  if (radiusPx < rMinPx) {
    return rMinPx;
  }
  if (radiusPx > rMaxPx) {
    return rMaxPx;
  }
  return radiusPx;
}
