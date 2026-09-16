import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp, isNil } from 'lodash-es';

import type { MultiPolygon } from '@frozik/utils/geometry/polygonTypes';
import { offsetAlongOutline, pointOnOutline } from '../../domain/geometry/building-outline';
import { magnetizeFurnitureToWall } from '../../domain/geometry/furniture-magnetism';
import { clampPointToMultiPolygon } from '../../domain/geometry/polygon-booleans';
import {
  pointAlongPolyline,
  polylineLength,
  projectOntoPolyline,
  wallCenterline,
} from '../../domain/geometry/wall-geometry';
import type { BuildingId } from '../../domain/model/building';
import type { VerticalDuct } from '../../domain/model/ducts';
import type { ElectricalDevice } from '../../domain/model/electrical';
import type { Fireplace } from '../../domain/model/fireplaces';
import type { UtilityEntry } from '../../domain/model/foundation';
import { canEnterThroughFloor } from '../../domain/model/foundation';
import type { FurnitureInstance } from '../../domain/model/furniture';
import { findFurnitureEntry } from '../../domain/model/furniture';
import { installationPreset, installationWidthMeters } from '../../domain/model/installation';
import type { Opening } from '../../domain/model/openings';
import type { StairInstance } from '../../domain/model/stairs';
import type { SupportPost } from '../../domain/model/supports';
import type { Wall } from '../../domain/model/walls';
import type { WiringRoute } from '../../domain/model/wiring-routes';
import { translateWiringRoute } from '../../domain/model/wiring-routes';
import type { Meters } from '../../domain/units';
import { normalizeTurnDegrees } from '../../domain/units';
import type { PlanModifiers } from '../../domain/view/plan-input';
import type { SitePlannerStore } from '../SitePlannerStore';
import type { WiringModel } from '../WiringModel';
import type { InteractionContext } from './editor-interaction';
import { gridStep, snapPointToGrid } from './grid-snapping';
import type { DraggedObject } from './object-drag-gestures';
import { activeStoreyOf } from './storey-object-picking';

/** How near a wall face pulls a dragged piece flush against it, in metres. */
const FURNITURE_MAGNET_RADIUS_METERS = 0.5;
/** Дальше этого от контура утащенный ввод уходит в плиту, ближе — липнет к краю. */
const ENTRY_OUTLINE_STICK_RADIUS_PX = 14;

/** Snapping ALONG a wall: the same grid step, applied to one dimension. */
function snapAlong(
  store: SitePlannerStore,
  offsetMeters: Meters,
  modifiers: PlanModifiers
): Meters {
  const step = gridStep(store, modifiers);

  return step > 0 ? Math.round(offsetMeters / step) * step : offsetMeters;
}

/**
 * An opening does not roam: however the pointer moves, it slides ALONG its
 * host wall and keeps its whole width on it.
 */
export function draggedOpening(
  context: InteractionContext,
  buildingId: BuildingId,
  opening: Opening,
  wall: Wall
): DraggedObject {
  const { store } = context;
  const centerline = wallCenterline(wall);

  return {
    origin: pointAlongPolyline(centerline, opening.offsetMeters) ?? { x: 0, y: 0 },
    moveTo: (draggedPoint, modifiers) => {
      const projection = projectOntoPolyline(centerline, draggedPoint);
      const halfWidth = opening.widthMeters / 2;
      const total = polylineLength(centerline);
      const snapped = snapAlong(store, projection.offsetMeters, modifiers);

      store.openings.moveOpening(
        buildingId,
        opening.id,
        clamp(snapped, halfWidth, Math.max(halfWidth, total - halfWidth))
      );
    },
    restore: () => store.openings.moveOpening(buildingId, opening.id, opening.offsetMeters),
  };
}

/** A wall device slides along its host; a ceiling light roams the grid. */
export function draggedDevice(
  context: InteractionContext,
  buildingId: BuildingId,
  device: ElectricalDevice,
  origin: Vector2
): DraggedObject {
  const { store } = context;
  const wall =
    device.host.kind === 'wall'
      ? activeStoreyOf(context, buildingId)?.walls.find(candidate =>
          device.host.kind === 'wall' ? candidate.id === device.host.wallId : false
        )
      : undefined;

  return {
    origin,
    moveTo: (draggedPoint, modifiers) => {
      if (device.host.kind === 'wall' && !isNil(wall)) {
        const centerline = wallCenterline(wall);
        const projection = projectOntoPolyline(centerline, draggedPoint);

        store.electrics.moveDevice(buildingId, device.id, {
          host: {
            ...device.host,
            offsetMeters: clamp(
              snapAlong(store, projection.offsetMeters, modifiers),
              0,
              polylineLength(centerline)
            ),
          },
        });

        return;
      }

      if (device.host.kind === 'ceiling') {
        store.electrics.moveDevice(buildingId, device.id, {
          host: { kind: 'ceiling', position: snapPointToGrid(store, draggedPoint, modifiers) },
        });
      }
    },
    restore: () => store.electrics.moveDevice(buildingId, device.id, { host: device.host }),
  };
}

/**
 * The drag decides an entry's placement: near the outline the badge rides it
 * (and gas may ride nothing else — СП 62); carried into the footprint it becomes
 * a sleeve through the slab, clamped to stay inside.
 */
export function draggedEntry(
  context: InteractionContext,
  buildingId: BuildingId,
  entry: UtilityEntry,
  origin: Vector2,
  outline: MultiPolygon
): DraggedObject {
  const { store } = context;

  return {
    origin,
    moveTo: (draggedPoint, modifiers) => {
      const offset = offsetAlongOutline(outline, draggedPoint);

      if (isNil(offset)) {
        return;
      }

      const onOutline = pointOnOutline(outline, offset);
      const stickRadiusMeters =
        ENTRY_OUTLINE_STICK_RADIUS_PX / context.getViewport().pixelsPerMeter;
      const sticksToOutline =
        !canEnterThroughFloor(entry.system) ||
        isNil(onOutline) ||
        Math.hypot(draggedPoint.x - onOutline.x, draggedPoint.y - onOutline.y) <= stickRadiusMeters;

      if (sticksToOutline) {
        store.utilities.moveUtilityEntry(buildingId, entry.id, snapAlong(store, offset, modifiers));
      } else {
        store.utilities.moveEntryToFloor(
          buildingId,
          entry.id,
          clampPointToMultiPolygon(outline, snapPointToGrid(store, draggedPoint, modifiers))
        );
      }
    },
    restore: () =>
      isNil(entry.floorPosition)
        ? store.utilities.moveUtilityEntry(buildingId, entry.id, entry.outlineOffsetMeters)
        : store.utilities.moveEntryToFloor(buildingId, entry.id, entry.floorPosition),
  };
}

/** A fireplace slides and turns; its flue follows, because the flue derives. */
export function draggedFireplace(
  context: InteractionContext,
  buildingId: BuildingId,
  fireplace: Fireplace
): DraggedObject {
  const { store } = context;

  return {
    origin: fireplace.position,
    moveTo: (draggedPoint, modifiers) =>
      store.ducts.moveFireplace(buildingId, fireplace.id, {
        position: snapPointToGrid(store, draggedPoint, modifiers),
      }),
    turnTo: rotationDegrees =>
      store.ducts.moveFireplace(buildingId, fireplace.id, { rotationDegrees }),
    restore: () =>
      store.ducts.moveFireplace(buildingId, fireplace.id, {
        position: fireplace.position,
        rotationDegrees: fireplace.rotationDegrees,
      }),
  };
}

/** A shaft only ever slides: it has no facing to turn. */
export function draggedDuct(
  context: InteractionContext,
  buildingId: BuildingId,
  duct: VerticalDuct
): DraggedObject {
  const { store } = context;

  return {
    origin: duct.position,
    moveTo: (draggedPoint, modifiers) =>
      store.ducts.moveDuct(buildingId, duct.id, {
        position: snapPointToGrid(store, draggedPoint, modifiers),
      }),
    restore: () => store.ducts.moveDuct(buildingId, duct.id, { position: duct.position }),
  };
}

/** A post only ever slides: it has no facing to turn and no hand to mirror. */
export function draggedSupport(
  context: InteractionContext,
  buildingId: BuildingId,
  post: SupportPost
): DraggedObject {
  const { store } = context;

  return {
    origin: post.position,
    moveTo: (draggedPoint, modifiers) =>
      store.storeyObjects.moveSupport(buildingId, post.id, {
        position: snapPointToGrid(store, draggedPoint, modifiers),
      }),
    restore: () =>
      store.storeyObjects.moveSupport(buildingId, post.id, { position: post.position }),
  };
}

/**
 * A route slides whole by its first bend, on the grid — and beside a
 * neighbouring route whenever any of its bends comes within the magnet's
 * reach: the whole run shifts by that one catch, so it lands parallel and
 * touching the way it was drawn. Alt suspends both, as everywhere.
 */
export function draggedWiringRoute(
  context: InteractionContext,
  buildingId: BuildingId,
  route: WiringRoute
): DraggedObject {
  const { store } = context;
  const { wiring } = store.electrics;
  const origin = route.points[0];

  return {
    origin,
    moveTo: (draggedPoint, modifiers) => {
      const landed = snapPointToGrid(store, draggedPoint, modifiers);
      const shifted = translateWiringRoute(route, {
        x: landed.x - origin.x,
        y: landed.y - origin.y,
      });

      wiring.updateRoute(buildingId, magnetizeRouteBesideOthers(wiring, shifted));
    },
    restore: () => wiring.updateRoute(buildingId, route),
  };
}

/** The route shifted by the nearest catch any of its bends makes on another route. */
function magnetizeRouteBesideOthers(wiring: WiringModel, route: WiringRoute): WiringRoute {
  let best: { readonly delta: Vector2; readonly distance: number } | undefined;

  route.points.forEach((point, index) => {
    const segment = route.segments[Math.min(index, route.segments.length - 1)];
    const beside = wiring.besideRoutes(
      point,
      installationWidthMeters(installationPreset(segment.installation)),
      route.id
    );

    if (isNil(beside)) {
      return;
    }

    const delta = { x: beside.x - point.x, y: beside.y - point.y };
    const distance = Math.hypot(delta.x, delta.y);

    if (isNil(best) || distance < best.distance) {
      best = { delta, distance };
    }
  });

  return isNil(best) ? route : translateWiringRoute(route, best.delta);
}

/** A stair is an object like any other (R26): it moves and it turns. */
export function draggedStair(
  context: InteractionContext,
  buildingId: BuildingId,
  stair: StairInstance
): DraggedObject {
  const { store } = context;

  return {
    origin: stair.position,
    startRotationDegrees: stair.rotationDegrees,
    moveTo: (draggedPoint, modifiers) =>
      store.stairs.moveStair(buildingId, stair.id, {
        position: snapPointToGrid(store, draggedPoint, modifiers),
      }),
    turnTo: rotationDegrees => store.stairs.moveStair(buildingId, stair.id, { rotationDegrees }),
    restore: () =>
      store.stairs.moveStair(buildingId, stair.id, {
        position: stair.position,
        rotationDegrees: stair.rotationDegrees,
      }),
  };
}

/**
 * Moving snaps to the grid until a wall catches the piece — the Sweet Home
 * 3D magnet turns its back flush against the face; Alt suspends both.
 * Turning snaps the heading the way every other turn on the plan does.
 */
export function draggedFurniture(
  context: InteractionContext,
  buildingId: BuildingId,
  item: FurnitureInstance
): DraggedObject {
  const { store } = context;

  return {
    origin: item.position,
    startRotationDegrees: item.rotationDegrees,
    moveTo: (draggedPoint, modifiers) => {
      const storey = activeStoreyOf(context, buildingId);
      const entry = findFurnitureEntry(item.catalogId);
      const magnetized =
        modifiers.isAltPressed ||
        isNil(storey) ||
        isNil(entry) ||
        !store.layers.isLayerVisible('walls')
          ? undefined
          : magnetizeFurnitureToWall({
              position: draggedPoint,
              depthMeters: entry.depthMeters,
              walls: storey.walls,
              thresholdMeters: FURNITURE_MAGNET_RADIUS_METERS,
            });

      store.furniture.moveFurniture(
        buildingId,
        item.id,
        isNil(magnetized)
          ? {
              position: snapPointToGrid(store, draggedPoint, modifiers),
              rotationDegrees: item.rotationDegrees,
            }
          : {
              position: magnetized.position,
              rotationDegrees: normalizeTurnDegrees(magnetized.rotationDegrees),
            }
      );
    },
    turnTo: rotationDegrees =>
      store.furniture.moveFurniture(buildingId, item.id, { rotationDegrees }),
    restore: () =>
      store.furniture.moveFurniture(buildingId, item.id, {
        position: item.position,
        rotationDegrees: item.rotationDegrees,
      }),
  };
}
