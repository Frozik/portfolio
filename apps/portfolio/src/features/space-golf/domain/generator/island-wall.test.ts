import { describe, expect, it } from 'vitest';

import { containsPoint } from '../walls';
import { createEmptyGrid } from './cell-grid';
import { createIslandWall } from './island-wall';
import type { Random } from './random';
import { createRandom } from './random';

/** Outlines below are in half-metre cells; the walls come out in metres. */
const grid = createEmptyGrid(18, 32);
/** A random source that never asks for a long chamfer. */
const NEVER: Random = {
  next: () => 0,
  int: min => min,
  chance: () => false,
  pick: items => items[0],
};
/** A random source that always asks for the longest chamfer. */
const ALWAYS: Random = {
  next: () => 0,
  int: min => min,
  chance: () => true,
  pick: items => items[items.length - 1],
};

describe('createIslandWall', () => {
  it('chamfers every convex corner and fillets every concave one, so no corner is a right angle', () => {
    const wall = createIslandWall(
      [
        { x: 1, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 4 },
        { x: 1, y: 4 },
      ],
      grid,
      NEVER
    );

    expect(wall.vertices).toHaveLength(12);
    expect(wall.edges.filter(edge => edge.kind === 'deflector')).toHaveLength(6);
    expect(containsPoint(wall, { x: 1.02, y: 1.02 })).toBe(true);
    expect(containsPoint(wall, { x: 0.51, y: 0.51 })).toBe(false);
  });

  it('runs an island on the board edge past it and leaves the corners out there square', () => {
    const wall = createIslandWall(
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
      ],
      grid,
      NEVER
    );

    expect(wall.vertices).toContainEqual({ x: -1, y: -1 });
    expect(wall.vertices).toContainEqual({ x: 1, y: -1 });
    expect(wall.vertices).toContainEqual({ x: -1, y: 1 });
    expect(wall.edges.filter(edge => edge.kind === 'deflector')).toHaveLength(1);
  });

  it('cuts a long diagonal only where both faces keep some flat and never leaves a face shorter than that', () => {
    const wall = createIslandWall(
      [
        { x: 1, y: 1 },
        { x: 6, y: 1 },
        { x: 6, y: 3 },
        { x: 1, y: 3 },
      ],
      grid,
      ALWAYS
    );

    const flats = wall.edges.filter(edge => edge.kind === 'floor');
    expect(flats.every(edge => edge.length >= 0.3 - 1e-9)).toBe(true);
    expect(wall.edges.some(edge => edge.kind === 'deflector' && edge.length > 0.5)).toBe(true);
  });

  it('is reproducible for a seed', () => {
    const outline = [
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 4 },
      { x: 1, y: 4 },
    ];

    expect(createIslandWall(outline, grid, createRandom(7))).toEqual(
      createIslandWall(outline, grid, createRandom(7))
    );
  });
});
