import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import {
  hitTestCar,
  hitTestPath,
  hitTestTree,
  hitTestUtilityRoute,
} from '../../domain/geometry/hit-test-objects';
import { hitTestShape } from '../../domain/geometry/hit-test-shape';
import type { Building } from '../../domain/model/building';
import type { CarInstance, SitePath, TreeInstance } from '../../domain/model/plot-objects';
import type { UtilityRoute } from '../../domain/model/routing';
import type { ShapeOwner } from '../../domain/model/selection';
import type { CsgOperand, CsgTerm, Shape } from '../../domain/model/shapes';
import type { SiteObjectState } from '../../domain/model/site-object';
import type { ElevationMark } from '../../domain/model/site-plan';
import type { Meters } from '../../domain/units';
import type { PlanViewport } from '../../domain/view/plan-viewport';
import type { ShapeHandle } from '../render/plan-draw/draw-selection';
import { HANDLE_SIZE_PX } from '../render/plan-draw/draw-selection';
import type { SitePlannerStore } from '../SitePlannerStore';

/** Grab radius around a handle centre — a forgiving target over the drawn square. */
export const HANDLE_HIT_RADIUS_PX = HANDLE_SIZE_PX;
/** How far outside its outline an object still answers a click, in pixels. */
const PICK_TOLERANCE_PX = 6;
/**
 * Grab radius around an elevation mark. Generous next to the drawn dot: the flag
 * above the point is what the eye aims at, and the whole of it should answer.
 */
const MARK_PICK_RADIUS_PX = 12;

export interface PickedShape {
  readonly owner: ShapeOwner;
  readonly shape: Shape;
}

export function findHandleAt(
  handles: readonly ShapeHandle[],
  screenPoint: Vector2
): ShapeHandle | undefined {
  return handles.find(
    handle =>
      Math.hypot(handle.screenPoint.x - screenPoint.x, handle.screenPoint.y - screenPoint.y) <=
      HANDLE_HIT_RADIUS_PX
  );
}

/** The house sits over the plot, so its terms answer a click first. */
export function pickShape(
  store: SitePlannerStore,
  viewport: PlanViewport,
  planPoint: Vector2
): PickedShape | undefined {
  const toleranceMeters = PICK_TOLERANCE_PX / viewport.pixelsPerMeter;
  const { buildings } = store;

  // Buildings stand over the plot, later ones drawn over earlier — picked
  // in the same order, topmost first.
  for (let index = buildings.length - 1; index >= 0; index -= 1) {
    const building = buildings[index];
    const shape = pickFromTerms(building.composition.terms, planPoint, toleranceMeters);

    if (!isNil(shape)) {
      return { owner: building.id, shape };
    }
  }

  const boundaryShape = pickFromTerms(store.boundary.terms, planPoint, toleranceMeters);

  return isNil(boundaryShape) ? undefined : { owner: 'boundary', shape: boundaryShape };
}

/** The topmost mark within grabbing distance; later marks lie over earlier ones. */
export function pickMark(
  store: SitePlannerStore,
  viewport: PlanViewport,
  planPoint: Vector2
): ElevationMark | undefined {
  const radiusMeters = MARK_PICK_RADIUS_PX / viewport.pixelsPerMeter;
  const { elevationMarks } = store;

  for (let index = elevationMarks.length - 1; index >= 0; index -= 1) {
    const mark = elevationMarks[index];

    if (Math.hypot(mark.position.x - planPoint.x, mark.position.y - planPoint.y) <= radiusMeters) {
      return mark;
    }
  }

  return undefined;
}

/** The topmost tree whose crown covers the point; later trees lie over earlier ones. */
function pickTree(
  store: SitePlannerStore,
  viewport: PlanViewport,
  planPoint: Vector2
): TreeInstance | undefined {
  const toleranceMeters = PICK_TOLERANCE_PX / viewport.pixelsPerMeter;
  const { trees } = store;

  for (let index = trees.length - 1; index >= 0; index -= 1) {
    if (hitTestTree(trees[index], planPoint, toleranceMeters)) {
      return trees[index];
    }
  }

  return undefined;
}

/** The topmost car the point falls on; later cars lie over earlier ones. */
function pickCar(
  store: SitePlannerStore,
  viewport: PlanViewport,
  planPoint: Vector2
): CarInstance | undefined {
  const toleranceMeters = PICK_TOLERANCE_PX / viewport.pixelsPerMeter;
  const { cars } = store;

  for (let index = cars.length - 1; index >= 0; index -= 1) {
    if (hitTestCar(cars[index], planPoint, toleranceMeters)) {
      return cars[index];
    }
  }

  return undefined;
}

export function pickPath(
  store: SitePlannerStore,
  viewport: PlanViewport,
  planPoint: Vector2
): SitePath | undefined {
  const toleranceMeters = PICK_TOLERANCE_PX / viewport.pixelsPerMeter;
  const { paths } = store;

  for (let index = paths.length - 1; index >= 0; index -= 1) {
    if (hitTestPath(paths[index], planPoint, toleranceMeters)) {
      return paths[index];
    }
  }

  return undefined;
}

/**
 * A trench is a hairline, so it answers over a wider halo than a filled body —
 * aiming a pointer at a dashed line is harder than at a footprint.
 */
const ROUTE_PICK_TOLERANCE_PX = 8;

export function pickUtilityRoute(
  store: SitePlannerStore,
  viewport: PlanViewport,
  planPoint: Vector2
): UtilityRoute | undefined {
  const toleranceMeters = ROUTE_PICK_TOLERANCE_PX / viewport.pixelsPerMeter;
  const { utilityRoutes } = store;

  for (let index = utilityRoutes.length - 1; index >= 0; index -= 1) {
    if (hitTestUtilityRoute(utilityRoutes[index], planPoint, toleranceMeters)) {
      return utilityRoutes[index];
    }
  }

  return undefined;
}

/**
 * Later terms are painted over earlier ones, so they are picked first. Only
 * leaves answer a click: a group is a fold rather than an outline, and it is
 * picked from the structure panel instead.
 */
function pickFromTerms(
  terms: readonly CsgTerm[],
  planPoint: Vector2,
  toleranceMeters: Meters
): Shape | undefined {
  for (let index = terms.length - 1; index >= 0; index -= 1) {
    const picked = pickFromOperand(terms[index].operand, planPoint, toleranceMeters);

    if (!isNil(picked)) {
      return picked;
    }
  }

  return undefined;
}

function pickFromOperand(
  operand: CsgOperand,
  planPoint: Vector2,
  toleranceMeters: Meters
): Shape | undefined {
  switch (operand.kind) {
    case 'group':
      return pickFromTerms(operand.terms, planPoint, toleranceMeters);
    case 'rectangle':
    case 'circle':
    case 'ellipse':
      return hitTestShape(operand, planPoint, toleranceMeters) ? operand : undefined;
    default:
      return assertNever(operand);
  }
}

/** The catalogue's kinds only — what the placing tool may pick back up. */
export function pickPlacedInstance(
  store: SitePlannerStore,
  viewport: PlanViewport,
  planPoint: Vector2
): SiteObjectState | undefined {
  const car = pickCar(store, viewport, planPoint);

  if (!isNil(car)) {
    return { kind: 'car', car };
  }

  const tree = pickTree(store, viewport, planPoint);

  return isNil(tree) ? undefined : { kind: 'tree', tree };
}

/** The building whose footprint stands under the pointer, topmost first. */
function pickBuilding(
  store: SitePlannerStore,
  viewport: PlanViewport,
  planPoint: Vector2
): Building | undefined {
  const picked = pickShape(store, viewport, planPoint);

  if (isNil(picked) || picked.owner === 'boundary') {
    return undefined;
  }

  const owner = picked.owner;

  return store.buildings.find(candidate => candidate.id === owner);
}

/**
 * The topmost view-mode object under the pointer, kinds in their stacking
 * order: the placed objects standing on everything, then a building's
 * footprint, then a trench (a hairline over the ribbons), then the paving of a
 * path.
 */
export function pickSiteObject(
  store: SitePlannerStore,
  viewport: PlanViewport,
  planPoint: Vector2
): SiteObjectState | undefined {
  const placed = pickPlacedInstance(store, viewport, planPoint);

  if (!isNil(placed)) {
    return placed;
  }

  const building = pickBuilding(store, viewport, planPoint);

  if (!isNil(building)) {
    return { kind: 'building', building };
  }

  const route = pickUtilityRoute(store, viewport, planPoint);

  if (!isNil(route)) {
    return { kind: 'utilityRoute', route };
  }

  const path = pickPath(store, viewport, planPoint);

  return isNil(path) ? undefined : { kind: 'path', path };
}
