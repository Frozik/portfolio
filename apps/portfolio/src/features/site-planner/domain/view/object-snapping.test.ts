import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import { findKeyPointSnap } from './object-snapping';

const CAPTURE_RADIUS_METERS = 1;

const OWN_POINTS: readonly Vector2[] = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
];

describe('findKeyPointSnap', () => {
  it('joins the pair within reach and reports the translation that joins it', () => {
    const snap = findKeyPointSnap(OWN_POINTS, [{ x: 4.25, y: 0.5 }], CAPTURE_RADIUS_METERS);

    expect(snap).toEqual({
      delta: { x: 0.25, y: 0.5 },
      ownPoint: { x: 4, y: 0 },
      targetPoint: { x: 4.25, y: 0.5 },
    });
  });

  it('takes the closest pair when several are in reach', () => {
    const snap = findKeyPointSnap(
      OWN_POINTS,
      [
        { x: 0.6, y: 0 },
        { x: 4.2, y: 0 },
      ],
      CAPTURE_RADIUS_METERS
    );

    expect(snap?.targetPoint).toEqual({ x: 4.2, y: 0 });
  });

  it('leaves the gesture alone when nothing is within the capture distance', () => {
    expect(findKeyPointSnap(OWN_POINTS, [{ x: 2, y: 2 }], CAPTURE_RADIUS_METERS)).toBeUndefined();
  });

  it('catches a pair sitting exactly at the capture distance', () => {
    const snap = findKeyPointSnap(OWN_POINTS, [{ x: 0, y: 1 }], CAPTURE_RADIUS_METERS);

    expect(snap?.delta).toEqual({ x: 0, y: 1 });
  });

  it('keeps the pair found first when two are equally close', () => {
    const snap = findKeyPointSnap(
      OWN_POINTS,
      [
        { x: 0.5, y: 0 },
        { x: 4.5, y: 0 },
      ],
      CAPTURE_RADIUS_METERS
    );

    expect(snap?.ownPoint).toEqual({ x: 0, y: 0 });
  });

  it('snaps to nothing without points on either side or without a capture distance', () => {
    expect(findKeyPointSnap([], [{ x: 0, y: 0 }], CAPTURE_RADIUS_METERS)).toBeUndefined();
    expect(findKeyPointSnap(OWN_POINTS, [], CAPTURE_RADIUS_METERS)).toBeUndefined();
    expect(findKeyPointSnap(OWN_POINTS, [{ x: 0, y: 0 }], 0)).toBeUndefined();
  });
});
