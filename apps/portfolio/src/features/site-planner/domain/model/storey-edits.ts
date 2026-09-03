import { isNil } from 'lodash-es';
import type { Meters } from '../units';
import { replaceById } from './edit-collections';
import type { PitchedRoof } from './roofs';
import type { RoomLabel } from './rooms';
import type { Building, BuildingId } from './site-plan';
import { storeysOf } from './site-plan';
import type { StoreyObject, StoreyObjectKind } from './storey-objects';
import { STAIR_OBJECTS } from './storey-objects';
import type { RoofZoneLabel, RoofZoneLabelId, Storey, StoreyId } from './storeys';

/**
 * The building with its storeys materialized: the synthesized ground storey
 * becomes real data and the legacy per-building fields stop being written —
 * the lazy half of the storeys migration (`building-editor.md` §5).
 */
export function materializeStoreys(building: Building): Building {
  if (building.storeys !== undefined && building.storeys.length > 0) {
    return building;
  }

  return {
    ...building,
    storeys: storeysOf(building),
    walls: undefined,
    openings: undefined,
    roomLabels: undefined,
  };
}

export function mapStoreys(
  buildings: readonly Building[],
  buildingId: BuildingId,
  map: (storey: Storey) => Storey
): readonly Building[] {
  return replaceById(buildings, buildingId, building => {
    const materialized = materializeStoreys(building);

    return { ...materialized, storeys: storeysOf(materialized).map(map) };
  });
}

export function addStorey(
  buildings: readonly Building[],
  buildingId: BuildingId,
  storey: Storey
): readonly Building[] {
  return replaceById(buildings, buildingId, building => {
    const materialized = materializeStoreys(building);

    return { ...materialized, storeys: [...storeysOf(materialized), storey] };
  });
}

/**
 * Drops a storey; the ground one is refused — a building always stands on it.
 * Stairs of the storey below that climbed into the removed one go with it
 * (plan I2-2) — a stair's destination is gone, so is the stair.
 */
export function removeStorey(
  buildings: readonly Building[],
  buildingId: BuildingId,
  storeyId: StoreyId
): readonly Building[] {
  return replaceById(buildings, buildingId, building => {
    const storeys = storeysOf(building);
    const removedLevel = storeys.findIndex(storey => storey.id === storeyId);

    if (storeys.length <= 1 || removedLevel <= 0) {
      return building;
    }

    const materialized = materializeStoreys(building);

    return {
      ...materialized,
      storeys: storeysOf(materialized)
        .filter(storey => storey.id !== storeyId)
        .map((storey, level) =>
          level === removedLevel - 1 && STAIR_OBJECTS.read(storey).length > 0
            ? STAIR_OBJECTS.write(storey, [])
            : storey
        ),
    };
  });
}

/**
 * The four edits every {@link StoreyObjectKind} answers. One implementation for
 * the whole family: a kind says how it is read and written, and these say what
 * an edit MEANS — which is the same thing for a stair, a slab and a shaft.
 */
export function addStoreyObject<TInstance extends StoreyObject>(
  buildings: readonly Building[],
  buildingId: BuildingId,
  storeyId: StoreyId,
  kind: StoreyObjectKind<TInstance>,
  item: NoInfer<TInstance>
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey =>
    storey.id === storeyId ? kind.write(storey, [...kind.read(storey), item]) : storey
  );
}

export function updateStoreyObject<TInstance extends StoreyObject>(
  buildings: readonly Building[],
  buildingId: BuildingId,
  kind: StoreyObjectKind<TInstance>,
  itemId: NoInfer<TInstance['id']>,
  changes: NoInfer<Partial<TInstance>>
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey =>
    kind.write(
      storey,
      kind.read(storey).map(item => (item.id === itemId ? { ...item, ...changes } : item))
    )
  );
}

export function removeStoreyObject<TInstance extends StoreyObject>(
  buildings: readonly Building[],
  buildingId: BuildingId,
  kind: StoreyObjectKind<TInstance>,
  itemId: NoInfer<TInstance['id']>
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey =>
    kind.write(
      storey,
      kind.read(storey).filter(item => item.id !== itemId)
    )
  );
}

export function findStoreyObject<TInstance extends StoreyObject>(
  buildings: readonly Building[],
  buildingId: BuildingId,
  kind: StoreyObjectKind<TInstance>,
  itemId: NoInfer<TInstance['id']>
): TInstance | undefined {
  const building = buildings.find(candidate => candidate.id === buildingId);

  return isNil(building)
    ? undefined
    : storeysOf(building)
        .flatMap(storey => kind.read(storey))
        .find(item => item.id === itemId);
}

/**
 * Crowns the building with a pitched roof, or takes it off — `undefined` is
 * the flat top the building had before, not an error.
 */
export function setPitchedRoof(
  buildings: readonly Building[],
  buildingId: BuildingId,
  pitchedRoof: PitchedRoof | undefined
): readonly Building[] {
  return buildings.map(building =>
    building.id === buildingId ? { ...building, pitchedRoof } : building
  );
}

/** Sets one storey's height; stair runs and 3D stacking re-derive from it. */
export function updateStoreyHeight(
  buildings: readonly Building[],
  buildingId: BuildingId,
  storeyId: StoreyId,
  heightMeters: Meters
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey =>
    storey.id === storeyId ? { ...storey, heightMeters } : storey
  );
}

/** Replaces the label by id, or adds it — the upsert a room-type assignment is. */
export function upsertRoomLabel(
  buildings: readonly Building[],
  buildingId: BuildingId,
  storeyId: StoreyId,
  label: RoomLabel
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => {
    if (storey.id !== storeyId) {
      return storey;
    }

    const exists = storey.roomLabels.some(existing => existing.id === label.id);

    return {
      ...storey,
      roomLabels: exists
        ? storey.roomLabels.map(existing => (existing.id === label.id ? label : existing))
        : [...storey.roomLabels, label],
    };
  });
}

export function removeRoomLabel(
  buildings: readonly Building[],
  buildingId: BuildingId,
  labelId: RoomLabel['id']
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    roomLabels: storey.roomLabels.filter(label => label.id !== labelId),
  }));
}

/** The roof-zone counterpart of {@link upsertRoomLabel}, on the storey's ceiling. */
export function upsertRoofZoneLabel(
  buildings: readonly Building[],
  buildingId: BuildingId,
  storeyId: StoreyId,
  label: RoofZoneLabel
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => {
    if (storey.id !== storeyId) {
      return storey;
    }

    const exists = storey.roofZoneLabels.some(existing => existing.id === label.id);

    return {
      ...storey,
      roofZoneLabels: exists
        ? storey.roofZoneLabels.map(existing => (existing.id === label.id ? label : existing))
        : [...storey.roofZoneLabels, label],
    };
  });
}

export function removeRoofZoneLabel(
  buildings: readonly Building[],
  buildingId: BuildingId,
  labelId: RoofZoneLabelId
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    roofZoneLabels: storey.roofZoneLabels.filter(label => label.id !== labelId),
  }));
}
