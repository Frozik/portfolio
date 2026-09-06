import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { distanceToPolyline } from '../../domain/geometry/hit-test-objects';
import type { RotatedBox } from '../../domain/geometry/hit-test-shape';
import { hitTestRotatedBox, hitTestShape } from '../../domain/geometry/hit-test-shape';
import { isPointOnStair } from '../../domain/geometry/stair-footprint';
import { projectOntoPolyline, wallCenterline } from '../../domain/geometry/wall-geometry';
import { findBuilding } from '../../domain/model/building-edits';
import type { VerticalDuct } from '../../domain/model/ducts';
import type { ElectricalDevice } from '../../domain/model/electrical';
import type { Fireplace } from '../../domain/model/fireplaces';
import { FIREPLACE_SPECS } from '../../domain/model/fireplaces';
import type { UtilityEntry } from '../../domain/model/foundation';
import type { FurnitureInstance } from '../../domain/model/furniture';
import { furnitureBox } from '../../domain/model/furniture';
import type { Opening } from '../../domain/model/openings';
import type { BuildingId } from '../../domain/model/site-plan';
import { entriesOf, storeysOf } from '../../domain/model/site-plan';
import type { Slab } from '../../domain/model/slabs';
import type { StairInstance } from '../../domain/model/stairs';
import type { Storey } from '../../domain/model/storeys';
import { devicesOf, furnitureOf } from '../../domain/model/storeys';
import type { SupportPost } from '../../domain/model/supports';
import type { Wall } from '../../domain/model/walls';
import { planToScreen } from '../../domain/view/plan-viewport';
import { computeFurnitureHandles } from '../render/plan-draw/draw-furniture';
import type { InteractionContext } from './editor-interaction';
import { findHandleAt, HANDLE_HIT_RADIUS_PX } from './plan-picking';

/** How far outside its body a wall still answers a click, in pixels. */
const WALL_PICK_TOLERANCE_PX = 6;
/** The grab radius around a device symbol, generous around the drawn glyph. */
const DEVICE_PICK_RADIUS_PX = 10;

/** The storey the editor is aimed at — the only one the canvas offers. */
export function activeStoreyOf(
  context: InteractionContext,
  buildingId: BuildingId
): Storey | undefined {
  const { store } = context;
  const building = store.buildings.find(candidate => candidate.id === buildingId);

  if (isNil(building)) {
    return undefined;
  }

  const storeys = storeysOf(building);

  return storeys.find(storey => storey.id === store.building.activeStoreyId) ?? storeys[0];
}

function toleranceMeters(context: InteractionContext, pixels: number): number {
  return pixels / context.getViewport().pixelsPerMeter;
}

/** The topmost wall whose body covers the point; later walls lie over earlier. */
export function pickWall(
  context: InteractionContext,
  buildingId: BuildingId,
  planPoint: Vector2
): Wall | undefined {
  const storey = activeStoreyOf(context, buildingId);

  if (isNil(storey)) {
    return undefined;
  }

  const tolerance = toleranceMeters(context, WALL_PICK_TOLERANCE_PX);
  const walls = storey.walls;

  for (let index = walls.length - 1; index >= 0; index -= 1) {
    const wall = walls[index];

    if (
      distanceToPolyline(wallCenterline(wall), planPoint) <=
      wall.thicknessMeters / 2 + tolerance
    ) {
      return wall;
    }
  }

  return undefined;
}

/**
 * An opening answers a click before the wall it pierces — the hosted thing
 * wins over its host, the way handles win over bodies.
 */
export function pickOpening(
  context: InteractionContext,
  buildingId: BuildingId,
  planPoint: Vector2
): { readonly opening: Opening; readonly wall: Wall } | undefined {
  const storey = activeStoreyOf(context, buildingId);

  if (isNil(storey)) {
    return undefined;
  }

  const tolerance = toleranceMeters(context, WALL_PICK_TOLERANCE_PX);
  const { walls, openings } = storey;

  for (let index = openings.length - 1; index >= 0; index -= 1) {
    const opening = openings[index];
    const wall = walls.find(candidate => candidate.id === opening.wallId);

    if (isNil(wall)) {
      continue;
    }

    const projection = projectOntoPolyline(wallCenterline(wall), planPoint);
    const isOnOpening =
      Math.abs(projection.offsetMeters - opening.offsetMeters) <= opening.widthMeters / 2 &&
      projection.distanceMeters <= wall.thicknessMeters / 2 + tolerance;

    if (isOnOpening) {
      return { opening, wall };
    }
  }

  return undefined;
}

/** The topmost device whose symbol area covers the point. */
export function pickDevice(
  context: InteractionContext,
  buildingId: BuildingId,
  planPoint: Vector2
): ElectricalDevice | undefined {
  const storey = activeStoreyOf(context, buildingId);
  const scene = context.store.building.editedStoreyScene;

  if (isNil(storey) || isNil(scene)) {
    return undefined;
  }

  const radius = toleranceMeters(context, DEVICE_PICK_RADIUS_PX);
  const devices = devicesOf(storey);

  for (let index = devices.length - 1; index >= 0; index -= 1) {
    const device = devices[index];
    const symbol = scene.devices.find(candidate => candidate.id === device.id);

    if (
      !isNil(symbol) &&
      Math.hypot(symbol.position.x - planPoint.x, symbol.position.y - planPoint.y) <= radius
    ) {
      return device;
    }
  }

  return undefined;
}

/** A utility entry badge riding the footprint outline, or sitting on the floor. */
export function pickEntry(
  context: InteractionContext,
  buildingId: BuildingId,
  planPoint: Vector2
): { readonly entry: UtilityEntry; readonly position: Vector2 } | undefined {
  const { store } = context;
  const scene = store.scene.buildingScenes.find(candidate => candidate.building.id === buildingId);

  if (isNil(scene)) {
    return undefined;
  }

  const radius = toleranceMeters(context, DEVICE_PICK_RADIUS_PX);
  const picked = scene.entryPoints.find(
    candidate =>
      Math.hypot(candidate.position.x - planPoint.x, candidate.position.y - planPoint.y) <= radius
  );

  if (isNil(picked)) {
    return undefined;
  }

  const building = findBuilding(store.buildings, buildingId);
  const entry = isNil(building)
    ? undefined
    : entriesOf(building).find(candidate => candidate.id === picked.id);

  return isNil(entry) ? undefined : { entry, position: picked.position };
}

/** The body of a fireplace as a box, for picking it off the plan. */
function fireplaceBox(fireplace: Fireplace): RotatedBox {
  const spec = FIREPLACE_SPECS[fireplace.kind];

  return {
    center: fireplace.position,
    rotationDegrees: fireplace.rotationDegrees,
    extentX: spec.widthMeters,
    extentY: spec.depthMeters,
  };
}

/**
 * A fireplace or a shaft. Both are small and both are drawn over whatever room
 * they stand in, so they answer before the walls do; a shaft only answers on
 * the storey it STARTS on — the section of it crossing an upper floor is a
 * hole, not a handle — and a flue belongs to its fireplace.
 */
export function pickHeating(
  context: InteractionContext,
  planPoint: Vector2
):
  | { readonly kind: 'fireplace'; readonly fireplace: Fireplace }
  | { readonly kind: 'duct'; readonly duct: VerticalDuct }
  | undefined {
  const scene = context.store.building.editedStoreyScene;

  if (isNil(scene)) {
    return undefined;
  }

  const tolerance = toleranceMeters(context, HANDLE_HIT_RADIUS_PX);

  for (const section of scene.ducts) {
    if (!section.startsHere || !isPointOnStair([section.footprint], planPoint, tolerance)) {
      continue;
    }

    const owner = scene.fireplaces.find(
      candidate => candidate.fireplace.id === section.fireplaceId
    );

    return isNil(owner)
      ? { kind: 'duct', duct: section.duct }
      : { kind: 'fireplace', fireplace: owner.fireplace };
  }

  for (const fireplaceScene of scene.fireplaces) {
    if (hitTestRotatedBox(fireplaceBox(fireplaceScene.fireplace), planPoint, tolerance)) {
      return { kind: 'fireplace', fireplace: fireplaceScene.fireplace };
    }
  }

  return undefined;
}

/** A post: a small target, so it is picked before the stairs. */
export function pickSupport(
  context: InteractionContext,
  planPoint: Vector2
): SupportPost | undefined {
  const scene = context.store.building.editedStoreyScene;

  if (isNil(scene)) {
    return undefined;
  }

  const tolerance = toleranceMeters(context, HANDLE_HIT_RADIUS_PX);

  for (let index = scene.supports.length - 1; index >= 0; index -= 1) {
    const supportScene = scene.supports[index];

    if (isPointOnStair([supportScene.footprint], planPoint, tolerance)) {
      return supportScene.post;
    }
  }

  return undefined;
}

/** A stair's body: the same grab as a sofa's. */
export function pickStair(
  context: InteractionContext,
  planPoint: Vector2
): StairInstance | undefined {
  const scene = context.store.building.editedStoreyScene;

  if (isNil(scene)) {
    return undefined;
  }

  const tolerance = toleranceMeters(context, WALL_PICK_TOLERANCE_PX);

  for (let index = scene.stairs.length - 1; index >= 0; index -= 1) {
    const stairScene = scene.stairs[index];

    if (isPointOnStair(stairScene.footprint, planPoint, tolerance)) {
      return stairScene.stair;
    }
  }

  return undefined;
}

/** The turn grip of the selected stair — furniture's grip, same distance. */
export function pickStairGrip(
  context: InteractionContext,
  planPoint: Vector2
): StairInstance | undefined {
  const { store } = context;
  const selection = store.selection;
  const scene = store.building.editedStoreyScene;

  if (selection?.kind !== 'stair' || isNil(scene)) {
    return undefined;
  }

  const stairScene = scene.stairs.find(candidate => candidate.stair.id === selection.stairId);

  if (isNil(stairScene)) {
    return undefined;
  }

  const { rotationGrip } = stairScene;
  const tolerance = toleranceMeters(context, HANDLE_HIT_RADIUS_PX);

  return Math.hypot(planPoint.x - rotationGrip.x, planPoint.y - rotationGrip.y) <= tolerance
    ? stairScene.stair
    : undefined;
}

/** The piece under the pointer, topmost first. */
export function pickFurniture(
  context: InteractionContext,
  buildingId: BuildingId,
  planPoint: Vector2
): FurnitureInstance | undefined {
  const storey = activeStoreyOf(context, buildingId);

  if (isNil(storey)) {
    return undefined;
  }

  const tolerance = toleranceMeters(context, WALL_PICK_TOLERANCE_PX);
  const furniture = furnitureOf(storey);

  for (let index = furniture.length - 1; index >= 0; index -= 1) {
    const item = furniture[index];
    const box = furnitureBox(item);

    if (!isNil(box) && hitTestRotatedBox(box, planPoint, tolerance)) {
      return item;
    }
  }

  return undefined;
}

/** The grip ahead of the selected piece turns it, the way a car's does. */
export function pickFurnitureGrip(
  context: InteractionContext,
  planPoint: Vector2
): FurnitureInstance | undefined {
  const { store, getViewport } = context;
  const furniture = store.storeyObjects.selectedFurniture;

  if (isNil(furniture)) {
    return undefined;
  }

  const viewport = getViewport();
  const handle = findHandleAt(
    computeFurnitureHandles(furniture, viewport),
    planToScreen(viewport, planPoint)
  );

  return isNil(handle) ? undefined : furniture;
}

/** The slab under the pointer — the floor itself, answering last. */
export function pickSlab(context: InteractionContext, planPoint: Vector2): Slab | undefined {
  const slabs = context.store.storeyObjects.activeStoreySlabs;
  const tolerance = toleranceMeters(context, WALL_PICK_TOLERANCE_PX);

  for (let index = slabs.length - 1; index >= 0; index -= 1) {
    const slab = slabs[index];

    if (hitTestShape(slab, planPoint, tolerance)) {
      return slab;
    }
  }

  return undefined;
}
