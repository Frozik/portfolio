import { describe, expect, it } from 'vitest';

import { createEmptyGrid, fillRect } from './cell-grid';
import { createIslandWall } from './island-wall';
import { traceOutlines } from './outline';
import { placeSurfaces } from './place-surfaces';
import type { Random } from './random';
import { createRandom } from './random';

/** A tee nowhere near the walls under test: no corner is spared for it. */
const FAR_TEE = { x: -100, y: -100 };

/** A random source that never asks for a long chamfer and always wants the most surfaces. */
const PLAIN: Random = {
  next: () => 0.5,
  int: (_min, max) => max,
  chance: () => false,
  pick: items => items[0],
};

describe('placeSurfaces', () => {
  it('puts surfaces only on long faces with a metre of solid behind them, clear of both ends', () => {
    // A thin bar four cells long (2 m × 0.5 m) and a block six by four cells (3 m × 2 m).
    const grid = fillRect(fillRect(createEmptyGrid(18, 32), { x: 2, y: 2, width: 4, height: 1 }), {
      x: 8,
      y: 8,
      width: 6,
      height: 4,
    });
    const walls = traceOutlines(grid).map(outline =>
      createIslandWall(outline, grid, PLAIN, FAR_TEE)
    );

    const surfaces = placeSurfaces(PLAIN, walls, grid);

    expect(surfaces.length).toBeGreaterThan(0);
    for (const surface of surfaces) {
      const face = walls[surface.wall].edges[surface.edge];
      expect(face.length).toBeGreaterThanOrEqual(1.5);
      expect(walls[surface.wall].bounds.max.x - walls[surface.wall].bounds.min.x).toBeCloseTo(3, 5);
      expect(surface.from).toBeGreaterThanOrEqual(0.2);
      expect(surface.from + surface.length).toBeLessThanOrEqual(face.length - 0.2 + 1e-9);
    }
  });

  it('is reproducible for a seed', () => {
    const grid = fillRect(createEmptyGrid(18, 32), { x: 4, y: 4, width: 8, height: 6 });
    const walls = traceOutlines(grid).map(outline =>
      createIslandWall(outline, grid, PLAIN, FAR_TEE)
    );

    expect(placeSurfaces(createRandom(3), walls, grid)).toEqual(
      placeSurfaces(createRandom(3), walls, grid)
    );
  });
});
