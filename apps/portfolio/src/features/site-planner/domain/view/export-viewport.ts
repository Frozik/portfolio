import { clamp } from 'lodash-es';

import type { BoundingBox } from '../geometry/bounding-box';
import { chooseNiceStepAtMost } from '../geometry/nice-step';
import type { Meters } from '../units';
import type { PlanViewport } from './plan-viewport';
import {
  DEFAULT_PIXELS_PER_METER,
  MAX_PIXELS_PER_METER,
  MIN_PIXELS_PER_METER,
} from './plan-viewport';

/** Room around the plot on the exported sheet; the chrome is drawn inside it. */
export const EXPORT_MARGIN_PX = 64;

/** Longest side an exported sheet may reach before the scale is rounded down. */
const MAX_EXPORT_EXTENT_PX = 2400;

/** Even a tiny plot needs a sheet the compass and the scale bar fit on. */
const MIN_EXPORT_EXTENT_PX = 480;

/**
 * The window an exported plan is drawn through: the whole plot, centred, with a
 * margin, at a round 1 / 2 / 5 · 10ⁿ pixels per metre.
 *
 * The scale is rounded rather than fitted exactly because the sheet's only
 * absolute reference is its scale bar, and a bar spanning a round number of
 * metres is what makes a printed plan measurable. The sheet then takes whatever
 * size that scale asks for, instead of the scale bending to a fixed sheet.
 */
export function computeExportViewport(bounds: BoundingBox): PlanViewport {
  const widthMeters: Meters = Math.max(bounds.maxX - bounds.minX, 0);
  const heightMeters: Meters = Math.max(bounds.maxY - bounds.minY, 0);
  const extentMeters: Meters = Math.max(widthMeters, heightMeters);
  const availablePx = MAX_EXPORT_EXTENT_PX - 2 * EXPORT_MARGIN_PX;

  const pixelsPerMeter =
    extentMeters > 0
      ? clamp(
          chooseNiceStepAtMost(availablePx / extentMeters),
          MIN_PIXELS_PER_METER,
          MAX_PIXELS_PER_METER
        )
      : DEFAULT_PIXELS_PER_METER;

  return {
    centerMeters: {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    },
    pixelsPerMeter,
    widthPx: toSheetExtentPx(widthMeters, pixelsPerMeter),
    heightPx: toSheetExtentPx(heightMeters, pixelsPerMeter),
  };
}

/**
 * The sheet is held inside its own ceiling: the scale is rounded down to a nice
 * step, but a plot large enough to hit {@link MIN_PIXELS_PER_METER} would
 * otherwise ask for a sheet the export limit was meant to rule out.
 */
function toSheetExtentPx(extentMeters: Meters, pixelsPerMeter: number): number {
  return clamp(
    Math.round(extentMeters * pixelsPerMeter) + 2 * EXPORT_MARGIN_PX,
    MIN_EXPORT_EXTENT_PX,
    MAX_EXPORT_EXTENT_PX
  );
}
