import { describe, expect, it } from 'vitest';

import { CAR_LENGTH_METERS } from '../../../domain/constants';
import { createCar } from '../../../domain/model/site-plan';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { computeCarHandles } from './draw-cars';
import { ROTATION_HANDLE_GAP_PX } from './draw-selection';

const VIEWPORT: PlanViewport = {
  centerMeters: { x: 0, y: 0 },
  pixelsPerMeter: 10,
  widthPx: 400,
  heightPx: 400,
};

const HALF = 0.5;
/** Where the nose of a car standing at the origin is, in pixels from its middle. */
const NOSE_OFFSET_PX = CAR_LENGTH_METERS * HALF * VIEWPORT.pixelsPerMeter;

describe('computeCarHandles', () => {
  it('offers one grip, a fixed pixel gap ahead of the nose', () => {
    const handles = computeCarHandles(
      createCar({ position: { x: 0, y: 0 }, rotationDegrees: 0 }),
      VIEWPORT
    );

    expect(handles.map(handle => handle.kind)).toEqual(['rotate']);
    expect(handles[0].screenPoint.x).toBeCloseTo(200 + NOSE_OFFSET_PX + ROTATION_HANDLE_GAP_PX, 9);
    expect(handles[0].screenPoint.y).toBeCloseTo(200, 9);
  });

  it('turns the grip with the car', () => {
    // A quarter turn counter-clockwise sends the nose to plan north, which is up
    // the screen.
    const handles = computeCarHandles(
      createCar({ position: { x: 0, y: 0 }, rotationDegrees: 90 }),
      VIEWPORT
    );

    expect(handles[0].screenPoint.x).toBeCloseTo(200, 9);
    expect(handles[0].screenPoint.y).toBeCloseTo(200 - NOSE_OFFSET_PX - ROTATION_HANDLE_GAP_PX, 9);
  });
});
