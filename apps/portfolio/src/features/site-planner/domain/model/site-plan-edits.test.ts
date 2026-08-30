import { assert } from '@frozik/utils/assert/assert';
import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID_STEP_METERS } from '../constants';
import { createCeilingLight, createWallDevice } from './electrical';
import { createOpening } from './openings';
import type { CsgOperand, Shape, ShapeComposition, ShapeGroup } from './shapes';
import {
  createCircle,
  createRectangle,
  createShapeId,
  findGroupTerm,
  findTerm,
  flattenShapes,
  isShapeGroup,
} from './shapes';
import type { CarInstance, ElevationMark, SitePath, TreeInstance } from './site-plan';
import {
  createBuilding,
  createCar,
  createCarId,
  createDefaultSitePlan,
  createMarkId,
  createPathId,
  createTreeId,
  openingsOf,
  storeysOf,
  wallsOf,
} from './site-plan';
import {
  addCar,
  addDevice,
  addMark,
  addOpening,
  addPath,
  addTerm,
  addTree,
  addWall,
  appendPathPoint,
  closeWallRing,
  cutWallAtPoint,
  insertPathPoint,
  moveMark,
  movePathPoint,
  moveTerm,
  removeCar,
  removeMark,
  removePath,
  removePathPoint,
  removeTerm,
  removeTree,
  removeWallPoint,
  reorderTerm,
  setMarkElevation,
  setPathPointWidth,
  setPathSegmentSurface,
  setTermOperation,
  translateBuilding,
  ungroupTerm,
  updateCar,
  updatePath,
  updatePathWidth,
  updateSettings,
  updateShape,
  updateTree,
  wrapTermInGroup,
} from './site-plan-edits';
import { devicesOf } from './storeys';
import { createWall } from './walls';

function createTestComposition(): ShapeComposition {
  return {
    terms: [
      {
        operand: createRectangle({
          center: { x: 15, y: 20 },
          width: 30,
          length: 40,
          rotationDegrees: 0,
        }),
        operation: 'union',
      },
      { operand: createCircle({ center: { x: 5, y: 5 }, radius: 3 }), operation: 'subtract' },
    ],
  };
}

/** The rectangle, then a group holding a circle cut out of another rectangle. */
function createNestedComposition(): ShapeComposition {
  const group: ShapeGroup = {
    kind: 'group',
    id: createShapeId(),
    terms: [
      {
        operand: createRectangle({
          center: { x: 40, y: 40 },
          width: 10,
          length: 10,
          rotationDegrees: 0,
        }),
        operation: 'union',
      },
      { operand: createCircle({ center: { x: 40, y: 40 }, radius: 2 }), operation: 'subtract' },
    ],
  };

  return { terms: [...createTestComposition().terms, { operand: group, operation: 'subtract' }] };
}

function nestedGroupOf(composition: ShapeComposition): ShapeGroup {
  const { operand } = composition.terms[2];

  if (!isShapeGroup(operand)) {
    throw new Error('the third term of the nested composition is expected to be a group');
  }

  return operand;
}

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

function leafShape(operand: CsgOperand): Shape {
  assert(!isShapeGroup(operand), 'expected a primitive shape operand');

  return operand;
}

describe('composition edits', () => {
  it('appends a term at the end', () => {
    const composition = createTestComposition();
    const term = {
      operand: createCircle({ center: { x: 9, y: 9 }, radius: 1 }),
      operation: 'union',
    } as const;

    const next = addTerm(composition, term);

    expect(next.terms).toHaveLength(3);
    expect(next.terms[2]).toBe(term);
    expect(composition.terms).toHaveLength(2);
  });

  it('replaces the shape of the matching term', () => {
    const composition = createTestComposition();
    const original = leafShape(composition.terms[0].operand);
    const resized = { ...original, width: 25 };

    const next = updateShape(composition, resized);

    expect(next.terms[0].operand).toEqual(resized);
    expect(next.terms[0].operation).toBe('union');
    expect(next.terms[1]).toBe(composition.terms[1]);
    expect(composition.terms[0].operand).toBe(original);
  });

  it('keeps the composition untouched when the shape is unknown', () => {
    const composition = createTestComposition();
    const foreign = createCircle({ center: { x: 0, y: 0 }, radius: 1 });

    expect(updateShape(composition, foreign)).toBe(composition);
    expect(setTermOperation(composition, foreign.id, 'union')).toBe(composition);
    expect(reorderTerm(composition, foreign.id, 0)).toBe(composition);
    expect(removeTerm(composition, foreign.id)).toBe(composition);
    expect(addTerm(composition, composition.terms[0], foreign.id)).toBe(composition);
    expect(wrapTermInGroup(composition, foreign.id, createShapeId())).toBe(composition);
    expect(ungroupTerm(composition, foreign.id)).toBe(composition);
  });

  it('switches the operation of a term', () => {
    const composition = createTestComposition();
    const circleId = composition.terms[1].operand.id;

    const next = setTermOperation(composition, circleId, 'union');

    expect(next.terms[1].operation).toBe('union');
    expect(next.terms[1].operand).toBe(composition.terms[1].operand);
    expect(composition.terms[1].operation).toBe('subtract');
  });

  it('moves a term to the requested position', () => {
    const composition = createTestComposition();
    const circleId = composition.terms[1].operand.id;

    const next = reorderTerm(composition, circleId, 0);

    expect(next.terms.map(term => term.operand.id)).toEqual([
      circleId,
      composition.terms[0].operand.id,
    ]);
  });

  it('clamps a reorder target to the available range', () => {
    const composition = createTestComposition();
    const rectangleId = composition.terms[0].operand.id;

    const next = reorderTerm(composition, rectangleId, 10);

    expect(next.terms[1].operand.id).toBe(rectangleId);
  });

  it('drops the term of the removed shape', () => {
    const composition = createTestComposition();
    const rectangleId = composition.terms[0].operand.id;

    const next = removeTerm(composition, rectangleId);

    expect(next.terms).toHaveLength(1);
    expect(next.terms[0]).toBe(composition.terms[1]);
  });
});

describe('nested composition edits', () => {
  it('appends a term to the addressed group instead of the root', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);
    const term = {
      operand: createCircle({ center: { x: 41, y: 41 }, radius: 1 }),
      operation: 'union',
    } as const;

    const next = addTerm(composition, term, group.id);

    expect(next.terms).toHaveLength(3);
    expect(nestedGroupOf(next).terms).toHaveLength(3);
    expect(nestedGroupOf(next).terms[2]).toBe(term);
    expect(group.terms).toHaveLength(2);
  });

  it('edits a leaf that sits inside a group', () => {
    const composition = createNestedComposition();
    const nested = leafShape(nestedGroupOf(composition).terms[0].operand);
    const resized = { ...nested, width: 12 };

    const next = updateShape(composition, resized);

    expect(nestedGroupOf(next).terms[0].operand).toEqual(resized);
    expect(next.terms[0]).toBe(composition.terms[0]);
  });

  it('switches, moves and drops a term inside a group', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);
    const [firstTerm, secondTerm] = group.terms;

    expect(
      nestedGroupOf(setTermOperation(composition, secondTerm.operand.id, 'union')).terms[1]
    ).toMatchObject({ operation: 'union' });
    expect(
      nestedGroupOf(reorderTerm(composition, secondTerm.operand.id, 0)).terms.map(
        term => term.operand.id
      )
    ).toEqual([secondTerm.operand.id, firstTerm.operand.id]);
    expect(nestedGroupOf(removeTerm(composition, firstTerm.operand.id)).terms).toEqual([
      secondTerm,
    ]);
  });

  it('takes the whole subtree away with the group it removes', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);

    const next = removeTerm(composition, group.id);

    expect(next.terms).toHaveLength(2);
    expect(findTerm(next, group.terms[0].operand.id)).toBeUndefined();
  });

  it('keeps a reorder confined to the term list that holds the term', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);

    const next = reorderTerm(composition, group.terms[1].operand.id, 0);

    expect(next.terms.map(term => term.operand.id)).toEqual(
      composition.terms.map(term => term.operand.id)
    );
  });
});

describe('moveTerm', () => {
  it('takes a root term into the addressed group at the requested place', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);
    const circleTerm = composition.terms[1];

    const next = moveTerm(composition, circleTerm.operand.id, group.id, 1);

    expect(next.terms.map(term => term.operand.id)).toEqual([
      composition.terms[0].operand.id,
      group.id,
    ]);
    expect(findGroupTerm(next, group.id)?.group.terms).toEqual([
      group.terms[0],
      circleTerm,
      group.terms[1],
    ]);
  });

  it('takes a nested term out to the root', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);
    const innerCircleTerm = group.terms[1];

    const next = moveTerm(composition, innerCircleTerm.operand.id, undefined, 1);

    expect(next.terms.map(term => term.operand.id)).toEqual([
      composition.terms[0].operand.id,
      innerCircleTerm.operand.id,
      composition.terms[1].operand.id,
      group.id,
    ]);
    expect(next.terms[1].operation).toBe('subtract');
    expect(findGroupTerm(next, group.id)?.group.terms).toHaveLength(1);
  });

  it('counts the target place over the list as it stands before the move', () => {
    const composition = createNestedComposition();
    const [rectangleTerm, circleTerm] = composition.terms;

    const next = moveTerm(composition, rectangleTerm.operand.id, undefined, 2);

    expect(next.terms.map(term => term.operand.id)).toEqual([
      circleTerm.operand.id,
      rectangleTerm.operand.id,
      nestedGroupOf(composition).id,
    ]);
  });

  it('clamps the target place into the list', () => {
    const composition = createNestedComposition();
    const rectangleTerm = composition.terms[0];

    const next = moveTerm(composition, rectangleTerm.operand.id, undefined, 10);

    expect(next.terms[2].operand.id).toBe(rectangleTerm.operand.id);
  });

  it('carries the whole subtree with the group it moves', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);

    const next = moveTerm(composition, group.id, undefined, 0);

    expect(next.terms[0].operand).toBe(group);
    expect(flattenShapes(next)).toHaveLength(flattenShapes(composition).length);
  });

  it('refuses to move a group into itself', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);

    expect(moveTerm(composition, group.id, group.id, 0)).toBe(composition);
  });

  it('refuses to move a group into a group nested inside it', () => {
    const composition = createNestedComposition();
    const outerGroup = nestedGroupOf(composition);
    const innerGroupId = createShapeId();
    const nested = wrapTermInGroup(composition, outerGroup.terms[0].operand.id, innerGroupId);

    expect(moveTerm(nested, outerGroup.id, innerGroupId, 0)).toBe(nested);
  });

  it('keeps the composition for an unknown term or an unknown target', () => {
    const composition = createNestedComposition();
    const rectangleId = composition.terms[0].operand.id;
    const foreignId = createShapeId();

    expect(moveTerm(composition, foreignId, undefined, 0)).toBe(composition);
    expect(moveTerm(composition, rectangleId, foreignId, 0)).toBe(composition);
    // A leaf is not a container: dropping a term on a shape means nothing.
    expect(moveTerm(composition, rectangleId, composition.terms[1].operand.id, 0)).toBe(
      composition
    );
  });

  it('keeps the composition when the term is asked for the place it already holds', () => {
    const composition = createNestedComposition();
    const rectangleId = composition.terms[0].operand.id;

    expect(moveTerm(composition, rectangleId, undefined, 0)).toBe(composition);
    expect(moveTerm(composition, rectangleId, undefined, 1)).toBe(composition);
  });

  it('unions the term that lands first in its new list', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);
    const circleTerm = composition.terms[1];

    const movedToRoot = moveTerm(composition, circleTerm.operand.id, undefined, 0);
    const movedIntoGroup = moveTerm(composition, circleTerm.operand.id, group.id, 0);

    expect(movedToRoot.terms[0]).toEqual({ operand: circleTerm.operand, operation: 'union' });
    expect(findGroupTerm(movedIntoGroup, group.id)?.group.terms[0]).toEqual({
      operand: circleTerm.operand,
      operation: 'union',
    });
  });

  it('unions the term left standing first by the one that moved away', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);

    const next = moveTerm(composition, group.terms[0].operand.id, undefined, 3);

    expect(findGroupTerm(next, group.id)?.group.terms).toEqual([
      { operand: group.terms[1].operand, operation: 'union' },
    ]);
  });
});

describe('wrapTermInGroup', () => {
  it('replaces the term with a group holding it, under the given identity', () => {
    const composition = createTestComposition();
    const circleTerm = composition.terms[1];
    const groupId = createShapeId();

    const next = wrapTermInGroup(composition, circleTerm.operand.id, groupId);
    const wrapped = findGroupTerm(next, groupId);

    expect(next.terms).toHaveLength(2);
    expect(wrapped?.group.id).toBe(groupId);
    // The group joins the fold the way the term did, and the term is unioned
    // inside it, so the plan is drawn exactly as it was before.
    expect(wrapped?.operation).toBe('subtract');
    expect(wrapped?.group.terms).toEqual([{ operand: circleTerm.operand, operation: 'union' }]);
    expect(composition.terms[1]).toBe(circleTerm);
  });

  it('wraps a term that sits inside a group', () => {
    const composition = createNestedComposition();
    const innerTerm = nestedGroupOf(composition).terms[0];
    const groupId = createShapeId();

    const next = wrapTermInGroup(composition, innerTerm.operand.id, groupId);

    expect(nestedGroupOf(next).terms[0].operand.id).toBe(groupId);
    expect(flattenShapes(next)).toEqual(flattenShapes(composition));
  });
});

describe('ungroupTerm', () => {
  it('inlines the terms of the group in its place', () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);

    const next = ungroupTerm(composition, group.id);

    expect(next.terms).toHaveLength(4);
    expect(next.terms.map(term => term.operand.id)).toEqual([
      composition.terms[0].operand.id,
      composition.terms[1].operand.id,
      group.terms[0].operand.id,
      group.terms[1].operand.id,
    ]);
  });

  it("hands the group's operation to the first inlined term and leaves the rest alone", () => {
    const composition = createNestedComposition();
    const group = nestedGroupOf(composition);

    const next = ungroupTerm(composition, group.id);

    expect(next.terms[2].operation).toBe('subtract');
    expect(next.terms[3]).toBe(group.terms[1]);
  });

  it('undoes a wrap exactly', () => {
    const composition = createTestComposition();
    const groupId = createShapeId();

    const wrapped = wrapTermInGroup(composition, composition.terms[1].operand.id, groupId);

    expect(ungroupTerm(wrapped, groupId)).toEqual(composition);
  });

  it('drops an empty group, since it has nothing to inline', () => {
    const emptyGroup: ShapeGroup = { kind: 'group', id: createShapeId(), terms: [] };
    const composition: ShapeComposition = {
      terms: [...createTestComposition().terms, { operand: emptyGroup, operation: 'union' }],
    };

    expect(ungroupTerm(composition, emptyGroup.id).terms).toHaveLength(2);
  });

  it('refuses to ungroup a leaf', () => {
    const composition = createTestComposition();

    expect(ungroupTerm(composition, composition.terms[0].operand.id)).toBe(composition);
  });
});

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

describe('settings edits', () => {
  it('changes only the field it is given', () => {
    const settings = createDefaultSitePlan().settings;

    const next = updateSettings(settings, { gridStepMeters: 0.25 });

    expect(next).toEqual({ ...settings, gridStepMeters: 0.25 });
    expect(settings.gridStepMeters).toBe(DEFAULT_GRID_STEP_METERS);
  });

  it('merges the location instead of replacing it', () => {
    const settings = createDefaultSitePlan().settings;

    const next = updateSettings(settings, { location: { latitudeDegrees: 55.75 } });

    expect(next.location).toEqual({ ...settings.location, latitudeDegrees: 55.75 });
  });

  it('keeps the location identity when nothing about it changes', () => {
    const settings = createDefaultSitePlan().settings;

    const next = updateSettings(settings, { setbackMeters: 5 });

    expect(next.location).toBe(settings.location);
  });

  it('applies several fields at once', () => {
    const settings = createDefaultSitePlan().settings;

    const next = updateSettings(settings, {
      isSnapEnabled: false,
      heightfieldTargetResolution: 128,
      contourIntervalMeters: 0.25,
      location: { timeZoneId: 'Europe/Berlin', northOffsetDegrees: 15 },
    });

    expect(next).toEqual({
      ...settings,
      isSnapEnabled: false,
      heightfieldTargetResolution: 128,
      contourIntervalMeters: 0.25,
      location: { ...settings.location, timeZoneId: 'Europe/Berlin', northOffsetDegrees: 15 },
    });
  });

  it('folds a north offset written outside a single turn into one', () => {
    const settings = createDefaultSitePlan().settings;

    expect(updateSettings(settings, { location: { northOffsetDegrees: 375 } }).location).toEqual({
      ...settings.location,
      northOffsetDegrees: 15,
    });
    expect(updateSettings(settings, { location: { northOffsetDegrees: -90 } }).location).toEqual({
      ...settings.location,
      northOffsetDegrees: 270,
    });
  });
});

describe('wall contour edits', () => {
  const RING_POINTS = [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 6 },
    { x: 0, y: 6 },
  ];

  const buildRing = () => {
    const building = createBuilding({ name: 'Дом' });
    const wall = { ...createWall({ points: RING_POINTS }), isClosed: true };
    const storeyId = storeysOf(building)[0].id;
    const withWall = addWall([building], building.id, storeyId, wall);

    return { buildings: withWall, building, wall, storeyId };
  };

  it('closes an open wall into a ring, collapsing coincident ends', () => {
    const building = createBuilding({ name: 'Дом' });
    const wall = createWall({ points: [...RING_POINTS, RING_POINTS[0]] });
    const withWall = addWall([building], building.id, storeysOf(building)[0].id, wall);

    const closed = wallsOf(closeWallRing(withWall, building.id, wall.id)[0])[0];

    expect(closed.isClosed).toBe(true);
    expect(closed.points).toEqual(RING_POINTS);
  });

  it('refuses to close below a triangle of corners', () => {
    const building = createBuilding({ name: 'Дом' });
    const wall = createWall({ points: RING_POINTS.slice(0, 2) });
    const withWall = addWall([building], building.id, storeysOf(building)[0].id, wall);

    expect(wallsOf(closeWallRing(withWall, building.id, wall.id)[0])[0].isClosed).toBeUndefined();
  });

  it('cuts a ring open at a corner and rotates every hosted offset with it', () => {
    const { buildings, building, wall, storeyId } = buildRing();
    // Offset 8 on the 24 m loop: two metres past the second corner.
    const opening = createOpening({ wallId: wall.id, preset: 'window', offsetMeters: 8 });
    const device = createWallDevice({ kind: 'outlet', wallId: wall.id, offsetMeters: 20 });
    const withHosted = addDevice(
      addOpening(buildings, building.id, opening),
      building.id,
      storeyId,
      device
    );

    const cut = cutWallAtPoint(withHosted, building.id, wall.id, 1);
    const [cutWall] = wallsOf(cut[0]);

    // Re-rooted at the cut corner, ends coincident but no longer joined.
    expect(cutWall.isClosed).toBe(false);
    expect(cutWall.points[0]).toEqual(RING_POINTS[1]);
    expect(cutWall.points[cutWall.points.length - 1]).toEqual(RING_POINTS[1]);

    // The cut sits 6 m into the old loop, so 8 → 2 and 20 → 14.
    expect(openingsOf(cut[0])[0].offsetMeters).toBeCloseTo(2);

    const [movedDevice] = devicesOf(storeysOf(cut[0])[0]);

    assert(movedDevice.host.kind === 'wall', 'expected a wall-hosted device');
    expect(movedDevice.host.offsetMeters).toBeCloseTo(14);
  });

  it('splits an open wall in two at an interior corner, dealing hosted things out', () => {
    const building = createBuilding({ name: 'Дом' });
    const wall = { ...createWall({ points: RING_POINTS.slice(0, 3) }), thicknessMeters: 0.5 };
    const storeyId = storeysOf(building)[0].id;
    const opening = createOpening({ wallId: wall.id, preset: 'window', offsetMeters: 8 });
    const withHosted = addOpening(
      addWall([building], building.id, storeyId, wall),
      building.id,
      opening
    );

    const split = cutWallAtPoint(withHosted, building.id, wall.id, 1);
    const walls = wallsOf(split[0]);

    expect(walls).toHaveLength(2);
    expect(walls[0].points).toEqual(RING_POINTS.slice(0, 2));
    expect(walls[1].points).toEqual(RING_POINTS.slice(1, 3));
    // The second half inherits the construction, not the material default.
    expect(walls[1].thicknessMeters).toBeCloseTo(0.5);

    const [movedOpening] = openingsOf(split[0]);

    expect(movedOpening.wallId).toBe(walls[1].id);
    expect(movedOpening.offsetMeters).toBeCloseTo(2);
  });

  it("refuses a cut at an open wall's endpoint", () => {
    const building = createBuilding({ name: 'Дом' });
    const wall = createWall({ points: RING_POINTS.slice(0, 3) });
    const withWall = addWall([building], building.id, storeysOf(building)[0].id, wall);

    expect(cutWallAtPoint(withWall, building.id, wall.id, 0)).toEqual(withWall);
  });

  it('keeps a ring at its triangle and an open run at its segment', () => {
    const { buildings, building, wall } = buildRing();
    const triangle = removeWallPoint(buildings, building.id, wall.id, 0);

    expect(wallsOf(triangle[0])[0].points).toHaveLength(3);
    expect(wallsOf(removeWallPoint(triangle, building.id, wall.id, 0)[0])[0].points).toHaveLength(
      3
    );
  });
});

describe('translateBuilding', () => {
  it('carries the whole interior with the slab and leaves hosted offsets alone', () => {
    const building = createBuilding({ name: 'Дом' });
    const wall = createWall({
      points: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
      ],
    });
    const storeyId = storeysOf(building)[0].id;
    const opening = createOpening({ wallId: wall.id, preset: 'window', offsetMeters: 2 });
    const outlet = createWallDevice({ kind: 'outlet', wallId: wall.id, offsetMeters: 4 });
    const light = createCeilingLight({ x: 3, y: 1 });
    const withInterior = addDevice(
      addDevice(
        addOpening(addWall([building], building.id, storeyId, wall), building.id, opening),
        building.id,
        storeyId,
        outlet
      ),
      building.id,
      storeyId,
      light
    );

    const moved = translateBuilding(withInterior[0], { x: 10, y: -2 });
    const storey = storeysOf(moved)[0];

    expect(storey.walls[0].points).toEqual([
      { x: 10, y: -2 },
      { x: 16, y: -2 },
    ]);

    const devices = devicesOf(storey);
    const movedLight = devices.find(device => device.kind === 'light');
    const movedOutlet = devices.find(device => device.kind === 'outlet');

    assert(movedLight?.host.kind === 'ceiling', 'expected the ceiling light');
    expect(movedLight.host.position).toEqual({ x: 13, y: -1 });
    // Hosted by offset along the wall — it rides the wall, no move needed.
    assert(movedOutlet?.host.kind === 'wall', 'expected the wall outlet');
    expect(movedOutlet.host.offsetMeters).toBeCloseTo(4);
    expect(openingsOf(moved)[0].offsetMeters).toBeCloseTo(2);
  });
});
