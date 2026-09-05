import { assert } from '@frozik/utils/assert/assert';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { moveShape } from '../geometry/transform-shape';
import { removeDevice } from './device-edits';
import { createDuctId } from './ducts';
import type { DeviceId } from './electrical';
import { createDeviceId } from './electrical';
import { createFireplaceId } from './fireplaces';
import { createFurnitureId } from './furniture';
import type { Selection } from './selection';
import { createShapeId } from './shapes';
import type { Building, BuildingId } from './site-plan';
import { createStairId } from './stairs';
import { addStoreyObject, findStoreyObject, removeStoreyObject } from './storey-edits';
import type { StoreyObject, StoreyObjectKey, StoreyObjectKind } from './storey-objects';
import {
  DEVICE_OBJECTS,
  DUCT_OBJECTS,
  FIREPLACE_OBJECTS,
  FURNITURE_OBJECTS,
  SLAB_OBJECTS,
  STAIR_OBJECTS,
  SUPPORT_OBJECTS,
} from './storey-objects';
import type { StoreyId } from './storeys';
import { createSupportId } from './supports';

/**
 * The bridge between a selection and the object it names — the one place that
 * knows a `{ kind: 'stair', stairId }` selection is a {@link STAIR_OBJECTS}
 * instance. Deleting and duplicating read this table instead of switching over
 * the selection's kind, so a new kind of storey object is one row here rather
 * than a `case` in every consumer.
 *
 * Each row closes over its own concrete instance type when it is defined, and
 * exposes only what every row exposes. That is deliberate: a table of rows with
 * DIFFERENT type parameters cannot be walked generically in TypeScript, and the
 * alternative — casting the family back together at every call site — is how
 * the switches got written in the first place.
 */
export interface StoreyObjectSelector {
  readonly key: StoreyObjectKey;
  /** The id this selection names, or nothing when it names something else. */
  readonly idOf: (selection: Selection) => string | undefined;
  readonly buildingOf: (selection: Selection) => BuildingId | undefined;
  readonly remove: (
    buildings: readonly Building[],
    buildingId: BuildingId,
    id: string
  ) => readonly Building[];
  /**
   * The object copied a step away, or nothing when this kind cannot be copied
   * blindly — a device hangs on a host, so an offset would tear it off its wall.
   */
  readonly duplicate:
    | ((input: {
        readonly buildings: readonly Building[];
        readonly buildingId: BuildingId;
        readonly storeyId: StoreyId;
        readonly id: string;
        readonly offset: Vector2;
      }) => DuplicatedStoreyObject | undefined)
    | undefined;
}

interface DuplicatedStoreyObject {
  readonly buildings: readonly Building[];
  readonly selection: Selection;
}

function defineSelector<TInstance extends StoreyObject>({
  objects,
  idOf,
  buildingOf,
  select,
  translate,
  mintId,
  remove = (buildings, buildingId, id) => removeStoreyObject(buildings, buildingId, objects, id),
}: {
  readonly objects: StoreyObjectKind<TInstance>;
  readonly idOf: (selection: Selection) => TInstance['id'] | undefined;
  readonly buildingOf: (selection: Selection) => BuildingId | undefined;
  readonly select: (buildingId: BuildingId, id: TInstance['id']) => Selection;
  /** How this kind moves; absent means it cannot be copied by an offset. */
  readonly translate?: (item: TInstance, offset: Vector2) => TInstance;
  readonly mintId: () => TInstance['id'];
  /**
   * How this kind LEAVES a storey. The generic edit is the default; a device
   * overrides it, because unplugging one is part of removing it.
   */
  readonly remove?: (
    buildings: readonly Building[],
    buildingId: BuildingId,
    id: string
  ) => readonly Building[];
}): StoreyObjectSelector {
  return {
    key: objects.key,
    idOf,
    buildingOf,
    remove,
    duplicate: isNil(translate)
      ? undefined
      : ({ buildings, buildingId, storeyId, id, offset }) => {
          const original = findStoreyObject(buildings, buildingId, objects, id);

          if (isNil(original)) {
            return undefined;
          }

          const copy = { ...translate(original, offset), id: mintId() };

          return {
            buildings: addStoreyObject(buildings, buildingId, storeyId, objects, copy),
            selection: select(buildingId, copy.id),
          };
        },
  };
}

/** Whatever carries a plain plan position moves by adding the offset to it. */
function shift<TInstance extends { readonly position: Vector2 }>(
  item: TInstance,
  offset: Vector2
): TInstance {
  return { ...item, position: { x: item.position.x + offset.x, y: item.position.y + offset.y } };
}

export const STOREY_OBJECT_SELECTORS: readonly StoreyObjectSelector[] = [
  defineSelector({
    objects: FURNITURE_OBJECTS,
    idOf: selection => (selection.kind === 'furniture' ? selection.furnitureId : undefined),
    buildingOf: selection => (selection.kind === 'furniture' ? selection.buildingId : undefined),
    select: (buildingId, furnitureId) => ({ kind: 'furniture', buildingId, furnitureId }),
    translate: shift,
    mintId: createFurnitureId,
  }),
  defineSelector({
    objects: STAIR_OBJECTS,
    idOf: selection => (selection.kind === 'stair' ? selection.stairId : undefined),
    buildingOf: selection => (selection.kind === 'stair' ? selection.buildingId : undefined),
    select: (buildingId, stairId) => ({ kind: 'stair', buildingId, stairId }),
    translate: shift,
    mintId: createStairId,
  }),
  defineSelector({
    objects: SUPPORT_OBJECTS,
    idOf: selection => (selection.kind === 'support' ? selection.supportId : undefined),
    buildingOf: selection => (selection.kind === 'support' ? selection.buildingId : undefined),
    select: (buildingId, supportId) => ({ kind: 'support', buildingId, supportId }),
    translate: shift,
    mintId: createSupportId,
  }),
  defineSelector({
    objects: SLAB_OBJECTS,
    idOf: selection => (selection.kind === 'slab' ? selection.slabId : undefined),
    buildingOf: selection => (selection.kind === 'slab' ? selection.buildingId : undefined),
    select: (buildingId, slabId) => ({ kind: 'slab', buildingId, slabId }),
    // A slab is a shape: its position is its centre, so it moves as a shape does.
    translate: (slab, offset) =>
      moveShape(slab, { x: slab.center.x + offset.x, y: slab.center.y + offset.y }),
    mintId: createShapeId,
  }),
  defineSelector({
    objects: FIREPLACE_OBJECTS,
    idOf: selection => (selection.kind === 'fireplace' ? selection.fireplaceId : undefined),
    buildingOf: selection => (selection.kind === 'fireplace' ? selection.buildingId : undefined),
    select: (buildingId, fireplaceId) => ({ kind: 'fireplace', buildingId, fireplaceId }),
    translate: shift,
    mintId: createFireplaceId,
  }),
  defineSelector({
    objects: DUCT_OBJECTS,
    idOf: selection => (selection.kind === 'duct' ? selection.ductId : undefined),
    buildingOf: selection => (selection.kind === 'duct' ? selection.buildingId : undefined),
    select: (buildingId, ductId) => ({ kind: 'duct', buildingId, ductId }),
    translate: shift,
    mintId: createDuctId,
  }),
  defineSelector({
    objects: DEVICE_OBJECTS,
    idOf: selection => (selection.kind === 'device' ? selection.deviceId : undefined),
    buildingOf: selection => (selection.kind === 'device' ? selection.buildingId : undefined),
    select: (buildingId, deviceId) => ({ kind: 'device', buildingId, deviceId }),
    mintId: createDeviceId,
    // Removing a device unwires it: its group loses a consumer, a panel loses
    // its group, a switch loses the light it was linked to.
    remove: (buildings, buildingId, id) => removeDevice(buildings, buildingId, id as DeviceId),
  }),
];

/** The row one kind of object is described by, addressed by its key. */
export function storeyObjectSelector(key: StoreyObjectKey): StoreyObjectSelector {
  const selector = STOREY_OBJECT_SELECTORS.find(candidate => candidate.key === key);

  assert(!isNil(selector), `no storey-object selector for ${key}`);

  return selector;
}

/** What one selection names: the family it belongs to, and its id inside it. */
export interface SelectedStoreyObject {
  readonly selector: StoreyObjectSelector;
  readonly buildingId: BuildingId;
  readonly id: string;
}

export function selectedStoreyObject(
  selection: Selection | undefined
): SelectedStoreyObject | undefined {
  if (isNil(selection)) {
    return undefined;
  }

  for (const selector of STOREY_OBJECT_SELECTORS) {
    const id = selector.idOf(selection);
    const buildingId = selector.buildingOf(selection);

    if (!isNil(id) && !isNil(buildingId)) {
      return { selector, buildingId, id };
    }
  }

  return undefined;
}
