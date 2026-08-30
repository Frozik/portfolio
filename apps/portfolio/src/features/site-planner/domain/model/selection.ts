import type { DeviceId } from './electrical';
import type { FurnitureId } from './furniture';
import type { OpeningId } from './openings';
import type { UtilityRouteId } from './routing';
import type { ShapeId } from './shapes';
import type { BuildingId, CarId, MarkId, PathId, TreeId } from './site-plan';
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
export const SHAPE_TOOLS = ['rectangle', 'circle'] as const;

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
