import { describe, expect, it } from 'vitest';

import { createWall } from '../model/walls';
import { routeWire } from './wire-routing';

/** Two walls meeting at a corner (14, 8) — an L the wire can follow. */
const WALL_A = createWall({
  points: [
    { x: 6, y: 8 },
    { x: 14, y: 8 },
  ],
});
const WALL_B = createWall({
  points: [
    { x: 14, y: 8 },
    { x: 14, y: 14 },
  ],
});

describe('routeWire', () => {
  it('runs along one wall between two offsets on it', () => {
    const points = routeWire(
      [WALL_A],
      { kind: 'wall', wallId: WALL_A.id, offsetMeters: 2 },
      { kind: 'wall', wallId: WALL_A.id, offsetMeters: 6 }
    );

    expect(points).toEqual([
      { x: 8, y: 8 },
      { x: 12, y: 8 },
    ]);
  });

  it('walks through the corner junction from one wall to the next', () => {
    const points = routeWire(
      [WALL_A, WALL_B],
      { kind: 'wall', wallId: WALL_A.id, offsetMeters: 2 },
      { kind: 'wall', wallId: WALL_B.id, offsetMeters: 4 }
    );

    expect(points[0]).toEqual({ x: 8, y: 8 });
    expect(points[points.length - 1]).toEqual({ x: 14, y: 12 });
    // The run passes through the shared corner, never cutting the diagonal.
    expect(points).toContainEqual({ x: 14, y: 8 });
  });

  it('falls back to an orthogonal dog-leg where no walls connect', () => {
    const island = createWall({
      points: [
        { x: 30, y: 30 },
        { x: 34, y: 30 },
      ],
    });
    const points = routeWire(
      [WALL_A, island],
      { kind: 'wall', wallId: WALL_A.id, offsetMeters: 2 },
      { kind: 'wall', wallId: island.id, offsetMeters: 1 }
    );

    // Three points, two orthogonal segments — never a diagonal.
    expect(points).toHaveLength(3);
    expect(points[1]).toEqual({ x: 31, y: 8 });
  });

  it('reaches a free point — a ceiling light — with the same dog-leg', () => {
    const points = routeWire(
      [WALL_A],
      { kind: 'wall', wallId: WALL_A.id, offsetMeters: 2 },
      { kind: 'point', position: { x: 10, y: 12 } }
    );

    expect(points[points.length - 1]).toEqual({ x: 10, y: 12 });
  });
});
