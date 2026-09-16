import { describe, expect, it } from 'vitest';

import {
  createWiringRoute,
  insertRoutePoint,
  removeRoutePoint,
  setRouteSegmentInstallation,
} from './wiring-routes';

const ROUTE = setRouteSegmentInstallation(
  createWiringRoute({
    points: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
    ],
    installation: 'conduit-20',
  }),
  1,
  'chase'
);

describe('insertRoutePoint', () => {
  it('splits a stretch into two laid the same way', () => {
    const split = insertRoutePoint(ROUTE, 1, { x: 4, y: 2 });

    expect(split.points).toHaveLength(4);
    expect(split.segments.map(segment => segment.installation)).toEqual([
      'conduit-20',
      'chase',
      'chase',
    ]);
  });
});

describe('removeRoutePoint', () => {
  it('joins the two stretches at the bend, keeping the earlier method', () => {
    const joined = removeRoutePoint(ROUTE, 1);

    expect(joined.points).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 4 },
    ]);
    expect(joined.segments.map(segment => segment.installation)).toEqual(['conduit-20']);
  });

  it('never drops a route below two points', () => {
    const short = createWiringRoute({
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
    });

    expect(removeRoutePoint(short, 0)).toBe(short);
  });
});
