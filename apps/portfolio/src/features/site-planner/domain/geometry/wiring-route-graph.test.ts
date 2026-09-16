import { describe, expect, it } from 'vitest';

import { createWiringRoute } from '../model/wiring-routes';
import { routeAlongDrawnRoutes } from './wiring-route-graph';

/** A ceiling run along y = 8 from x = 0 to 10, and a branch off it at x = 6. */
const TRUNK = createWiringRoute({
  points: [
    { x: 0, y: 8 },
    { x: 10, y: 8 },
  ],
});
const BRANCH = createWiringRoute({
  points: [
    { x: 6, y: 8 },
    { x: 6, y: 2 },
  ],
});

describe('routeAlongDrawnRoutes', () => {
  it('drops both ends onto the route and runs between the two landings', () => {
    const run = routeAlongDrawnRoutes([TRUNK], { x: 2, y: 8.5 }, { x: 9, y: 7.6 });

    expect(run?.points).toEqual([
      { x: 2, y: 8.5 },
      { x: 2, y: 8 },
      { x: 9, y: 8 },
      { x: 9, y: 7.6 },
    ]);
    expect(run?.stretches).toEqual([{ routeId: TRUNK.id, segmentIndex: 0 }]);
  });

  it('turns off the trunk onto a branch that ends on its side', () => {
    const run = routeAlongDrawnRoutes([TRUNK, BRANCH], { x: 1, y: 8 }, { x: 6.4, y: 3 });

    expect(run?.points).toContainEqual({ x: 6, y: 8 });
    expect(run?.points.at(-1)).toEqual({ x: 6.4, y: 3 });
    expect(run?.stretches.map(stretch => stretch.routeId)).toEqual([TRUNK.id, BRANCH.id]);
  });

  it('serves nothing that stands out of reach of every route', () => {
    expect(routeAlongDrawnRoutes([TRUNK], { x: 1, y: 8 }, { x: 5, y: 20 })).toBeUndefined();
  });

  it('serves nothing across routes that never meet', () => {
    const island = createWiringRoute({
      points: [
        { x: 20, y: 20 },
        { x: 30, y: 20 },
      ],
    });

    expect(
      routeAlongDrawnRoutes([TRUNK, island], { x: 1, y: 8 }, { x: 25, y: 20 })
    ).toBeUndefined();
  });
});
