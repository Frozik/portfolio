import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp } from 'lodash-es';

import type { BoundingBox } from '../geometry/bounding-box';
import type { Meters } from '../units';

/**
 * The window the 2D editor shows, in CSS pixels. Plan `y` runs north while
 * screen `y` runs down, so every mapping between the two flips `y` — this
 * module is the only place that flip is allowed to live.
 */
export interface PlanViewport {
  readonly centerMeters: Vector2;
  readonly pixelsPerMeter: number;
  readonly widthPx: number;
  readonly heightPx: number;
}

/** A 200 m plot still spans a few hundred pixels at the lowest zoom. */
export const MIN_PIXELS_PER_METER = 1;
/** Half a centimetre per pixel — finer than the ±10 cm the feature targets. */
export const MAX_PIXELS_PER_METER = 200;
export const DEFAULT_PIXELS_PER_METER = 12;

/** A viewport thinner than this cannot be fitted to anything meaningfully. */
const MIN_FIT_EXTENT_PX = 1;

export function createPlanViewport(widthPx: number, heightPx: number): PlanViewport {
  return {
    centerMeters: { x: 0, y: 0 },
    pixelsPerMeter: DEFAULT_PIXELS_PER_METER,
    widthPx,
    heightPx,
  };
}

export function planToScreen(viewport: PlanViewport, point: Vector2): Vector2 {
  return {
    x: viewport.widthPx / 2 + (point.x - viewport.centerMeters.x) * viewport.pixelsPerMeter,
    y: viewport.heightPx / 2 - (point.y - viewport.centerMeters.y) * viewport.pixelsPerMeter,
  };
}

export function screenToPlan(viewport: PlanViewport, screenPoint: Vector2): Vector2 {
  return {
    x: viewport.centerMeters.x + (screenPoint.x - viewport.widthPx / 2) / viewport.pixelsPerMeter,
    y: viewport.centerMeters.y - (screenPoint.y - viewport.heightPx / 2) / viewport.pixelsPerMeter,
  };
}

/**
 * Unit screen-space direction of a plan-space direction. Scale drops out of a
 * normalised vector, so only the north-up flip survives — which is why chrome
 * drawn at a fixed pixel offset from a rotated shape still asks this module for
 * its bearing.
 */
export function planDirectionToScreen(planDirection: Vector2): Vector2 | undefined {
  const length = Math.hypot(planDirection.x, planDirection.y);

  if (length === 0) {
    return undefined;
  }

  return { x: planDirection.x / length, y: -planDirection.y / length };
}

/** Scales by `factor` while the plan point under `screenPoint` stays put. */
export function zoomAroundPoint(
  viewport: PlanViewport,
  screenPoint: Vector2,
  factor: number
): PlanViewport {
  const pixelsPerMeter = clamp(
    viewport.pixelsPerMeter * factor,
    MIN_PIXELS_PER_METER,
    MAX_PIXELS_PER_METER
  );

  if (pixelsPerMeter === viewport.pixelsPerMeter) {
    return viewport;
  }

  const anchor = screenToPlan(viewport, screenPoint);

  return {
    ...viewport,
    pixelsPerMeter,
    centerMeters: {
      x: anchor.x - (screenPoint.x - viewport.widthPx / 2) / pixelsPerMeter,
      y: anchor.y + (screenPoint.y - viewport.heightPx / 2) / pixelsPerMeter,
    },
  };
}

/** Drags the plan with the pointer: content moves by `deltaPx`, the centre against it. */
export function panByPixels(viewport: PlanViewport, deltaPx: Vector2): PlanViewport {
  return {
    ...viewport,
    centerMeters: {
      x: viewport.centerMeters.x - deltaPx.x / viewport.pixelsPerMeter,
      y: viewport.centerMeters.y + deltaPx.y / viewport.pixelsPerMeter,
    },
  };
}

/** Keeps the plan anchored at the centre of the canvas while the canvas resizes. */
export function resizeViewport(
  viewport: PlanViewport,
  widthPx: number,
  heightPx: number
): PlanViewport {
  return { ...viewport, widthPx, heightPx };
}

/**
 * Centres `bounds` and scales them to fill the viewport minus `paddingPx` on
 * every side. A degenerate extent (a single point, a zero-length side) keeps
 * the current zoom instead of collapsing to an infinite one.
 */
export function fitToBounds(
  viewport: PlanViewport,
  bounds: BoundingBox,
  paddingPx: number
): PlanViewport {
  const availableWidthPx = Math.max(viewport.widthPx - 2 * paddingPx, MIN_FIT_EXTENT_PX);
  const availableHeightPx = Math.max(viewport.heightPx - 2 * paddingPx, MIN_FIT_EXTENT_PX);
  const boundsWidth: Meters = bounds.maxX - bounds.minX;
  const boundsHeight: Meters = bounds.maxY - bounds.minY;

  const scales: number[] = [];

  if (boundsWidth > 0) {
    scales.push(availableWidthPx / boundsWidth);
  }

  if (boundsHeight > 0) {
    scales.push(availableHeightPx / boundsHeight);
  }

  const pixelsPerMeter =
    scales.length === 0
      ? viewport.pixelsPerMeter
      : clamp(Math.min(...scales), MIN_PIXELS_PER_METER, MAX_PIXELS_PER_METER);

  return {
    ...viewport,
    pixelsPerMeter,
    centerMeters: {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    },
  };
}
