import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import { createRectangle } from '../model/shapes';
import type { Slab } from '../model/slabs';
import { multiPolygonArea } from './building-outline';
import { slabPolygon, slabsOutline } from './slab-geometry';

function slab({
  center = { x: 0, y: 0 },
  rotationDegrees = 0,
}: {
  readonly center?: Vector2;
  readonly rotationDegrees?: number;
} = {}): Slab {
  return createRectangle({ center, width: 4, length: 2, rotationDegrees });
}

describe('slabPolygon', () => {
  it('spans the slab about its centre', () => {
    const { outer } = slabPolygon(slab());

    expect(Math.min(...outer.map(point => point.x))).toBeCloseTo(-2);
    expect(Math.max(...outer.map(point => point.x))).toBeCloseTo(2);
    expect(Math.min(...outer.map(point => point.y))).toBeCloseTo(-1);
    expect(Math.max(...outer.map(point => point.y))).toBeCloseTo(1);
  });

  it('turns with the slab, keeping its area', () => {
    const turned = slabPolygon(slab({ rotationDegrees: 90 }));

    expect(Math.max(...turned.outer.map(point => point.y))).toBeCloseTo(2);
    expect(multiPolygonArea([turned])).toBeCloseTo(8);
  });
});

describe('slabsOutline', () => {
  it('is empty while the storey has no slabs', () => {
    expect(slabsOutline([])).toEqual([]);
  });

  it('welds two slabs sharing an edge into one floor', () => {
    const outline = slabsOutline([slab(), slab({ center: { x: 4, y: 0 } })]);

    expect(outline).toHaveLength(1);
    expect(multiPolygonArea(outline)).toBeCloseTo(16);
  });

  it('counts the overlap of two slabs once', () => {
    const outline = slabsOutline([slab(), slab({ center: { x: 2, y: 0 } })]);

    expect(multiPolygonArea(outline)).toBeCloseTo(12);
  });

  it('keeps slabs that do not touch apart', () => {
    expect(slabsOutline([slab(), slab({ center: { x: 20, y: 20 } })])).toHaveLength(2);
  });
});
