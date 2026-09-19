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

  it('leaves no needle where the way doubles back: a bounce is bevelled, not spiked', () => {
    const awayFromPath = (point: Vector2, path: readonly Vector2[]): number => {
      let nearest = Number.POSITIVE_INFINITY;
      for (let index = 0; index + 1 < path.length; index += 1) {
        const [from, to] = [path[index], path[index + 1]];
        const run = { x: to.x - from.x, y: to.y - from.y };
        const size = run.x * run.x + run.y * run.y;
        const along = Math.max(
          0,
          Math.min(1, ((point.x - from.x) * run.x + (point.y - from.y) * run.y) / size)
        );
        nearest = Math.min(
          nearest,
          Math.hypot(point.x - (from.x + run.x * along), point.y - (from.y + run.y * along))
        );
      }
      return nearest;
    };

    for (const turn of [120, 150, 170, 179, 180]) {
      const angle = (turn * Math.PI) / 180;
      const bounce = [
        { x: 0, y: 0 },
        { x: 0.1, y: 0 },
        { x: 0.1 + Math.cos(angle) * 0.1, y: Math.sin(angle) * 0.1 },
      ];

      const reach = Math.max(...ribbonPoints(bounce).map(point => awayFromPath(point, bounce)));
      expect(reach).toBeLessThanOrEqual(HALF_WIDTH * 1.05);
    }
  });

  it('fills the wedge a bevelled bend leaves open, with the bend itself as its apex', () => {
    const sharp = [
      { x: 0, y: 0 },
      { x: 0.1, y: 0 },
      { x: 0.02, y: 0.06 },
    ];

    const points = ribbonPoints(sharp);
    // Two quads and one triangle: the wedge filler is the last of them.
    expect(points).toHaveLength(15);
    const apex = points.slice(12);
    expect(apex.some(point => Math.hypot(point.x - sharp[1].x, point.y - sharp[1].y) < 1e-6)).toBe(
      true
    );
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

  it('keeps a corner of an outline that doubles back within reach, never throwing it to infinity', () => {
    const spur = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0.0001 },
      { x: 0, y: 0.0001 },
    ];

    const writer = new MeshWriter();
    writer.border(spur, HALF_WIDTH, GOLD);
    const { vertexData, vertexCount } = writer.finish();
    const view = new DataView(vertexData);
    for (let index = 0; index < vertexCount; index += 1) {
      const at = index * MESH_VERTEX_STRIDE_BYTES;
      const [x, y] = [view.getFloat32(at, true), view.getFloat32(at + 4, true)];
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      expect(Math.hypot(x, y)).toBeLessThan(2);
    }
  });

  it('draws an outline that repeats a point without turning anything into a not-a-number', () => {
    const repeated = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];

    const writer = new MeshWriter();
    writer.border(repeated, HALF_WIDTH, GOLD);
    const { vertexData, vertexCount } = writer.finish();
    const view = new DataView(vertexData);
    for (let index = 0; index < vertexCount; index += 1) {
      const at = index * MESH_VERTEX_STRIDE_BYTES;
      expect(Number.isFinite(view.getFloat32(at, true))).toBe(true);
      expect(Number.isFinite(view.getFloat32(at + 4, true))).toBe(true);
    }
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
