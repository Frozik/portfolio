import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import type { Rgba } from './mesh-writer';
import { MESH_VERTEX_STRIDE_BYTES, MeshWriter } from './mesh-writer';

const GOLD: Rgba = [255, 206, 92, 255];
const HALF_WIDTH = 0.1;
/** A right-angled bend: the mitred corner reaches the half width divided by the cosine of half the turn. */
const RIGHT_ANGLE_REACH = HALF_WIDTH / Math.cos(Math.PI / 4);

function ribbonPoints(
  path: readonly Vector2[],
  halfWidthAt: (index: number) => number = () => HALF_WIDTH
): readonly Vector2[] {
  const writer = new MeshWriter();
  writer.ribbon(path, index => ({ halfWidth: halfWidthAt(index), color: GOLD }));
  const { vertexData, vertexCount } = writer.finish();
  const view = new DataView(vertexData);
  const points: Vector2[] = [];
  for (let index = 0; index < vertexCount; index += 1) {
    const offset = index * MESH_VERTEX_STRIDE_BYTES;
    points.push({ x: view.getFloat32(offset, true), y: view.getFloat32(offset + 4, true) });
  }
  return points;
}

describe('a ribbon along a polyline', () => {
  it('leaves no gap at a bend: the quads on either side of it end on the very same two corners', () => {
    const bend = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];

    const points = ribbonPoints(bend);
    // Each quad is two triangles: a, b, c and a, c, d — the joint is c and d of the one, a and b of the next.
    const [before, after] = [points.slice(0, 6), points.slice(6, 12)];
    expect(before[5]).toEqual(after[0]);
    expect(before[2]).toEqual(after[1]);
  });

  it('carries the corner of a bend out far enough to fill it, and keeps the straight run at its own width', () => {
    const bend = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];

    const points = ribbonPoints(bend);
    const reach = (point: Vector2, from: Vector2): number =>
      Math.hypot(point.x - from.x, point.y - from.y);
    expect(reach(points[5], { x: 1, y: 0 })).toBeCloseTo(RIGHT_ANGLE_REACH);
    expect(reach(points[0], { x: 0, y: 0 })).toBeCloseTo(HALF_WIDTH);
  });

  it('draws a point standing on top of its neighbour as nothing at all, never as a hole', () => {
    const doubled = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];

    const points = ribbonPoints(doubled);
    expect(points).toHaveLength(6);
    expect(points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });

  it('follows the width it is given at every point: a strip that tapers away to nothing', () => {
    const straight = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];

    const points = ribbonPoints(straight, index => HALF_WIDTH * (1 - index));
    expect(Math.abs(points[0].y)).toBeCloseTo(HALF_WIDTH);
    expect(points[2]).toEqual({ x: 1, y: 0 });
  });
});
