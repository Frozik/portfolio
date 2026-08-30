import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';

import type { UtilityRoute } from './routing';
import type { Selection } from './selection';
import { flattenShapes } from './shapes';
import type { Building, CarInstance, SitePath, TreeInstance } from './site-plan';
import { translateBuilding } from './site-plan-edits';

/**
 * One object of the plan as view mode holds it — the whole building, the whole
 * path — with its data captured at the moment a gesture takes hold. The union
 * is what unifies the view-mode manipulation of every object kind: one pick,
 * one drag, one restore, written once against this type (see `modes.md`,
 * «Objects»).
 */
export type SiteObjectState =
  | { readonly kind: 'building'; readonly building: Building }
  | { readonly kind: 'tree'; readonly tree: TreeInstance }
  | { readonly kind: 'car'; readonly car: CarInstance }
  | { readonly kind: 'path'; readonly path: SitePath }
  | { readonly kind: 'utilityRoute'; readonly route: UtilityRoute };

export type SiteObjectKind = SiteObjectState['kind'];

/**
 * What view mode lets each kind of object do — the object-level sibling of
 * `allowedPlanTools`. The interaction code consults this table instead of
 * knowing kinds by name, so a new object kind is a new row here, not a new
 * special case in the controller.
 */
export interface SiteObjectTraits {
  /** Whether view mode slides the whole object under the pointer. */
  readonly isMovable: boolean;
  /** Whether the object opens a deep editor (see `editorDoorFor`). */
  readonly hasEditor: boolean;
}

export const SITE_OBJECT_TRAITS: Readonly<Record<SiteObjectKind, SiteObjectTraits>> = {
  building: { isMovable: true, hasEditor: true },
  tree: { isMovable: true, hasEditor: false },
  car: { isMovable: true, hasEditor: false },
  path: { isMovable: true, hasEditor: true },
  utilityRoute: { isMovable: true, hasEditor: true },
};

/**
 * The point a whole-object drag steers onto the grid. Every kind nominates one
 * of its own: a snapped reference moves the object by a whole grid step, which
 * keeps internal geometry — a building's shapes, a path's bends — rigid.
 * Nothing for a building with no shapes yet: it has no footprint to grab.
 */
export function siteObjectReference(object: SiteObjectState): Vector2 | undefined {
  switch (object.kind) {
    case 'building':
      return flattenShapes(object.building.composition)[0]?.center;
    case 'tree':
      return object.tree.position;
    case 'car':
      return object.car.position;
    case 'path':
      return object.path.points[0]?.position;
    case 'utilityRoute':
      return object.route.points[0];
    default:
      return assertNever(object);
  }
}

/** The same object moved rigidly by `offset`, whatever its kind. */
export function translateSiteObject(object: SiteObjectState, offset: Vector2): SiteObjectState {
  switch (object.kind) {
    case 'building':
      // The interior stands on the foundation, so the slab takes it along.
      return { kind: 'building', building: translateBuilding(object.building, offset) };
    case 'tree':
      return {
        kind: 'tree',
        tree: { ...object.tree, position: shift(object.tree.position, offset) },
      };
    case 'car':
      return { kind: 'car', car: { ...object.car, position: shift(object.car.position, offset) } };
    case 'path':
      return {
        kind: 'path',
        path: {
          ...object.path,
          points: object.path.points.map(point => ({
            ...point,
            position: shift(point.position, offset),
          })),
        },
      };
    case 'utilityRoute':
      return {
        kind: 'utilityRoute',
        route: {
          ...object.route,
          points: object.route.points.map(point => shift(point, offset)),
        },
      };
    default:
      return assertNever(object);
  }
}

/** The selection that names this object, for the click that takes hold of it. */
export function siteObjectSelection(object: SiteObjectState): Selection {
  switch (object.kind) {
    case 'building':
      return { kind: 'building', buildingId: object.building.id };
    case 'tree':
      return { kind: 'tree', treeId: object.tree.id };
    case 'car':
      return { kind: 'car', carId: object.car.id };
    case 'path':
      return { kind: 'path', pathId: object.path.id };
    case 'utilityRoute':
      return { kind: 'utilityRoute', routeId: object.route.id };
    default:
      return assertNever(object);
  }
}

function shift(point: Vector2, offset: Vector2): Vector2 {
  return { x: point.x + offset.x, y: point.y + offset.y };
}
