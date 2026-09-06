import { assertNever } from '@frozik/utils/assert/assertNever';
import type { BuildingId } from './building';
import type { DuctId } from './ducts';
import type { DeviceId } from './electrical';
import type { FireplaceId } from './fireplaces';
import type { UtilityEntryId } from './foundation';
import type { FurnitureId } from './furniture';
import type { OpeningId } from './openings';
import type { CarId, PathId, TreeId } from './plot-objects';
import type { UtilityRouteId } from './routing';
import type { ShapeId } from './shapes';
import type { MarkId } from './site-plan';

import type { StairId } from './stairs';
import type { SupportId } from './supports';
import type { WallId } from './walls';

/** Which composition a selected shape belongs to. */
/**
 * Which composition a shape belongs to: the plot itself, or one of the named
 * buildings — addressed by its id, so any number of structures fits without
 * the owner type growing again.
 */
export type ShapeOwner = 'boundary' | BuildingId;

/** What a pointer gesture on the plan means; `select` manipulates what already exists. */
export type PlanTool =
  | 'select'
  | 'pan'
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'elevation'
  | 'tree'
  | 'path'
  | 'utility'
  | 'measure';

/**
 * The tools that draw a new outline into the active group. They share one button
 * in the palette — the one that stands for whichever was armed last — so the list
 * is the order that button offers them in.
 */
export const SHAPE_TOOLS = ['rectangle', 'circle', 'ellipse'] as const;

export type ShapeTool = (typeof SHAPE_TOOLS)[number];

export const DEFAULT_SHAPE_TOOL: ShapeTool = 'rectangle';

export function isShapeTool(tool: PlanTool): tool is ShapeTool {
  return SHAPE_TOOLS.some(shapeTool => shapeTool === tool);
}

/**
 * The object the editor currently acts on; consumers hold `Selection | undefined`.
 * A group is selected from the structure panel alone — the canvas picks the leaf
 * under the pointer, so a group has no outline of its own to grab.
 */
export type Selection =
  | { readonly kind: 'shape'; readonly owner: ShapeOwner; readonly shapeId: ShapeId }
  | { readonly kind: 'group'; readonly owner: ShapeOwner; readonly groupId: ShapeId }
  | { readonly kind: 'mark'; readonly markId: MarkId }
  | { readonly kind: 'tree'; readonly treeId: TreeId }
  | { readonly kind: 'car'; readonly carId: CarId }
  | { readonly kind: 'building'; readonly buildingId: BuildingId }
  | { readonly kind: 'path'; readonly pathId: PathId }
  | { readonly kind: 'utilityRoute'; readonly routeId: UtilityRouteId }
  | {
      readonly kind: 'utilityEntry';
      readonly buildingId: BuildingId;
      readonly entryId: UtilityEntryId;
    }
  | { readonly kind: 'wall'; readonly buildingId: BuildingId; readonly wallId: WallId }
  | {
      readonly kind: 'opening';
      readonly buildingId: BuildingId;
      readonly openingId: OpeningId;
    }
  | {
      readonly kind: 'furniture';
      readonly buildingId: BuildingId;
      readonly furnitureId: FurnitureId;
    }
  | {
      readonly kind: 'stair';
      readonly buildingId: BuildingId;
      readonly stairId: StairId;
    }
  | {
      readonly kind: 'support';
      readonly buildingId: BuildingId;
      readonly supportId: SupportId;
    }
  | {
      readonly kind: 'fireplace';
      readonly buildingId: BuildingId;
      readonly fireplaceId: FireplaceId;
    }
  | {
      readonly kind: 'duct';
      readonly buildingId: BuildingId;
      readonly ductId: DuctId;
    }
  | {
      readonly kind: 'slab';
      readonly buildingId: BuildingId;
      readonly slabId: ShapeId;
    }
  | {
      readonly kind: 'device';
      readonly buildingId: BuildingId;
      readonly deviceId: DeviceId;
    };

/**
 * Where a newly drawn shape lands: a composition, and a group inside it or its
 * root. It is transient editor state, never part of the plan.
 */
export interface ActiveGroup {
  readonly owner: ShapeOwner;
  /** Nothing means the root term list of the owning composition. */
  readonly groupId: ShapeId | undefined;
}

/**
 * Where a selection can survive: `view` selections outlive the editor that
 * made them, `editor` ones belong to an open object and must go when it
 * closes — otherwise Delete in view mode reaches inside a building nobody can
 * see. A table rather than a list of `||`s so a new kind of object cannot be
 * forgotten here: the record stops compiling until it is classified.
 */
export const SELECTION_SCOPE: Readonly<Record<Selection['kind'], 'view' | 'editor'>> = {
  shape: 'editor',
  group: 'editor',
  mark: 'editor',
  wall: 'editor',
  opening: 'editor',
  utilityEntry: 'editor',
  furniture: 'editor',
  device: 'editor',
  stair: 'editor',
  support: 'editor',
  slab: 'editor',
  fireplace: 'editor',
  duct: 'editor',
  tree: 'view',
  car: 'view',
  path: 'view',
  building: 'view',
  utilityRoute: 'view',
};

/**
 * Whether two selections point at the same thing. Selections are plain data,
 * so «the same» is what the fields say — which is what lets Shift-click toggle
 * one out of a group without holding on to object identity.
 */
export function isSameSelection(left: Selection, right: Selection): boolean {
  return selectionKey(left) === selectionKey(right);
}

/**
 * A selection's identity as one string. Selections are plain data of two or
 * three primitive fields, so their identity IS their fields — spelling that
 * out beats comparing them structurally through a cast.
 */
function selectionKey(selection: Selection): string {
  switch (selection.kind) {
    case 'shape':
      return `shape:${selection.owner}:${selection.shapeId}`;
    case 'group':
      return `group:${selection.owner}:${selection.groupId}`;
    case 'mark':
      return `mark:${selection.markId}`;
    case 'tree':
      return `tree:${selection.treeId}`;
    case 'car':
      return `car:${selection.carId}`;
    case 'path':
      return `path:${selection.pathId}`;
    case 'utilityRoute':
      return `route:${selection.routeId}`;
    case 'utilityEntry':
      return `entry:${selection.buildingId}:${selection.entryId}`;
    case 'building':
      return `building:${selection.buildingId}`;
    case 'wall':
      return `wall:${selection.buildingId}:${selection.wallId}`;
    case 'opening':
      return `opening:${selection.buildingId}:${selection.openingId}`;
    case 'furniture':
      return `furniture:${selection.buildingId}:${selection.furnitureId}`;
    case 'device':
      return `device:${selection.buildingId}:${selection.deviceId}`;
    case 'stair':
      return `stair:${selection.buildingId}:${selection.stairId}`;
    case 'support':
      return `support:${selection.buildingId}:${selection.supportId}`;
    case 'slab':
      return `slab:${selection.buildingId}:${selection.slabId}`;
    case 'fireplace':
      return `fireplace:${selection.buildingId}:${selection.fireplaceId}`;
    case 'duct':
      return `duct:${selection.buildingId}:${selection.ductId}`;
    default:
      return assertNever(selection);
  }
}
