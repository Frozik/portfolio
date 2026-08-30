import { describe, expect, it } from 'vitest';

import type { BoundingBox } from '../geometry/bounding-box';
import type { PlanViewport } from './plan-viewport';
import {
  createPlanViewport,
  fitToBounds,
  MAX_PIXELS_PER_METER,
  MIN_PIXELS_PER_METER,
  panByPixels,
  planToScreen,
  resizeViewport,
  screenToPlan,
  zoomAroundPoint,
} from './plan-viewport';

const VIEWPORT: PlanViewport = {
  centerMeters: { x: 15, y: 20 },
  pixelsPerMeter: 10,
  widthPx: 800,
  heightPx: 600,
};

const TOLERANCE_PX = 1e-9;

describe('planToScreen', () => {
  it('puts the viewport centre at the centre of the canvas', () => {
    expect(planToScreen(VIEWPORT, VIEWPORT.centerMeters)).toEqual({ x: 400, y: 300 });
  });

  it('draws plan north up the screen', () => {
    const north = planToScreen(VIEWPORT, { x: 15, y: 25 });

    expect(north).toEqual({ x: 400, y: 250 });
  });

  it('draws plan east to the right of the screen', () => {
    const east = planToScreen(VIEWPORT, { x: 20, y: 20 });

    expect(east).toEqual({ x: 450, y: 300 });
  });
});

describe('screenToPlan', () => {
  it('inverts planToScreen', () => {
    const point = { x: -3.25, y: 41.75 };

    const restored = screenToPlan(VIEWPORT, planToScreen(VIEWPORT, point));

    expect(restored.x).toBeCloseTo(point.x, 12);
    expect(restored.y).toBeCloseTo(point.y, 12);
  });
});

describe('zoomAroundPoint', () => {
  it('keeps the plan point under the anchor in place', () => {
    const anchorScreen = { x: 120, y: 540 };
    const anchorPlan = screenToPlan(VIEWPORT, anchorScreen);

    const zoomed = zoomAroundPoint(VIEWPORT, anchorScreen, 2.5);
    const after = planToScreen(zoomed, anchorPlan);

    expect(zoomed.pixelsPerMeter).toBe(25);
    expect(Math.abs(after.x - anchorScreen.x)).toBeLessThan(TOLERANCE_PX);
    expect(Math.abs(after.y - anchorScreen.y)).toBeLessThan(TOLERANCE_PX);
  });

  it('clamps the scale to the supported range', () => {
    const anchorScreen = { x: 400, y: 300 };

    expect(zoomAroundPoint(VIEWPORT, anchorScreen, 1000).pixelsPerMeter).toBe(MAX_PIXELS_PER_METER);
    expect(zoomAroundPoint(VIEWPORT, anchorScreen, 0.0001).pixelsPerMeter).toBe(
      MIN_PIXELS_PER_METER
    );
  });

  it('returns the very same viewport when the scale cannot change', () => {
    const clamped = { ...VIEWPORT, pixelsPerMeter: MAX_PIXELS_PER_METER };

    expect(zoomAroundPoint(clamped, { x: 0, y: 0 }, 2)).toBe(clamped);
  });
});

describe('panByPixels', () => {
  it('moves the content with the pointer', () => {
    const panned = panByPixels(VIEWPORT, { x: 100, y: 50 });

    expect(panned.centerMeters).toEqual({ x: 5, y: 25 });
    expect(planToScreen(panned, VIEWPORT.centerMeters)).toEqual({ x: 500, y: 350 });
  });
});

describe('resizeViewport', () => {
  it('keeps the centre and the scale', () => {
    const resized = resizeViewport(VIEWPORT, 1024, 256);

    expect(resized.widthPx).toBe(1024);
    expect(resized.heightPx).toBe(256);
    expect(resized.centerMeters).toEqual(VIEWPORT.centerMeters);
    expect(resized.pixelsPerMeter).toBe(VIEWPORT.pixelsPerMeter);
  });
});

describe('fitToBounds', () => {
  const PLOT: BoundingBox = { minX: 0, minY: 0, maxX: 30, maxY: 40 };

  it('centres the bounds and fits their tightest side inside the padding', () => {
    const fitted = fitToBounds(createPlanViewport(800, 600), PLOT, 50);

    expect(fitted.centerMeters).toEqual({ x: 15, y: 20 });
    // 500 px of usable height over 40 m is tighter than 700 px over 30 m.
    expect(fitted.pixelsPerMeter).toBe(12.5);

    const topLeft = planToScreen(fitted, { x: PLOT.minX, y: PLOT.maxY });
    const bottomRight = planToScreen(fitted, { x: PLOT.maxX, y: PLOT.minY });

    expect(topLeft.y).toBeCloseTo(50, 9);
    expect(bottomRight.y).toBeCloseTo(550, 9);
    expect(topLeft.x).toBeGreaterThanOrEqual(50);
    expect(bottomRight.x).toBeLessThanOrEqual(750);
  });

  it('keeps the current scale for bounds without extent', () => {
    const point: BoundingBox = { minX: 7, minY: 9, maxX: 7, maxY: 9 };

    const fitted = fitToBounds(VIEWPORT, point, 20);

    expect(fitted.pixelsPerMeter).toBe(VIEWPORT.pixelsPerMeter);
    expect(fitted.centerMeters).toEqual({ x: 7, y: 9 });
  });

  it('never scales beyond the supported range', () => {
    const hair: BoundingBox = { minX: 0, minY: 0, maxX: 0.001, maxY: 0.001 };

    expect(fitToBounds(VIEWPORT, hair, 0).pixelsPerMeter).toBe(MAX_PIXELS_PER_METER);
  });
});
