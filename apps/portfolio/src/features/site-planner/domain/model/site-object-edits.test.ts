import { describe, expect, it } from 'vitest';
import {
  addCar,
  addMark,
  addPath,
  addTree,
  appendPathPoint,
  insertPathPoint,
  moveMark,
  movePathPoint,
  removeCar,
  removeMark,
  removePath,
  removePathPoint,
  removeTree,
  setMarkElevation,
  setPathPointWidth,
  setPathSegmentSurface,
  updateCar,
  updatePath,
  updatePathWidth,
  updateTree,
} from './site-object-edits';
import type { CarInstance, ElevationMark, SitePath, TreeInstance } from './site-plan';
import { createCar, createCarId, createMarkId, createPathId, createTreeId } from './site-plan';

function createTestMark(elevation: number): ElevationMark {
  return { id: createMarkId(), position: { x: 1, y: 2 }, elevation };
}

function createTestCar(): CarInstance {
  return createCar({ position: { x: 6, y: 7 }, rotationDegrees: 30 });
}

function createTestTree(): TreeInstance {
  return {
    id: createTreeId(),
    species: 'spruce',
    position: { x: 3, y: 4 },
    crownRadius: 2,
    height: 8,
  };
}

function createTestPath(): SitePath {
  return {
    id: createPathId(),
    points: [
      { position: { x: 0, y: 0 }, width: 1 },
      { position: { x: 2, y: 0 }, width: 1 },
    ],
  };
}

describe('elevation mark edits', () => {
  it('appends a mark', () => {
    const mark = createTestMark(1);

    expect(addMark([], mark)).toEqual([mark]);
  });

  it('moves a mark without touching its elevation', () => {
    const mark = createTestMark(1.5);

    const next = moveMark([mark], mark.id, { x: 7, y: 8 });

    expect(next[0].position).toEqual({ x: 7, y: 8 });
    expect(next[0].elevation).toBe(1.5);
    expect(mark.position).toEqual({ x: 1, y: 2 });
  });

  it('sets the elevation of a mark', () => {
    const mark = createTestMark(1);

    expect(setMarkElevation([mark], mark.id, 2.25)[0].elevation).toBe(2.25);
  });

  it('removes a mark', () => {
    const kept = createTestMark(1);
    const removed = createTestMark(2);

    expect(removeMark([kept, removed], removed.id)).toEqual([kept]);
  });

  it('keeps the section reference for an unknown mark', () => {
    const marks = [createTestMark(1)];
    const foreignId = createMarkId();

    expect(moveMark(marks, foreignId, { x: 0, y: 0 })).toBe(marks);
    expect(setMarkElevation(marks, foreignId, 3)).toBe(marks);
    expect(removeMark(marks, foreignId)).toBe(marks);
  });
});

describe('tree edits', () => {
  it('appends a tree', () => {
    const tree = createTestTree();

    expect(addTree([], tree)).toEqual([tree]);
  });

  it('replaces a tree by id', () => {
    const tree = createTestTree();
    const grown = { ...tree, height: 12 };

    const next = updateTree([tree], grown);

    expect(next[0]).toBe(grown);
    expect(tree.height).toBe(8);
  });

  it('removes a tree', () => {
    const kept = createTestTree();
    const removed = createTestTree();

    expect(removeTree([kept, removed], removed.id)).toEqual([kept]);
  });

  it('keeps the section reference for an unknown tree', () => {
    const trees = [createTestTree()];
    const foreign = { ...createTestTree(), id: createTreeId() };

    expect(updateTree(trees, foreign)).toBe(trees);
    expect(removeTree(trees, foreign.id)).toBe(trees);
  });
});

describe('car edits', () => {
  it('appends a car', () => {
    const car = createTestCar();

    expect(addCar([], car)).toEqual([car]);
  });

  it('replaces a car by id', () => {
    const car = createTestCar();
    const turned = { ...car, rotationDegrees: 90 };

    const next = updateCar([car], turned);

    expect(next[0]).toBe(turned);
    expect(car.rotationDegrees).toBe(30);
  });

  it('removes a car', () => {
    const kept = createTestCar();
    const removed = createTestCar();

    expect(removeCar([kept, removed], removed.id)).toEqual([kept]);
  });

  it('keeps the section reference for an unknown car', () => {
    const cars = [createTestCar()];
    const foreign = { ...createTestCar(), id: createCarId() };

    expect(updateCar(cars, foreign)).toBe(cars);
    expect(removeCar(cars, foreign.id)).toBe(cars);
  });
});

describe('path edits', () => {
  it('appends a path', () => {
    const path = createTestPath();

    expect(addPath([], path)).toEqual([path]);
  });

  it('appends a point to the end of a path', () => {
    const path = createTestPath();

    const next = appendPathPoint([path], path.id, { x: 2, y: 5 });

    expect(next[0].points.map(point => point.position)).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 5 },
    ]);
    expect(next[0].points[2].width).toBe(1);
    expect(path.points).toHaveLength(2);
  });

  it('sets one width into every point of a path', () => {
    const path = createTestPath();

    const next = updatePathWidth([path], path.id, 1.5);

    expect(next[0].points.map(point => point.width)).toEqual([1.5, 1.5]);
  });

  it('sets the width of a single point', () => {
    const path = createTestPath();

    const next = setPathPointWidth([path], path.id, 1, 2.5);

    expect(next[0].points.map(point => point.width)).toEqual([1, 2.5]);
  });

  it('removes a path', () => {
    const kept = createTestPath();
    const removed = createTestPath();

    expect(removePath([kept, removed], removed.id)).toEqual([kept]);
  });

  it('moves one point and leaves the rest', () => {
    const path = createTestPath();

    const next = movePathPoint([path], path.id, 1, { x: 3, y: 4 });

    expect(next[0].points).toEqual([
      { position: { x: 0, y: 0 }, width: 1 },
      { position: { x: 3, y: 4 }, width: 1 },
    ]);
    expect(path.points[1].position).toEqual({ x: 2, y: 0 });
  });

  it('plants a point inside the segment it splits', () => {
    const path = createTestPath();

    const next = insertPathPoint([path], path.id, 0, { x: 1, y: 2 });

    expect(next[0].points.map(point => point.position)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: 2, y: 0 },
    ]);
  });

  it('plants a point at the width the ribbon has where it lands', () => {
    const path: SitePath = {
      id: createPathId(),
      points: [
        { position: { x: 0, y: 0 }, width: 1 },
        { position: { x: 4, y: 0 }, width: 3 },
      ],
    };

    const next = insertPathPoint([path], path.id, 0, { x: 1, y: 0 });

    expect(next[0].points[1]).toEqual({ position: { x: 1, y: 0 }, width: 1.5 });
  });

  it('removes a point while a segment remains', () => {
    const path = {
      ...createTestPath(),
      points: [...createTestPath().points, { position: { x: 4, y: 0 }, width: 1 }],
    };

    const next = removePathPoint([path], path.id, 1);

    expect(next[0].points.map(point => point.position)).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]);
  });

  it('refuses to trim a path below two points', () => {
    const paths = [createTestPath()];

    expect(removePathPoint(paths, paths[0].id, 0)).toBe(paths);
  });

  it('replaces a path whole', () => {
    const path = createTestPath();
    const reshaped = {
      ...path,
      points: [...path.points, { position: { x: 5, y: 5 }, width: 1 }],
    };

    expect(updatePath([path], reshaped)[0]).toBe(reshaped);
  });

  it('repaves one segment and carries the paving through a split', () => {
    const path = {
      ...createTestPath(),
      points: [...createTestPath().points, { position: { x: 4, y: 0 }, width: 1 }],
    };

    const paved = setPathSegmentSurface([path], path.id, 1, 'dirt');

    expect(paved[0].points.map(point => point.surface)).toEqual([undefined, 'dirt', undefined]);

    const split = insertPathPoint(paved, path.id, 1, { x: 3, y: 0 });

    expect(split[0].points.map(point => point.surface)).toEqual([
      undefined,
      'dirt',
      'dirt',
      undefined,
    ]);
  });

  it('keeps the paving of the earlier segment when a point is removed', () => {
    const path = {
      ...createTestPath(),
      points: [...createTestPath().points, { position: { x: 4, y: 0 }, width: 1 }],
    };
    const paved = setPathSegmentSurface([path], path.id, 0, 'dirt');

    const merged = removePathPoint(paved, path.id, 1);

    expect(merged[0].points.map(point => point.surface)).toEqual(['dirt', undefined]);
  });

  it('keeps the section reference for an unknown path', () => {
    const paths = [createTestPath()];
    const foreignId = createPathId();

    expect(appendPathPoint(paths, foreignId, { x: 0, y: 0 })).toBe(paths);
    expect(updatePathWidth(paths, foreignId, 2)).toBe(paths);
    expect(removePath(paths, foreignId)).toBe(paths);
    expect(movePathPoint(paths, foreignId, 0, { x: 1, y: 1 })).toBe(paths);
    expect(insertPathPoint(paths, foreignId, 0, { x: 1, y: 1 })).toBe(paths);
    expect(removePathPoint(paths, foreignId, 0)).toBe(paths);
  });
});
