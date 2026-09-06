import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { describe, expect, it } from 'vitest';

import { createOpening } from './openings';
import { createStorey } from './storeys';
import { removeWallEdge } from './wall-edge-removal';
import {
  junctionEdgesAt,
  junctionVerticesAt,
  moveWallJunction,
  normalizeWallCrossings,
} from './wall-topology';
import { createWall } from './walls';

function wallAcross() {
  return createWall({
    points: [
      { x: 0, y: 5 },
      { x: 10, y: 5 },
    ],
  });
}

function wallUp() {
  return createWall({
    points: [
      { x: 5, y: 0 },
      { x: 5, y: 10 },
    ],
  });
}

describe('normalizeWallCrossings', () => {
  it('plants a vertex in BOTH walls where they cross', () => {
    const storey = createStorey({ heightMeters: 3, walls: [wallAcross(), wallUp()] });
    const normalized = normalizeWallCrossings(storey);

    for (const wall of normalized.walls) {
      expect(wall.points).toHaveLength(3);
      expect(wall.points.some(point => point.x === 5 && point.y === 5)).toBe(true);
    }
  });

  it('plants a vertex where one wall ENDS on another — the T-стык', () => {
    const stem = createWall({
      points: [
        { x: 5, y: 0 },
        { x: 5, y: 5 },
      ],
    });
    const storey = createStorey({ heightMeters: 3, walls: [wallAcross(), stem] });
    const normalized = normalizeWallCrossings(storey);
    const bar = normalized.walls[0];

    expect(bar.points).toHaveLength(3);
    expect(bar.points[1]).toEqual({ x: 5, y: 5 });
    // The stem already ends there; it gains nothing.
    expect(normalized.walls[1].points).toHaveLength(2);
  });

  it('is idempotent: the second run changes nothing', () => {
    const storey = createStorey({ heightMeters: 3, walls: [wallAcross(), wallUp()] });
    const once = normalizeWallCrossings(storey);
    const twice = normalizeWallCrossings(once);

    expect(twice).toBe(once);
  });

  it('leaves every hosted offset where it stood: the insert is collinear', () => {
    const across = wallAcross();
    const opening = createOpening({ wallId: across.id, preset: 'door', offsetMeters: 8 });
    const storey = createStorey({
      heightMeters: 3,
      walls: [across, wallUp()],
      openings: [opening],
    });
    const normalized = normalizeWallCrossings(storey);

    expect(normalized.openings[0].offsetMeters).toBe(8);
    expect(normalized.openings[0].wallId).toBe(across.id);
  });

  it('cuts a crossing through a ring wall on both crossed sides', () => {
    const ringWall = {
      ...createWall({
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
      }),
      isClosed: true,
    };
    const spear = createWall({
      points: [
        { x: -2, y: 5 },
        { x: 12, y: 5 },
      ],
    });
    const storey = createStorey({ heightMeters: 3, walls: [ringWall, spear] });
    const normalized = normalizeWallCrossings(storey);

    expect(normalized.walls[0].points).toHaveLength(6);
    expect(normalized.walls[1].points).toHaveLength(4);
  });
});

describe('junctions', () => {
  it('finds every coincident vertex and numbers every incident edge', () => {
    const storey = createStorey({ heightMeters: 3, walls: [wallAcross(), wallUp()] });
    const normalized = normalizeWallCrossings(storey);
    const junction = { x: 5, y: 5 };

    expect(junctionVerticesAt(normalized.walls, junction)).toHaveLength(2);
    // An X-стык: two edges per wall leave the crossing.
    expect(junctionEdgesAt(normalized.walls, junction)).toHaveLength(4);
  });

  it('moves the whole junction: every wall through it follows', () => {
    const storey = normalizeWallCrossings(
      createStorey({ heightMeters: 3, walls: [wallAcross(), wallUp()] })
    );
    const moved = moveWallJunction(storey, { x: 5, y: 5 }, { x: 6, y: 4 });

    for (const wall of moved.walls) {
      expect(wall.points.some(point => point.x === 6 && point.y === 4)).toBe(true);
      expect(wall.points.some(point => point.x === 5 && point.y === 5)).toBe(false);
    }
  });
});

describe('removeWallEdge', () => {
  it('splits the wall in two around a removed middle segment, dealing the openings', () => {
    const wall = createWall({
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 8, y: 0 },
        { x: 12, y: 0 },
      ],
    });
    const before = createOpening({ wallId: wall.id, preset: 'window', offsetMeters: 2 });
    const onEdge = createOpening({ wallId: wall.id, preset: 'window', offsetMeters: 6 });
    const after = createOpening({ wallId: wall.id, preset: 'window', offsetMeters: 10 });
    const storey = createStorey({
      heightMeters: 3,
      walls: [wall],
      openings: [before, onEdge, after],
    });
    const edited = removeWallEdge(storey, wall.id, 1);

    expect(edited.walls).toHaveLength(2);

    const [left, right] = edited.walls;

    expect(left.points).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]);
    expect(right.points).toEqual([
      { x: 8, y: 0 },
      { x: 12, y: 0 },
    ]);
    // The window on the removed stretch went with it; the flanks kept place.
    expect(edited.openings).toHaveLength(2);
    expect(edited.openings[0]).toMatchObject({ wallId: left.id, offsetMeters: 2 });
    expect(edited.openings[1]).toMatchObject({ wallId: right.id, offsetMeters: 2 });
  });

  it('shortens the wall when the removed segment is its end', () => {
    const wall = createWall({
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 8, y: 0 },
      ],
    });
    const storey = createStorey({ heightMeters: 3, walls: [wall] });
    const edited = removeWallEdge(storey, wall.id, 1);

    expect(edited.walls).toHaveLength(1);
    expect(edited.walls[0].points).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]);
  });

  it('opens a ring into a run missing exactly the removed stretch', () => {
    const ringWall = {
      ...createWall({
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
      }),
      isClosed: true,
    };
    const opening = createOpening({ wallId: ringWall.id, preset: 'door', offsetMeters: 25 });
    const storey = createStorey({ heightMeters: 3, walls: [ringWall], openings: [opening] });
    const edited = removeWallEdge(storey, ringWall.id, 0);

    const opened = edited.walls[0];

    assert(!isNil(opened), 'the ring survives as one open wall');
    expect(opened.isClosed).toBe(false);
    expect(opened.points).toEqual([
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 },
    ]);
    // Offset 25 stood on the west side; rooted after the removed south run it is 25 − 10.
    expect(edited.openings[0].offsetMeters).toBe(15);
  });
});
