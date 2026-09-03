import { describe, expect, it } from 'vitest';

import { createOpening } from '../model/openings';
import { createWall } from '../model/walls';
import { multiPolygonArea } from './building-outline';
import { subtractPolygons } from './polygon-booleans';
import {
  buildOpeningBody,
  buildWallBodies,
  buildWallBody,
  projectOntoPolyline,
  subPolyline,
  wallCenterline,
} from './wall-geometry';

const STRAIGHT_POINTS = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
];

describe('buildWallBody', () => {
  it('inflates a centreline wall symmetrically with square ends', () => {
    const wall = { ...createWall({ points: STRAIGHT_POINTS }), thicknessMeters: 0.4 };
    const body = buildWallBody(wall);

    expect(multiPolygonArea(body)).toBeCloseTo(10 * 0.4, 2);

    const ys = body.flatMap(polygon => polygon.outer.map(point => point.y));

    expect(Math.min(...ys)).toBeCloseTo(-0.2, 2);
    expect(Math.max(...ys)).toBeCloseTo(0.2, 2);
  });

  it('keeps an outer-face wall entirely to the right of the drawn line', () => {
    const wall = {
      ...createWall({ points: STRAIGHT_POINTS }),
      thicknessMeters: 0.4,
      referenceLine: 'outer-face' as const,
    };
    const body = buildWallBody(wall);

    expect(multiPolygonArea(body)).toBeCloseTo(10 * 0.4, 2);

    // Drawn left to right along +x, the body hangs below the line (to the
    // right of travel): the drawn line IS the outer face and never moves.
    const ys = body.flatMap(polygon => polygon.outer.map(point => point.y));

    expect(Math.max(...ys)).toBeLessThanOrEqual(0.01);
    expect(Math.min(...ys)).toBeCloseTo(-0.4, 2);
  });

  it('closes a ring into an annulus — a body with the enclosed room as its hole', () => {
    const wall = {
      ...createWall({
        points: [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 6 },
          { x: 0, y: 6 },
        ],
      }),
      thicknessMeters: 0.4,
      isClosed: true,
    };
    const body = buildWallBody(wall);

    expect(body).toHaveLength(1);
    expect(body[0].holes).toHaveLength(1);
    // Four mitred runs of a 6 m square: outer 6.4² minus inner 5.6².
    expect(multiPolygonArea(body)).toBeCloseTo(6.4 * 6.4 - 5.6 * 5.6, 2);
  });

  it('walks a closed centreline back to its start for the offset machinery', () => {
    const wall = {
      ...createWall({
        points: [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 6 },
        ],
      }),
      isClosed: true,
    };
    const centerline = wallCenterline(wall);

    expect(centerline).toHaveLength(4);
    expect(centerline[3]).toEqual(centerline[0]);
  });

  it('turns an L-bend with a mitred corner, not a rounded one', () => {
    const wall = {
      ...createWall({
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 5 },
        ],
      }),
      thicknessMeters: 0.4,
    };
    const body = buildWallBody(wall);

    // The mitred corner completes the outer square exactly, so the L covers
    // precisely two runs' worth of area — a round join would fall short.
    expect(multiPolygonArea(body)).toBeCloseTo(5 * 0.4 * 2, 2);
  });
});

describe('buildWallBodies', () => {
  it('unions crossing walls instead of double-covering their intersection', () => {
    const horizontal = { ...createWall({ points: STRAIGHT_POINTS }), thicknessMeters: 0.4 };
    const vertical = {
      ...createWall({
        points: [
          { x: 5, y: -5 },
          { x: 5, y: 5 },
        ],
      }),
      thicknessMeters: 0.4,
    };
    const union = buildWallBodies([horizontal, vertical]);

    expect(multiPolygonArea(union)).toBeCloseTo(4 + 4 - 0.4 * 0.4, 1);
  });

  it('builds nothing from nothing', () => {
    expect(buildWallBodies([])).toEqual([]);
  });
});

describe('projectOntoPolyline', () => {
  it('lands on the nearest point of the run with its offset', () => {
    const projection = projectOntoPolyline(STRAIGHT_POINTS, { x: 4, y: 1.5 });

    expect(projection.offsetMeters).toBeCloseTo(4);
    expect(projection.distanceMeters).toBeCloseTo(1.5);
  });

  it('clamps beyond the ends', () => {
    expect(projectOntoPolyline(STRAIGHT_POINTS, { x: -3, y: 0 }).offsetMeters).toBeCloseTo(0);
    expect(projectOntoPolyline(STRAIGHT_POINTS, { x: 14, y: 0 }).offsetMeters).toBeCloseTo(10);
  });
});

describe('subPolyline', () => {
  it('cuts the stretch between two offsets', () => {
    expect(subPolyline(STRAIGHT_POINTS, 2, 5)).toEqual([
      { x: 2, y: 0 },
      { x: 5, y: 0 },
    ]);
  });
});

describe('buildOpeningBody', () => {
  it('occupies the opening width just past the wall thickness — a cutter, not a lining', () => {
    const wall = { ...createWall({ points: STRAIGHT_POINTS }), thicknessMeters: 0.4 };
    const opening = createOpening({ wallId: wall.id, preset: 'door', offsetMeters: 5 });
    const body = buildOpeningBody(wall, opening);
    const area = multiPolygonArea(body);

    expect(area).toBeGreaterThan(0.9 * 0.4);
    expect(area).toBeLessThan(0.9 * 0.45);
  });

  it('severs the wall in two at any bearing, never leaving a film over the opening', () => {
    // The booleans run on clipper's integer grid: with the cutter inflated to
    // EXACTLY the wall thickness, a turned wall's rounding left a millimetre
    // film of masonry across the opening — the painted-over-window bug. The
    // axis-aligned bearings only pass by rounding both solids identically.
    for (const bearingDegrees of [0, 10, 34, 45, 77]) {
      const radians = (bearingDegrees * Math.PI) / 180;
      const turned = (point: { readonly x: number; readonly y: number }) => ({
        x: 3.1 + point.x * Math.cos(radians) - point.y * Math.sin(radians),
        y: 7.2 + point.x * Math.sin(radians) + point.y * Math.cos(radians),
      });
      const wall = {
        ...createWall({ points: STRAIGHT_POINTS.map(turned) }),
        thicknessMeters: 0.38,
      };
      const opening = createOpening({ wallId: wall.id, preset: 'window', offsetMeters: 5 });
      const slotted = subtractPolygons(buildWallBodies([wall]), buildOpeningBody(wall, opening));

      expect(slotted, `bearing ${bearingDegrees}°`).toHaveLength(2);
    }
  });
});
