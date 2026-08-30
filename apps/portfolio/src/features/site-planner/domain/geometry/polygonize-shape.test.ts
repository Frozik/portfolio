import { describe, expect, it } from 'vitest';

import { createCircle, createRectangle } from '../model/shapes';
import type { Ring } from './polygon-types';
import {
  CIRCLE_SAGITTA_METERS,
  countCircleSegments,
  MAX_CIRCLE_SEGMENTS,
  MIN_CIRCLE_SEGMENTS,
  polygonizeShape,
} from './polygonize-shape';

function signedArea(ring: Ring): number {
  let doubledArea = 0;

  ring.forEach((point, index) => {
    const next = ring[(index + 1) % ring.length];

    doubledArea += point.x * next.y - next.x * point.y;
  });

  return doubledArea / 2;
}

describe('countCircleSegments', () => {
  it('follows the sagitta formula between the clamps', () => {
    const radius = 10;

    expect(countCircleSegments(radius)).toBe(
      Math.ceil(Math.PI / Math.acos(1 - CIRCLE_SAGITTA_METERS / radius))
    );
  });

  it('clamps tiny and huge radii into the supported range', () => {
    expect(countCircleSegments(0.05)).toBe(MIN_CIRCLE_SEGMENTS);
    expect(countCircleSegments(0)).toBe(MIN_CIRCLE_SEGMENTS);
    expect(countCircleSegments(10_000)).toBe(MAX_CIRCLE_SEGMENTS);
  });

  it('needs more segments as the radius grows', () => {
    expect(countCircleSegments(20)).toBeGreaterThan(countCircleSegments(5));
  });
});

describe('polygonizeShape for a rectangle', () => {
  it('emits the four corners counter-clockwise when unrotated', () => {
    const ring = polygonizeShape(
      createRectangle({ center: { x: 5, y: 10 }, width: 4, length: 6, rotationDegrees: 0 })
    );

    expect(ring).toEqual([
      { x: 3, y: 7 },
      { x: 7, y: 7 },
      { x: 7, y: 13 },
      { x: 3, y: 13 },
    ]);
    expect(signedArea(ring)).toBeGreaterThan(0);
  });

  it('keeps the area of a rotated rectangle equal to width times length', () => {
    const ring = polygonizeShape(
      createRectangle({ center: { x: -2, y: 8 }, width: 30, length: 40, rotationDegrees: 37 })
    );

    expect(ring).toHaveLength(4);
    expect(signedArea(ring)).toBeCloseTo(30 * 40, 6);
  });

  it('rotates counter-clockwise around the centre', () => {
    const ring = polygonizeShape(
      createRectangle({ center: { x: 0, y: 0 }, width: 2, length: 4, rotationDegrees: 90 })
    );

    expect(ring[0].x).toBeCloseTo(2, 9);
    expect(ring[0].y).toBeCloseTo(-1, 9);
  });
});

describe('polygonizeShape for a circle', () => {
  it('emits a counter-clockwise ring of the computed segment count', () => {
    const radius = 10;
    const ring = polygonizeShape(createCircle({ center: { x: 1, y: 2 }, radius }));

    expect(ring).toHaveLength(countCircleSegments(radius));
    expect(signedArea(ring)).toBeGreaterThan(0);
  });

  it('stays within a centimetre of the true circle at a 10 m radius', () => {
    const radius = 10;
    const center = { x: 1, y: 2 };
    const ring = polygonizeShape(createCircle({ center, radius }));

    const sagitta = radius * (1 - Math.cos(Math.PI / ring.length));

    expect(sagitta).toBeLessThan(0.01);

    for (const point of ring) {
      expect(Math.hypot(point.x - center.x, point.y - center.y)).toBeCloseTo(radius, 9);
    }

    expect(signedArea(ring)).toBeGreaterThan(
      Math.PI * radius * radius - 0.01 * 2 * Math.PI * radius
    );
    expect(signedArea(ring)).toBeLessThan(Math.PI * radius * radius);
  });
});
