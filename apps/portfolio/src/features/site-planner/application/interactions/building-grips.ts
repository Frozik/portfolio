import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { BuildingId } from '../../domain/model/building';
import type { Selection } from '../../domain/model/selection';
import {
  draggedDevice,
  draggedDuct,
  draggedEntry,
  draggedFireplace,
  draggedFurniture,
  draggedOpening,
  draggedStair,
  draggedSupport,
} from './dragged-storey-objects';
import type { InteractionContext } from './editor-interaction';
import type { DraggedObject } from './object-drag-gestures';
import {
  pickDevice,
  pickEntry,
  pickFurniture,
  pickFurnitureGrip,
  pickHeating,
  pickOpening,
  pickStair,
  pickStairGrip,
  pickSupport,
} from './storey-object-picking';

/** What a press on a storey object takes hold of: the thing to select, and how it moves. */
interface Grab {
  readonly selection: Selection;
  readonly dragged: DraggedObject;
  readonly gesture: 'move' | 'rotate';
}

/** One kind's answer to a press: its pick, its selection and its drag, or nothing. */
export type BuildingGrip = (planPoint: Vector2) => Grab | undefined;

/**
 * The select tool's targets on a storey, in stacking order. Handles and small
 * things answer before bodies; the split around the walls is where the wall
 * point gestures take their turn — a wall's own corners outrank the objects
 * standing next to them but not the grips drawn over them.
 */
export interface BuildingGrips {
  readonly overWalls: readonly BuildingGrip[];
  readonly underWalls: readonly BuildingGrip[];
}

export function createBuildingGrips(
  context: InteractionContext,
  buildingId: BuildingId
): BuildingGrips {
  const { store } = context;
  const stairGrip: BuildingGrip = planPoint => {
    const stair = pickStairGrip(context, planPoint);

    return isNil(stair)
      ? undefined
      : {
          selection: { kind: 'stair', buildingId, stairId: stair.id },
          dragged: draggedStair(context, buildingId, stair),
          gesture: 'rotate',
        };
  };
  const heating: BuildingGrip = planPoint => {
    const picked = pickHeating(context, planPoint);

    if (isNil(picked)) {
      return undefined;
    }

    return picked.kind === 'fireplace'
      ? {
          selection: { kind: 'fireplace', buildingId, fireplaceId: picked.fireplace.id },
          dragged: draggedFireplace(context, buildingId, picked.fireplace),
          gesture: 'move',
        }
      : {
          selection: { kind: 'duct', buildingId, ductId: picked.duct.id },
          dragged: draggedDuct(context, buildingId, picked.duct),
          gesture: 'move',
        };
  };
  const furnitureGrip: BuildingGrip = planPoint => {
    const item = pickFurnitureGrip(context, planPoint);

    return isNil(item)
      ? undefined
      : {
          selection: { kind: 'furniture', buildingId, furnitureId: item.id },
          dragged: draggedFurniture(context, buildingId, item),
          gesture: 'rotate',
        };
  };
  const entry: BuildingGrip = planPoint => {
    const picked = pickEntry(context, buildingId, planPoint);
    const scene = store.scene.buildingScenes.find(
      candidate => candidate.building.id === buildingId
    );

    return isNil(picked) || isNil(scene)
      ? undefined
      : {
          selection: { kind: 'utilityEntry', buildingId, entryId: picked.entry.id },
          dragged: draggedEntry(context, buildingId, picked.entry, picked.position, scene.polygons),
          gesture: 'move',
        };
  };
  const device: BuildingGrip = planPoint => {
    const picked = pickDevice(context, buildingId, planPoint);

    if (isNil(picked)) {
      return undefined;
    }

    const symbol = store.storeys.editedStoreyScene?.devices.find(
      candidate => candidate.id === picked.id
    );

    return {
      selection: { kind: 'device', buildingId, deviceId: picked.id },
      dragged: draggedDevice(context, buildingId, picked, symbol?.position ?? planPoint),
      gesture: 'move',
    };
  };
  const opening: BuildingGrip = planPoint => {
    const picked = pickOpening(context, buildingId, planPoint);

    return isNil(picked)
      ? undefined
      : {
          selection: { kind: 'opening', buildingId, openingId: picked.opening.id },
          dragged: draggedOpening(context, buildingId, picked.opening, picked.wall),
          gesture: 'move',
        };
  };
  const support: BuildingGrip = planPoint => {
    const post = pickSupport(context, planPoint);

    return isNil(post)
      ? undefined
      : {
          selection: { kind: 'support', buildingId, supportId: post.id },
          dragged: draggedSupport(context, buildingId, post),
          gesture: 'move',
        };
  };
  const stair: BuildingGrip = planPoint => {
    const picked = pickStair(context, planPoint);

    return isNil(picked)
      ? undefined
      : {
          selection: { kind: 'stair', buildingId, stairId: picked.id },
          dragged: draggedStair(context, buildingId, picked),
          gesture: 'move',
        };
  };
  const furniture: BuildingGrip = planPoint => {
    const item = pickFurniture(context, buildingId, planPoint);

    return isNil(item)
      ? undefined
      : {
          selection: { kind: 'furniture', buildingId, furnitureId: item.id },
          dragged: draggedFurniture(context, buildingId, item),
          gesture: 'move',
        };
  };

  return {
    overWalls: [stairGrip, heating, furnitureGrip],
    underWalls: [entry, device, opening, support, stair, furniture],
  };
}
