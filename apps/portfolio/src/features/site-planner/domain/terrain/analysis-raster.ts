import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp } from 'lodash-es';

import type { MultiPolygon } from '../geometry/polygon-types';
import type { Meters } from '../units';
import type { Heightfield } from './heightfield';
import { buildPlotCoverage } from './plot-coverage';
import { computeSlopePercent, GENTLE_SLOPE_PERCENT, STEEP_SLOPE_PERCENT } from './slope';

/**
 * An analysis painted into pixels, once, on the CPU. The plan draws it as an
 * image and the 3D view uploads it as a texture, so the two views can never
 * disagree about what a colour means: there is one ramp, it lives in this
 * module, and neither renderer knows a thing about slopes or earthworks.
 *
 * One texel per grid sample, centred on it — texel `(column, row)` colours
 * sample `(column, row)`, and the raster therefore reaches half a cell beyond
 * the outermost samples on every side.
 */
export interface AnalysisRaster {
  readonly widthTexels: number;
  readonly heightTexels: number;
  /** Plan position of the centre of texel (0, 0). */
  readonly originMeters: Vector2;
  readonly cellSizeMeters: Meters;
  /**
   * RGBA, row-major from the south — the order `Heightfield.heights` is in. The
   * buffer is spelled out because the raster is handed to `ImageData` and to
   * `writeTexture` as it stands, and neither accepts a shared buffer.
   */
  readonly pixels: Uint8ClampedArray<ArrayBuffer>;
}

/** A colour of the ramps, as the raster writes it and the legend shows it. */
export interface RampColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

/**
 * The steepness ramp: green where the ground builds as if it were level,
 * amber where it needs grading, red where it needs terracing. The steps are
 * the plan's own accents (`PLAN_COLORS`), so the overlay reads as part of the
 * drawing rather than as a foreign heat map.
 */
export const SLOPE_RAMP = {
  gentle: { red: 76, green: 217, blue: 100 },
  moderate: { red: 245, green: 200, blue: 66 },
  steep: { red: 255, green: 79, blue: 88 },
} as const satisfies Record<string, RampColor>;

/**
 * The earthworks ramp, in the convention every cut/fill drawing follows: warm
 * where soil has to come away, cool where it has to be brought in.
 */
export const CUT_FILL_RAMP = {
  cut: { red: 255, green: 106, blue: 61 },
  fill: { red: 56, green: 189, blue: 248 },
} as const satisfies Record<string, RampColor>;

/** The ramp colours as CSS, for the legend that captions them. */
export function toCssColor(color: RampColor): string {
  return `rgb(${color.red} ${color.green} ${color.blue})`;
}

const CHANNELS_PER_TEXEL = 4;
const OPAQUE = 255;

/** A sample the plot — or the footprint — does not reach is left transparent. */
const UNCOVERED = 0;

/**
 * How strongly the slope colours cover the ground. Firm enough to read the
 * steps apart at a glance, sheer enough to leave the shaded relief under them
 * visible in 3D.
 */
const SLOPE_ALPHA = Math.round(0.55 * OPAQUE);

/**
 * Half-width of the blend across each threshold, in per cent of slope. The
 * steps are a classification and have to read as bands, but a hard edge would
 * draw a contour of its own where the ground has no feature at all.
 */
const SLOPE_BLEND_PERCENT = 1;

/** Below a centimetre the pad is level with the ground; there is nothing to move. */
const MIN_EARTHWORKS_DELTA_METERS: Meters = 0.01;

/**
 * The depth at which the earthworks colour reaches full strength. A metre of
 * cut or fill is already a serious piece of work on a house plot, so deeper
 * ground gains nothing from a stronger colour and would only flatten out the
 * shallow end of the scale.
 */
const FULL_STRENGTH_DELTA_METERS: Meters = 1;

const MIN_EARTHWORKS_ALPHA = Math.round(0.2 * OPAQUE);
const MAX_EARTHWORKS_ALPHA = Math.round(0.8 * OPAQUE);

/**
 * The steepness of the plot, coloured sample by sample. Ground outside the plot
 * is left transparent: it is interpolated to fill the grid, not surveyed, and
 * colouring an analysis over it would claim otherwise.
 */
export function buildSlopeRaster(field: Heightfield, coverage: Float32Array): AnalysisRaster {
  const { resolution } = field;
  const pixels = new Uint8ClampedArray(resolution * resolution * CHANNELS_PER_TEXEL);

  for (let row = 0; row < resolution; row += 1) {
    for (let column = 0; column < resolution; column += 1) {
      const index = row * resolution + column;

      if (coverage[index] === UNCOVERED) {
        continue;
      }

      writeTexel(
        pixels,
        index,
        resolveSlopeColor(computeSlopePercent(field, column, row)),
        SLOPE_ALPHA
      );
    }
  }

  return createRaster(field, pixels);
}

/**
 * The earthworks under the house, coloured sample by sample: the same
 * difference `padElevation − terrain` the volume report integrates, taken over
 * the same grid samples the footprint covers. Colour says which way the soil
 * moves, strength says how much of it.
 */
export function buildCutFillRaster(
  field: Heightfield,
  pads: readonly { readonly polygons: MultiPolygon; readonly padElevation: Meters }[]
): AnalysisRaster {
  const { resolution, heights } = field;
  const pixels = new Uint8ClampedArray(resolution * resolution * CHANNELS_PER_TEXEL);

  // Building by building: each footprint is coloured against its own pad, so
  // two structures levelled to different heights read correctly side by side.
  for (const { polygons, padElevation } of pads) {
    const coverage = buildPlotCoverage(field, polygons);

    for (let index = 0; index < coverage.length; index += 1) {
      if (coverage[index] === UNCOVERED) {
        continue;
      }

      const delta = padElevation - heights[index];

      if (Math.abs(delta) < MIN_EARTHWORKS_DELTA_METERS) {
        continue;
      }

      writeTexel(
        pixels,
        index,
        delta < 0 ? CUT_FILL_RAMP.cut : CUT_FILL_RAMP.fill,
        resolveEarthworksAlpha(delta)
      );
    }
  }

  return createRaster(field, pixels);
}

/**
 * Where a steepness lands on the ramp. Two blends rather than a lookup: the
 * colour steps at the thresholds the legend names, and eases across them.
 */
function resolveSlopeColor(slopePercent: number): RampColor {
  const gradedColor = mixColors(
    SLOPE_RAMP.gentle,
    SLOPE_RAMP.moderate,
    smoothStep(
      GENTLE_SLOPE_PERCENT - SLOPE_BLEND_PERCENT,
      GENTLE_SLOPE_PERCENT + SLOPE_BLEND_PERCENT,
      slopePercent
    )
  );

  return mixColors(
    gradedColor,
    SLOPE_RAMP.steep,
    smoothStep(
      STEEP_SLOPE_PERCENT - SLOPE_BLEND_PERCENT,
      STEEP_SLOPE_PERCENT + SLOPE_BLEND_PERCENT,
      slopePercent
    )
  );
}

function resolveEarthworksAlpha(delta: Meters): number {
  const strength = clamp(Math.abs(delta) / FULL_STRENGTH_DELTA_METERS, 0, 1);

  return Math.round(
    MIN_EARTHWORKS_ALPHA + (MAX_EARTHWORKS_ALPHA - MIN_EARTHWORKS_ALPHA) * strength
  );
}

function createRaster(field: Heightfield, pixels: Uint8ClampedArray<ArrayBuffer>): AnalysisRaster {
  return {
    widthTexels: field.resolution,
    heightTexels: field.resolution,
    originMeters: field.originMeters,
    cellSizeMeters: field.cellSizeMeters,
    pixels,
  };
}

function writeTexel(
  pixels: Uint8ClampedArray,
  index: number,
  color: RampColor,
  alpha: number
): void {
  const offset = index * CHANNELS_PER_TEXEL;

  pixels[offset] = color.red;
  pixels[offset + 1] = color.green;
  pixels[offset + 2] = color.blue;
  pixels[offset + 3] = alpha;
}

function mixColors(from: RampColor, to: RampColor, ratio: number): RampColor {
  return {
    red: from.red + (to.red - from.red) * ratio,
    green: from.green + (to.green - from.green) * ratio,
    blue: from.blue + (to.blue - from.blue) * ratio,
  };
}

/** Hermite ease between two edges — the classic smoothstep, in plain arithmetic. */
function smoothStep(fromEdge: number, toEdge: number, value: number): number {
  const ratio = clamp((value - fromEdge) / (toEdge - fromEdge), 0, 1);

  return ratio * ratio * (3 - 2 * ratio);
}
