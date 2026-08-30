import { describe, expect, it } from 'vitest';

import { createRectangle, flattenShapes } from './shapes';
import type { SiteObjectState } from './site-object';
import {
  SITE_OBJECT_TRAITS,
  siteObjectReference,
  siteObjectSelection,
  translateSiteObject,
} from './site-object';
import { createBuilding, createCar, createSitePath, createTree } from './site-plan';

const OFFSET = { x: 3, y: -2 };

const treeObject = (): SiteObjectState => ({
  kind: 'tree',
  tree: createTree({ species: 'spruce', position: { x: 10, y: 10 }, crownRadius: 2, height: 10 }),
});

const carObject = (): SiteObjectState => ({
  kind: 'car',
  car: createCar({ position: { x: 5, y: 5 } }),
});

const buildingObject = (): SiteObjectState => ({
  kind: 'building',
  building: createBuilding({
    name: 'Дом',
    composition: {
      terms: [
        {
          operation: 'union',
          operand: createRectangle({
            center: { x: 10, y: 10 },
            width: 6,
            length: 6,
            rotationDegrees: 0,
          }),
        },
      ],
    },
  }),
});

const pathObject = (): SiteObjectState => ({
  kind: 'path',
  path: createSitePath({
    points: [
      { x: 2, y: 2 },
      { x: 6, y: 2 },
    ],
    width: 1,
  }),
});

describe('SITE_OBJECT_TRAITS', () => {
  it('moves every kind whole in view mode, and opens editors only where anatomy lives', () => {
    expect(SITE_OBJECT_TRAITS.tree).toEqual({ isMovable: true, hasEditor: false });
    expect(SITE_OBJECT_TRAITS.car).toEqual({ isMovable: true, hasEditor: false });
    expect(SITE_OBJECT_TRAITS.building).toEqual({ isMovable: true, hasEditor: true });
    expect(SITE_OBJECT_TRAITS.path).toEqual({ isMovable: true, hasEditor: true });
  });
});

describe('siteObjectReference', () => {
  it('nominates the position of a placed object', () => {
    expect(siteObjectReference(treeObject())).toEqual({ x: 10, y: 10 });
    expect(siteObjectReference(carObject())).toEqual({ x: 5, y: 5 });
  });

  it('nominates the first leaf of a building and the first point of a path', () => {
    expect(siteObjectReference(buildingObject())).toEqual({ x: 10, y: 10 });
    expect(siteObjectReference(pathObject())).toEqual({ x: 2, y: 2 });
  });

  it('offers nothing for a building with no footprint yet', () => {
    const empty: SiteObjectState = { kind: 'building', building: createBuilding({ name: 'Дом' }) };

    expect(siteObjectReference(empty)).toBeUndefined();
  });
});

describe('translateSiteObject', () => {
  it('slides a tree and a car by their positions', () => {
    const tree = translateSiteObject(treeObject(), OFFSET);
    const car = translateSiteObject(carObject(), OFFSET);

    expect(tree).toMatchObject({ tree: { position: { x: 13, y: 8 } } });
    expect(car).toMatchObject({ car: { position: { x: 8, y: 3 } } });
  });

  it('slides a building rigidly, keeping everything but the geometry', () => {
    const start = buildingObject();
    const moved = translateSiteObject(start, OFFSET);

    expect(moved.kind).toBe('building');

    if (moved.kind === 'building' && start.kind === 'building') {
      expect(flattenShapes(moved.building.composition)[0].center).toEqual({ x: 13, y: 8 });
      expect(moved.building.name).toBe(start.building.name);
      expect(moved.building.id).toBe(start.building.id);
    }
  });

  it('slides every point of a path, keeping widths and surfaces', () => {
    const moved = translateSiteObject(pathObject(), OFFSET);

    expect(moved.kind).toBe('path');

    if (moved.kind === 'path') {
      expect(moved.path.points.map(point => point.position)).toEqual([
        { x: 5, y: 0 },
        { x: 9, y: 0 },
      ]);
      expect(moved.path.points.map(point => point.width)).toEqual([1, 1]);
    }
  });
});

describe('siteObjectSelection', () => {
  it('names each object by its own id', () => {
    const tree = treeObject();
    const path = pathObject();

    if (tree.kind === 'tree') {
      expect(siteObjectSelection(tree)).toEqual({ kind: 'tree', treeId: tree.tree.id });
    }

    if (path.kind === 'path') {
      expect(siteObjectSelection(path)).toEqual({ kind: 'path', pathId: path.path.id });
    }
  });
});
