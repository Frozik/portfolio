import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp, isNil } from 'lodash-es';
import { polylineLength, wallCenterline } from '../geometry/wall-geometry';
import type { Meters } from '../units';
import type { CircuitGroup, DeviceId, ElectricalDevice } from './electrical';
import { createCircuitGroup } from './electrical';
import type { Foundation, UtilityEntry, UtilityEntryId } from './foundation';
import type { FurnitureId, FurnitureInstance } from './furniture';
import type { Opening, OpeningId } from './openings';
import type { RoomLabel } from './rooms';
import type { UtilityRoute, UtilityRouteId } from './routing';
import { MIN_ROUTE_POINTS } from './routing';
import type { CsgOperation, CsgTerm, Shape, ShapeComposition, ShapeGroup, ShapeId } from './shapes';
import { findGroupTerm, findTerm, isShapeGroup, translateComposition } from './shapes';
import type {
  Building,
  BuildingId,
  CarId,
  CarInstance,
  ElevationMark,
  MarkId,
  PadElevationMode,
  PathId,
  PathPoint,
  PathSurface,
  SitePath,
  SiteSettings,
  TreeId,
  TreeInstance,
} from './site-plan';
import { entriesOf, foundationOf, normalizeSiteLocation, storeysOf } from './site-plan';
import type { RoofZoneLabel, RoofZoneLabelId, Storey, StoreyId } from './storeys';
import { devicesOf, furnitureOf, groupsOf, switchLinksOf } from './storeys';
import type { Wall, WallId } from './walls';
import { createWall, isWallClosed, MIN_CLOSED_WALL_POINTS, MIN_WALL_POINTS } from './walls';

/**
 * Pure `(section, arguments) => section` edits over the plan sections. An edit
 * addressing an unknown id is a no-op that returns the very same section
 * reference, so the `observable.ref` sections in the store stay untouched and
 * no derived computation is invalidated.
 */

/**
 * Appends a term to the addressed group, or to the root when no group is named.
 * Every other term edit finds its target by the operand's own id: ids are minted
 * per operand and unique across the whole tree, so a caller holding one never
 * has to carry the path down to it as well.
 */
export function addTerm(
  composition: ShapeComposition,
  term: CsgTerm,
  groupId?: ShapeId
): ShapeComposition {
  if (isNil(groupId)) {
    return { terms: [...composition.terms, term] };
  }

  return withTerms(
    composition,
    editOwningTerms(composition.terms, groupId, (terms, index) =>
      replaceGroupTerms(terms, index, groupTerms => [...groupTerms, term])
    )
  );
}

export function updateShape(composition: ShapeComposition, shape: Shape): ShapeComposition {
  return withTerms(
    composition,
    editOwningTerms(composition.terms, shape.id, (terms, index) =>
      replaceAt(terms, index, term => ({ ...term, operand: shape }))
    )
  );
}

export function setTermOperation(
  composition: ShapeComposition,
  operandId: ShapeId,
  operation: CsgOperation
): ShapeComposition {
  return withTerms(
    composition,
    editOwningTerms(composition.terms, operandId, (terms, index) =>
      replaceAt(terms, index, term => ({ ...term, operation }))
    )
  );
}

/** Moves a term within the term list that holds it; siblings elsewhere stay put. */
export function reorderTerm(
  composition: ShapeComposition,
  operandId: ShapeId,
  targetIndex: number
): ShapeComposition {
  return withTerms(
    composition,
    editOwningTerms(composition.terms, operandId, (terms, sourceIndex) => {
      const boundedIndex = clamp(targetIndex, 0, terms.length - 1);

      if (boundedIndex === sourceIndex) {
        return terms;
      }

      const next = [...terms];
      const [movedTerm] = next.splice(sourceIndex, 1);

      next.splice(boundedIndex, 0, movedTerm);

      return next;
    })
  );
}

/**
 * Takes the term out of the list that holds it and puts it into the addressed
 * group — the root of the composition when no group is named — at
 * `targetIndex`, counted over that group's terms as they stand before the move.
 * A group moved into itself or into one of its own descendants would take the
 * target out of the tree with it, so such a move is refused, as is one that
 * would leave the term exactly where it already stands.
 *
 * The term keeps the operation it joined its previous fold with, save at either
 * end of the move: a fold starts from nothing, so a leading subtraction would
 * fold the whole list away (`evaluate-composition.ts`). Whichever term ends up
 * first — the moved one, or the one it leaves behind — is therefore unioned.
 */
export function moveTerm(
  composition: ShapeComposition,
  operandId: ShapeId,
  targetGroupId: ShapeId | undefined,
  targetIndex: number
): ShapeComposition {
  const source = locateTerm(composition.terms, operandId, undefined);
  const targetTerms = resolveTargetTerms(composition, targetGroupId);

  if (isNil(source) || isNil(targetTerms) || entersOwnSubtree(source.term, targetGroupId)) {
    return composition;
  }

  const insertionIndex = resolveInsertionIndex({
    source,
    targetGroupId,
    targetTermCount: targetTerms.length,
    targetIndex,
  });

  if (isNil(insertionIndex)) {
    return composition;
  }

  return insertTerm({
    composition: detachTerm(composition, operandId),
    targetGroupId,
    index: insertionIndex,
    term: source.term,
  });
}

/** Drops the term; removing a group takes everything nested under it with it. */
export function removeTerm(composition: ShapeComposition, operandId: ShapeId): ShapeComposition {
  return withTerms(
    composition,
    editOwningTerms(composition.terms, operandId, (terms, index) =>
      terms.filter((_, candidateIndex) => candidateIndex !== index)
    )
  );
}

/**
 * Puts a term inside a group of its own, in its place. The group joins the
 * parent fold the way the term did, and the term becomes the group's first —
 * therefore unioned — member, so the plan draws exactly as it did before. The
 * identity of the group is given rather than minted here: the caller needs it to
 * point the selection at what it has just created, and an edit that reached no
 * term must not consume an id.
 */
export function wrapTermInGroup(
  composition: ShapeComposition,
  operandId: ShapeId,
  groupId: ShapeId
): ShapeComposition {
  return withTerms(
    composition,
    editOwningTerms(composition.terms, operandId, (terms, index) => {
      const { operand, operation } = terms[index];
      const group: ShapeGroup = {
        kind: 'group',
        id: groupId,
        terms: [{ operand, operation: 'union' }],
      };

      return replaceAt(terms, index, () => ({ operand: group, operation }));
    })
  );
}

/**
 * Inlines the terms of a group in its place. The group's own operation moves to
 * the first inlined term and the rest keep theirs, which is the only reading
 * that leaves a single-term group untouched — ungrouping a fold of several terms
 * can change the result, since a nested fold is not the same as a flat one.
 */
export function ungroupTerm(composition: ShapeComposition, groupId: ShapeId): ShapeComposition {
  return withTerms(
    composition,
    editOwningTerms(composition.terms, groupId, (terms, index) => {
      const { operand, operation } = terms[index];

      if (!isShapeGroup(operand)) {
        return terms;
      }

      const inlined = operand.terms.map((term, termIndex) =>
        termIndex === 0 ? { ...term, operation } : term
      );

      return [...terms.slice(0, index), ...inlined, ...terms.slice(index + 1)];
    })
  );
}

/** Everything about a building except the shapes its footprint is folded from. */
export interface BuildingChanges {
  readonly name?: string;
  readonly composition?: ShapeComposition;
  readonly padElevationMode?: PadElevationMode;
  readonly manualPadElevation?: Meters;
  readonly wallHeight?: Meters;
  readonly foundation?: Foundation;
  readonly entries?: readonly UtilityEntry[];
}

/** Edits a building's foundation field by field, keeping the rest of it. */
export function updateFoundation(
  buildings: readonly Building[],
  buildingId: BuildingId,
  changes: Partial<Foundation>
): readonly Building[] {
  return replaceById(buildings, buildingId, building => ({
    ...building,
    foundation: { ...foundationOf(building), ...changes },
  }));
}

export function addUtilityEntry(
  buildings: readonly Building[],
  buildingId: BuildingId,
  entry: UtilityEntry
): readonly Building[] {
  return replaceById(buildings, buildingId, building => ({
    ...building,
    entries: [...entriesOf(building), entry],
  }));
}

export function updateUtilityEntry(
  buildings: readonly Building[],
  buildingId: BuildingId,
  entryId: UtilityEntryId,
  changes: Partial<Omit<UtilityEntry, 'id' | 'system'>>
): readonly Building[] {
  return replaceById(buildings, buildingId, building => ({
    ...building,
    entries: entriesOf(building).map(entry =>
      entry.id === entryId ? { ...entry, ...changes } : entry
    ),
  }));
}

export function removeUtilityEntry(
  buildings: readonly Building[],
  buildingId: BuildingId,
  entryId: UtilityEntryId
): readonly Building[] {
  return replaceById(buildings, buildingId, building => ({
    ...building,
    entries: entriesOf(building).filter(entry => entry.id !== entryId),
  }));
}

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

function mapStoreys(
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

/** Drops a storey; the ground one is refused — a building always stands on it. */
export function removeStorey(
  buildings: readonly Building[],
  buildingId: BuildingId,
  storeyId: StoreyId
): readonly Building[] {
  return replaceById(buildings, buildingId, building => {
    const storeys = storeysOf(building);

    if (storeys.length <= 1 || storeys[0].id === storeyId) {
      return building;
    }

    const materialized = materializeStoreys(building);

    return {
      ...materialized,
      storeys: storeysOf(materialized).filter(storey => storey.id !== storeyId),
    };
  });
}

/** The storey holding the wall — how host-addressed edits find their floor. */
export function findStoreyOfWall(building: Building, wallId: WallId): Storey | undefined {
  return storeysOf(building).find(storey => storey.walls.some(wall => wall.id === wallId));
}

export function addWall(
  buildings: readonly Building[],
  buildingId: BuildingId,
  storeyId: StoreyId,
  wall: Wall
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey =>
    storey.id === storeyId ? { ...storey, walls: [...storey.walls, wall] } : storey
  );
}

export function updateWall(
  buildings: readonly Building[],
  buildingId: BuildingId,
  wallId: WallId,
  changes: Partial<Omit<Wall, 'id'>>
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    walls: storey.walls.map(wall => (wall.id === wallId ? { ...wall, ...changes } : wall)),
  }));
}

export function removeWall(
  buildings: readonly Building[],
  buildingId: BuildingId,
  wallId: WallId
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    walls: storey.walls.filter(wall => wall.id !== wallId),
    // A wall takes its hosted openings with it: an opening cannot outlive
    // the wall it pierces.
    openings: storey.openings.filter(opening => opening.wallId !== wallId),
  }));
}

export function moveWallPoint(
  buildings: readonly Building[],
  buildingId: BuildingId,
  wallId: WallId,
  pointIndex: number,
  point: Vector2
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    walls: storey.walls.map(wall =>
      wall.id === wallId
        ? {
            ...wall,
            points: wall.points.map((existing, index) => (index === pointIndex ? point : existing)),
          }
        : wall
    ),
  }));
}

/**
 * Splits the segment after `segmentIndex` by planting a new drawn point inside
 * it. On a ring, `segmentIndex` equal to the last point's index names the
 * closing segment — the new point simply appends, which IS that segment split.
 */
export function insertWallPoint(
  buildings: readonly Building[],
  buildingId: BuildingId,
  wallId: WallId,
  segmentIndex: number,
  point: Vector2
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    walls: storey.walls.map(wall =>
      wall.id === wallId
        ? {
            ...wall,
            points: [
              ...wall.points.slice(0, segmentIndex + 1),
              point,
              ...wall.points.slice(segmentIndex + 1),
            ],
          }
        : wall
    ),
  }));
}

/**
 * Refuses silently at the floor: an open run keeps a segment's worth of
 * points, a ring keeps a triangle's worth — below either the wall would stop
 * being a wall, and Delete must never do that by accident.
 */
export function removeWallPoint(
  buildings: readonly Building[],
  buildingId: BuildingId,
  wallId: WallId,
  pointIndex: number
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    walls: storey.walls.map(wall => {
      if (wall.id !== wallId) {
        return wall;
      }

      const floor = isWallClosed(wall) ? MIN_CLOSED_WALL_POINTS : MIN_WALL_POINTS;

      return wall.points.length <= floor
        ? wall
        : { ...wall, points: wall.points.filter((_, index) => index !== pointIndex) };
    }),
  }));
}

/** Endpoints landed on each other read as one point — the ring-closing gesture. */
const RING_SEAM_EPSILON_METERS = 1e-6;

/**
 * Closes the wall into a ring: the last point connects back to the first.
 * Ends that were dragged onto each other collapse into the one seam point;
 * anything below a triangle's worth of corners refuses — two points close
 * into nothing. Openings keep their offsets: the centreline's start does not
 * move, closing only grows its far end.
 */
export function closeWallRing(
  buildings: readonly Building[],
  buildingId: BuildingId,
  wallId: WallId
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    walls: storey.walls.map(wall => {
      if (wall.id !== wallId || isWallClosed(wall)) {
        return wall;
      }

      const [first] = wall.points;
      const last = wall.points[wall.points.length - 1];
      const endsMeet =
        wall.points.length > 1 &&
        Math.hypot(first.x - last.x, first.y - last.y) <= RING_SEAM_EPSILON_METERS;
      const points = endsMeet ? wall.points.slice(0, -1) : wall.points;

      return points.length < MIN_CLOSED_WALL_POINTS ? wall : { ...wall, points, isClosed: true };
    }),
  }));
}

/**
 * Cuts the wall at one drawn point — the closing gesture's inverse. A ring
 * opens there: the polyline is re-rooted at the cut and walks the whole loop
 * back to it, ends coincident but no longer joined, and every hosted offset
 * (openings, wall devices) rotates with the new start. An open wall splits
 * into TWO walls sharing the cut point, its hosted things dealt to whichever
 * side they stand on; cutting an open wall's endpoint is a no-op.
 */
export function cutWallAtPoint(
  buildings: readonly Building[],
  buildingId: BuildingId,
  wallId: WallId,
  pointIndex: number
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => {
    const wall = storey.walls.find(candidate => candidate.id === wallId);

    if (isNil(wall)) {
      return storey;
    }

    return isWallClosed(wall)
      ? openRingAt(storey, wall, pointIndex)
      : splitOpenWallAt(storey, wall, pointIndex);
  });
}

function openRingAt(storey: Storey, wall: Wall, pointIndex: number): Storey {
  if (pointIndex < 0 || pointIndex >= wall.points.length) {
    return storey;
  }

  const centerline = wallCenterline(wall);
  const totalLength = polylineLength(centerline);
  const cutOffset = polylineLength(centerline.slice(0, pointIndex + 1));
  const rotated = [...wall.points.slice(pointIndex), ...wall.points.slice(0, pointIndex)];
  const cutWall: Wall = {
    ...wall,
    points: [...rotated, rotated[0]],
    isClosed: false,
  };
  const rotateOffset = (offsetMeters: Meters): Meters =>
    (((offsetMeters - cutOffset) % totalLength) + totalLength) % totalLength;

  return {
    ...storey,
    walls: storey.walls.map(candidate => (candidate.id === wall.id ? cutWall : candidate)),
    openings: storey.openings.map(opening =>
      opening.wallId === wall.id
        ? { ...opening, offsetMeters: rotateOffset(opening.offsetMeters) }
        : opening
    ),
    devices: devicesOf(storey).map(device =>
      device.host.kind === 'wall' && device.host.wallId === wall.id
        ? {
            ...device,
            host: { ...device.host, offsetMeters: rotateOffset(device.host.offsetMeters) },
          }
        : device
    ),
  };
}

function splitOpenWallAt(storey: Storey, wall: Wall, pointIndex: number): Storey {
  // An endpoint has nothing to split off; the interior points do.
  if (pointIndex <= 0 || pointIndex >= wall.points.length - 1) {
    return storey;
  }

  const splitOffset = polylineLength(wallCenterline(wall).slice(0, pointIndex + 1));
  const firstHalf: Wall = { ...wall, points: wall.points.slice(0, pointIndex + 1) };
  const secondHalf: Wall = {
    ...createWall({ points: wall.points.slice(pointIndex), material: wall.material }),
    thicknessMeters: wall.thicknessMeters,
    referenceLine: wall.referenceLine,
  };
  const walls = storey.walls.flatMap(candidate =>
    candidate.id === wall.id ? [firstHalf, secondHalf] : [candidate]
  );

  return {
    ...storey,
    walls,
    openings: storey.openings.map(opening =>
      opening.wallId === wall.id && opening.offsetMeters > splitOffset
        ? { ...opening, wallId: secondHalf.id, offsetMeters: opening.offsetMeters - splitOffset }
        : opening
    ),
    devices: devicesOf(storey).map(device =>
      device.host.kind === 'wall' &&
      device.host.wallId === wall.id &&
      device.host.offsetMeters > splitOffset
        ? {
            ...device,
            host: {
              ...device.host,
              wallId: secondHalf.id,
              offsetMeters: device.host.offsetMeters - splitOffset,
            },
          }
        : device
    ),
  };
}

export function findWall(
  buildings: readonly Building[],
  buildingId: BuildingId,
  wallId: WallId
): Wall | undefined {
  const building = buildings.find(candidate => candidate.id === buildingId);

  return building === undefined
    ? undefined
    : storeysOf(building)
        .flatMap(storey => storey.walls)
        .find(wall => wall.id === wallId);
}

/** Lands on whichever storey holds the host wall — an opening needs no floor. */
export function addOpening(
  buildings: readonly Building[],
  buildingId: BuildingId,
  opening: Opening
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey =>
    storey.walls.some(wall => wall.id === opening.wallId)
      ? { ...storey, openings: [...storey.openings, opening] }
      : storey
  );
}

export function updateOpening(
  buildings: readonly Building[],
  buildingId: BuildingId,
  openingId: OpeningId,
  changes: Partial<Omit<Opening, 'id' | 'wallId' | 'kind'>>
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    openings: storey.openings.map(opening =>
      opening.id === openingId ? { ...opening, ...changes } : opening
    ),
  }));
}

export function removeOpening(
  buildings: readonly Building[],
  buildingId: BuildingId,
  openingId: OpeningId
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    openings: storey.openings.filter(opening => opening.id !== openingId),
  }));
}

export function findOpening(
  buildings: readonly Building[],
  buildingId: BuildingId,
  openingId: OpeningId
): Opening | undefined {
  const building = buildings.find(candidate => candidate.id === buildingId);

  return building === undefined
    ? undefined
    : storeysOf(building)
        .flatMap(storey => storey.openings)
        .find(opening => opening.id === openingId);
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

export function addFurniture(
  buildings: readonly Building[],
  buildingId: BuildingId,
  storeyId: StoreyId,
  furniture: FurnitureInstance
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey =>
    storey.id === storeyId ? { ...storey, furniture: [...furnitureOf(storey), furniture] } : storey
  );
}

export function updateFurniture(
  buildings: readonly Building[],
  buildingId: BuildingId,
  furnitureId: FurnitureId,
  changes: Partial<Omit<FurnitureInstance, 'id' | 'catalogId'>>
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    furniture: furnitureOf(storey).map(item =>
      item.id === furnitureId ? { ...item, ...changes } : item
    ),
  }));
}

export function removeFurniture(
  buildings: readonly Building[],
  buildingId: BuildingId,
  furnitureId: FurnitureId
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    furniture: furnitureOf(storey).filter(item => item.id !== furnitureId),
  }));
}

export function findFurniture(
  buildings: readonly Building[],
  buildingId: BuildingId,
  furnitureId: FurnitureId
): FurnitureInstance | undefined {
  const building = buildings.find(candidate => candidate.id === buildingId);

  return building === undefined
    ? undefined
    : storeysOf(building)
        .flatMap(storey => furnitureOf(storey))
        .find(item => item.id === furnitureId);
}

export function addDevice(
  buildings: readonly Building[],
  buildingId: BuildingId,
  storeyId: StoreyId,
  device: ElectricalDevice
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey =>
    storey.id === storeyId ? { ...storey, devices: [...devicesOf(storey), device] } : storey
  );
}

export function updateDevice(
  buildings: readonly Building[],
  buildingId: BuildingId,
  deviceId: DeviceId,
  changes: Partial<Omit<ElectricalDevice, 'id' | 'kind'>>
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    devices: devicesOf(storey).map(device =>
      device.id === deviceId ? { ...device, ...changes } : device
    ),
  }));
}

/** Drops the device and every mention of it: membership, links, its own group. */
export function removeDevice(
  buildings: readonly Building[],
  buildingId: BuildingId,
  deviceId: DeviceId
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => ({
    ...storey,
    devices: devicesOf(storey).filter(device => device.id !== deviceId),
    groups: groupsOf(storey)
      .filter(group => group.panelId !== deviceId)
      .map(group => ({
        ...group,
        deviceIds: group.deviceIds.filter(id => id !== deviceId),
      })),
    switchLinks: switchLinksOf(storey).filter(
      link => link.switchId !== deviceId && link.lightId !== deviceId
    ),
  }));
}

export function findDevice(
  buildings: readonly Building[],
  buildingId: BuildingId,
  deviceId: DeviceId
): ElectricalDevice | undefined {
  const building = buildings.find(candidate => candidate.id === buildingId);

  return building === undefined
    ? undefined
    : storeysOf(building)
        .flatMap(storey => devicesOf(storey))
        .find(device => device.id === deviceId);
}

/**
 * Joins a consumer to a panel's группа, minting the group on first use and
 * moving the consumer out of any other group — one device, one circuit.
 */
export function assignDeviceToPanel(
  buildings: readonly Building[],
  buildingId: BuildingId,
  panelId: DeviceId,
  deviceId: DeviceId
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => {
    const devices = devicesOf(storey);
    const hasBoth =
      devices.some(device => device.id === panelId) &&
      devices.some(device => device.id === deviceId);

    if (!hasBoth || panelId === deviceId) {
      return storey;
    }

    const cleared: readonly CircuitGroup[] = groupsOf(storey).map(group => ({
      ...group,
      deviceIds: group.deviceIds.filter(id => id !== deviceId),
    }));
    const existing = cleared.find(group => group.panelId === panelId);
    const groups =
      existing === undefined
        ? [...cleared, { ...createCircuitGroup(panelId), deviceIds: [deviceId] }]
        : cleared.map(group =>
            group.panelId === panelId
              ? { ...group, deviceIds: [...group.deviceIds, deviceId] }
              : group
          );

    return { ...storey, groups };
  });
}

/** Ties a switch to the light it commands; tying again unties nothing (idempotent). */
export function linkSwitchToLight(
  buildings: readonly Building[],
  buildingId: BuildingId,
  switchId: DeviceId,
  lightId: DeviceId
): readonly Building[] {
  return mapStoreys(buildings, buildingId, storey => {
    const devices = devicesOf(storey);
    const hasBoth =
      devices.some(device => device.id === switchId && device.kind === 'switch') &&
      devices.some(device => device.id === lightId && device.kind === 'light');
    const exists = switchLinksOf(storey).some(
      link => link.switchId === switchId && link.lightId === lightId
    );

    if (!hasBoth || exists) {
      return storey;
    }

    return { ...storey, switchLinks: [...switchLinksOf(storey), { switchId, lightId }] };
  });
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

export function addBuilding(
  buildings: readonly Building[],
  building: Building
): readonly Building[] {
  return [...buildings, building];
}

export function updateBuilding(
  buildings: readonly Building[],
  buildingId: BuildingId,
  changes: BuildingChanges
): readonly Building[] {
  return replaceById(buildings, buildingId, building => ({ ...building, ...changes }));
}

/** Puts one building back whole — anatomy and all, the restore half of a drag. */
export function replaceBuilding(
  buildings: readonly Building[],
  building: Building
): readonly Building[] {
  return buildings.map(candidate => (candidate.id === building.id ? building : candidate));
}

/**
 * The building moved rigidly by `offset` — foundation and everything standing
 * on it. The interior is positioned relative to the slab: walls, room and
 * roof-zone labels, furniture and ceiling lights all carry plan coordinates,
 * so a moved footprint takes every one of them along; what is hosted by
 * offset — openings, wall devices, utility entries on the outline — needs no
 * move at all, it rides its host.
 */
export function translateBuilding(building: Building, offset: Vector2): Building {
  const shift = (point: Vector2): Vector2 => ({ x: point.x + offset.x, y: point.y + offset.y });
  const shiftWalls = (walls: readonly Wall[]): readonly Wall[] =>
    walls.map(wall => ({ ...wall, points: wall.points.map(shift) }));
  const shiftRoomLabels = (labels: readonly RoomLabel[]): readonly RoomLabel[] =>
    labels.map(label => ({ ...label, position: shift(label.position) }));

  return {
    ...building,
    composition: translateComposition(building.composition, offset),
    ...(isNil(building.walls) ? {} : { walls: shiftWalls(building.walls) }),
    ...(isNil(building.roomLabels) ? {} : { roomLabels: shiftRoomLabels(building.roomLabels) }),
    ...(isNil(building.storeys)
      ? {}
      : {
          storeys: building.storeys.map(storey => ({
            ...storey,
            walls: shiftWalls(storey.walls),
            roomLabels: shiftRoomLabels(storey.roomLabels),
            roofZoneLabels: storey.roofZoneLabels.map(label => ({
              ...label,
              position: shift(label.position),
            })),
            ...(isNil(storey.furniture)
              ? {}
              : {
                  furniture: storey.furniture.map(item => ({
                    ...item,
                    position: shift(item.position),
                  })),
                }),
            ...(isNil(storey.devices)
              ? {}
              : {
                  devices: storey.devices.map(device =>
                    device.host.kind === 'ceiling'
                      ? {
                          ...device,
                          host: { kind: 'ceiling' as const, position: shift(device.host.position) },
                        }
                      : device
                  ),
                }),
          })),
        }),
  };
}

export function removeBuilding(
  buildings: readonly Building[],
  buildingId: BuildingId
): readonly Building[] {
  return removeById(buildings, buildingId);
}

export function findBuilding(
  buildings: readonly Building[],
  buildingId: BuildingId
): Building | undefined {
  return buildings.find(building => building.id === buildingId);
}

/** Where the plot is on Earth, as the settings panel edits it field by field. */
export interface SiteLocationChanges {
  readonly latitudeDegrees?: number;
  readonly longitudeDegrees?: number;
  readonly timeZoneId?: string;
  readonly northOffsetDegrees?: number;
}

export interface SiteSettingsChanges {
  readonly location?: SiteLocationChanges;
  readonly gridStepMeters?: Meters;
  readonly isSnapEnabled?: boolean;
  readonly setbackMeters?: Meters;
  readonly heightfieldTargetResolution?: number;
  readonly contourIntervalMeters?: Meters;
  readonly frostDepthMeters?: Meters;
}

/**
 * Settings edits, one field at a time. The location is merged rather than
 * replaced — a panel that edits a latitude must not have to restate the time
 * zone — and it keeps its identity when nothing about it changes, so the sun
 * study is left alone by an edit to the grid step.
 */
export function updateSettings(settings: SiteSettings, changes: SiteSettingsChanges): SiteSettings {
  const { location, ...flatChanges } = changes;

  return {
    ...settings,
    ...flatChanges,
    location: isNil(location)
      ? settings.location
      : normalizeSiteLocation({ ...settings.location, ...location }),
  };
}

export function addMark(
  marks: readonly ElevationMark[],
  mark: ElevationMark
): readonly ElevationMark[] {
  return [...marks, mark];
}

export function moveMark(
  marks: readonly ElevationMark[],
  markId: MarkId,
  position: Vector2
): readonly ElevationMark[] {
  return replaceById(marks, markId, mark => ({ ...mark, position }));
}

export function setMarkElevation(
  marks: readonly ElevationMark[],
  markId: MarkId,
  elevation: Meters
): readonly ElevationMark[] {
  return replaceById(marks, markId, mark => ({ ...mark, elevation }));
}

export function removeMark(
  marks: readonly ElevationMark[],
  markId: MarkId
): readonly ElevationMark[] {
  return removeById(marks, markId);
}

export function addTree(
  trees: readonly TreeInstance[],
  tree: TreeInstance
): readonly TreeInstance[] {
  return [...trees, tree];
}

export function updateTree(
  trees: readonly TreeInstance[],
  tree: TreeInstance
): readonly TreeInstance[] {
  return replaceById(trees, tree.id, () => tree);
}

export function removeTree(
  trees: readonly TreeInstance[],
  treeId: TreeId
): readonly TreeInstance[] {
  return removeById(trees, treeId);
}

export function addCar(cars: readonly CarInstance[], car: CarInstance): readonly CarInstance[] {
  return [...cars, car];
}

export function updateCar(cars: readonly CarInstance[], car: CarInstance): readonly CarInstance[] {
  return replaceById(cars, car.id, () => car);
}

export function removeCar(cars: readonly CarInstance[], carId: CarId): readonly CarInstance[] {
  return removeById(cars, carId);
}

export function addPath(paths: readonly SitePath[], path: SitePath): readonly SitePath[] {
  return [...paths, path];
}

/** Extends the polyline; the new point walks on at the width and paving the path ended with. */
export function appendPathPoint(
  paths: readonly SitePath[],
  pathId: PathId,
  position: Vector2
): readonly SitePath[] {
  return replaceById(paths, pathId, path => {
    const last = path.points[path.points.length - 1];

    return { ...path, points: [...path.points, { ...last, position }] };
  });
}

/** One width for the whole ribbon: written into every point. */
export function updatePathWidth(
  paths: readonly SitePath[],
  pathId: PathId,
  width: Meters
): readonly SitePath[] {
  return replaceById(paths, pathId, path => ({
    ...path,
    points: path.points.map(point => ({ ...point, width })),
  }));
}

/** Repaves the segment after `segmentIndex` — the surface lives on its first point. */
export function setPathSegmentSurface(
  paths: readonly SitePath[],
  pathId: PathId,
  segmentIndex: number,
  surface: PathSurface
): readonly SitePath[] {
  return replaceById(paths, pathId, path => ({
    ...path,
    points: path.points.map((point, index) =>
      index === segmentIndex ? { ...point, surface } : point
    ),
  }));
}

export function setPathPointWidth(
  paths: readonly SitePath[],
  pathId: PathId,
  pointIndex: number,
  width: Meters
): readonly SitePath[] {
  return replaceById(paths, pathId, path => ({
    ...path,
    points: path.points.map((point, index) => (index === pointIndex ? { ...point, width } : point)),
  }));
}

/** Replaces a path whole — the restore half of an interrupted point drag. */
export function updatePath(paths: readonly SitePath[], path: SitePath): readonly SitePath[] {
  return replaceById(paths, path.id, () => path);
}

/** A ribbon is the offset of a segment, so a path is never trimmed below two points. */
export const MIN_PATH_POINTS = 2;

export function movePathPoint(
  paths: readonly SitePath[],
  pathId: PathId,
  pointIndex: number,
  position: Vector2
): readonly SitePath[] {
  return replaceById(paths, pathId, path => ({
    ...path,
    points: path.points.map((existing, index) =>
      index === pointIndex ? { ...existing, position } : existing
    ),
  }));
}

/**
 * Splits the segment after `segmentIndex` by planting a new point inside it.
 * The point inherits the ribbon's width where it lands — planting alone never
 * reshapes the ribbon.
 */
export function insertPathPoint(
  paths: readonly SitePath[],
  pathId: PathId,
  segmentIndex: number,
  position: Vector2
): readonly SitePath[] {
  return replaceById(paths, pathId, path => {
    const start = path.points[segmentIndex];
    const end = path.points[segmentIndex + 1];
    const width = isNil(start) || isNil(end) ? path.points[0].width : widthAt(start, end, position);

    return {
      ...path,
      points: [
        ...path.points.slice(0, segmentIndex + 1),
        // Splitting a segment keeps its paving on both halves.
        { position, width, surface: start?.surface },
        ...path.points.slice(segmentIndex + 1),
      ],
    };
  });
}

/** The interpolated ribbon width where `position` projects onto the segment. */
function widthAt(start: PathPoint, end: PathPoint, position: Vector2): Meters {
  const segmentX = end.position.x - start.position.x;
  const segmentY = end.position.y - start.position.y;
  const squaredLength = segmentX * segmentX + segmentY * segmentY;

  if (squaredLength === 0) {
    return start.width;
  }

  const projection = Math.min(
    1,
    Math.max(
      0,
      ((position.x - start.position.x) * segmentX + (position.y - start.position.y) * segmentY) /
        squaredLength
    )
  );

  return start.width + (end.width - start.width) * projection;
}

export function removePathPoint(
  paths: readonly SitePath[],
  pathId: PathId,
  pointIndex: number
): readonly SitePath[] {
  const path = paths.find(candidate => candidate.id === pathId);

  if (isNil(path) || path.points.length <= MIN_PATH_POINTS) {
    return paths;
  }

  return replaceById(paths, pathId, () => ({
    ...path,
    points: path.points.filter((_, index) => index !== pointIndex),
  }));
}

export function removePath(paths: readonly SitePath[], pathId: PathId): readonly SitePath[] {
  return removeById(paths, pathId);
}

export function addUtilityRoute(
  routes: readonly UtilityRoute[],
  route: UtilityRoute
): readonly UtilityRoute[] {
  return [...routes, route];
}

export function updateUtilityRoute(
  routes: readonly UtilityRoute[],
  route: UtilityRoute
): readonly UtilityRoute[] {
  return routes.map(candidate => (candidate.id === route.id ? route : candidate));
}

export function removeUtilityRoute(
  routes: readonly UtilityRoute[],
  routeId: UtilityRouteId
): readonly UtilityRoute[] {
  return removeById(routes, routeId);
}

export function moveUtilityRoutePoint(
  routes: readonly UtilityRoute[],
  routeId: UtilityRouteId,
  pointIndex: number,
  position: Vector2
): readonly UtilityRoute[] {
  return replaceById(routes, routeId, route => ({
    ...route,
    points: route.points.map((existing, index) => (index === pointIndex ? position : existing)),
  }));
}

/** Splits the segment after `segmentIndex` by planting a new bend inside it. */
export function insertUtilityRoutePoint(
  routes: readonly UtilityRoute[],
  routeId: UtilityRouteId,
  segmentIndex: number,
  position: Vector2
): readonly UtilityRoute[] {
  return replaceById(routes, routeId, route => ({
    ...route,
    points: [
      ...route.points.slice(0, segmentIndex + 1),
      position,
      ...route.points.slice(segmentIndex + 1),
    ],
  }));
}

/** Refuses silently below a segment's worth of points, like a path does. */
export function removeUtilityRoutePoint(
  routes: readonly UtilityRoute[],
  routeId: UtilityRouteId,
  pointIndex: number
): readonly UtilityRoute[] {
  return replaceById(routes, routeId, route =>
    route.points.length <= MIN_ROUTE_POINTS
      ? route
      : { ...route, points: route.points.filter((_, index) => index !== pointIndex) }
  );
}

function withTerms(composition: ShapeComposition, terms: readonly CsgTerm[]): ShapeComposition {
  return terms === composition.terms ? composition : { terms };
}

/** Where a term stands: the list that holds it, and its place in that list. */
interface TermLocation {
  readonly term: CsgTerm;
  /** The group whose terms hold it; nothing when the root composition does. */
  readonly parentGroupId: ShapeId | undefined;
  readonly index: number;
}

function locateTerm(
  terms: readonly CsgTerm[],
  operandId: ShapeId,
  parentGroupId: ShapeId | undefined
): TermLocation | undefined {
  const index = terms.findIndex(term => term.operand.id === operandId);

  if (index >= 0) {
    return { term: terms[index], parentGroupId, index };
  }

  for (const { operand } of terms) {
    if (!isShapeGroup(operand)) {
      continue;
    }

    const nested = locateTerm(operand.terms, operandId, operand.id);

    if (!isNil(nested)) {
      return nested;
    }
  }

  return undefined;
}

/** The terms a move lands among, or nothing when the named group is not one. */
function resolveTargetTerms(
  composition: ShapeComposition,
  targetGroupId: ShapeId | undefined
): readonly CsgTerm[] | undefined {
  return isNil(targetGroupId)
    ? composition.terms
    : findGroupTerm(composition, targetGroupId)?.group.terms;
}

function entersOwnSubtree(term: CsgTerm, targetGroupId: ShapeId | undefined): boolean {
  const { operand } = term;

  if (isNil(targetGroupId)) {
    return false;
  }

  return (
    operand.id === targetGroupId ||
    (isShapeGroup(operand) && !isNil(findTerm(operand, targetGroupId)))
  );
}

/** Where the term is put back, or nothing when that is where it already stands. */
function resolveInsertionIndex({
  source,
  targetGroupId,
  targetTermCount,
  targetIndex,
}: {
  readonly source: TermLocation;
  readonly targetGroupId: ShapeId | undefined;
  readonly targetTermCount: number;
  readonly targetIndex: number;
}): number | undefined {
  const boundedIndex = clamp(targetIndex, 0, targetTermCount);

  if (source.parentGroupId !== targetGroupId) {
    return boundedIndex;
  }

  // The term leaves the list before it re-enters it, so every place past the one
  // it stands in moves one closer.
  const shiftedIndex = boundedIndex > source.index ? boundedIndex - 1 : boundedIndex;

  return shiftedIndex === source.index ? undefined : shiftedIndex;
}

function detachTerm(composition: ShapeComposition, operandId: ShapeId): ShapeComposition {
  return withTerms(
    composition,
    editOwningTerms(composition.terms, operandId, (terms, index) =>
      unionLeadingTerm(terms.filter((_, candidateIndex) => candidateIndex !== index))
    )
  );
}

function insertTerm({
  composition,
  targetGroupId,
  index,
  term,
}: {
  readonly composition: ShapeComposition;
  readonly targetGroupId: ShapeId | undefined;
  readonly index: number;
  readonly term: CsgTerm;
}): ShapeComposition {
  if (isNil(targetGroupId)) {
    return { terms: insertTermAt(composition.terms, index, term) };
  }

  return withTerms(
    composition,
    editOwningTerms(composition.terms, targetGroupId, (terms, groupIndex) =>
      replaceGroupTerms(terms, groupIndex, groupTerms => insertTermAt(groupTerms, index, term))
    )
  );
}

function insertTermAt(terms: readonly CsgTerm[], index: number, term: CsgTerm): readonly CsgTerm[] {
  const next = [...terms];

  next.splice(index, 0, term);

  return unionLeadingTerm(next);
}

/** The first term is what the rest is folded onto, so it can only be a union. */
function unionLeadingTerm(terms: readonly CsgTerm[]): readonly CsgTerm[] {
  if (terms.length === 0 || terms[0].operation === 'union') {
    return terms;
  }

  return replaceAt(terms, 0, term => ({ ...term, operation: 'union' }));
}

/**
 * Rewrites the term list that directly holds the operand, wherever in the tree
 * that list is, and rebuilds only the groups on the way down to it. An edit that
 * finds nothing — or changes nothing — hands back the very same list, so the
 * no-op reaches the caller as an unchanged composition reference.
 */
function editOwningTerms(
  terms: readonly CsgTerm[],
  operandId: ShapeId,
  edit: (terms: readonly CsgTerm[], index: number) => readonly CsgTerm[]
): readonly CsgTerm[] {
  const index = terms.findIndex(term => term.operand.id === operandId);

  if (index >= 0) {
    return edit(terms, index);
  }

  for (let groupIndex = 0; groupIndex < terms.length; groupIndex += 1) {
    const { operand } = terms[groupIndex];

    if (!isShapeGroup(operand)) {
      continue;
    }

    const nestedTerms = editOwningTerms(operand.terms, operandId, edit);

    if (nestedTerms !== operand.terms) {
      return replaceGroupTerms(terms, groupIndex, () => nestedTerms);
    }
  }

  return terms;
}

/** Rewrites the terms of the group standing at `index`; a leaf there is left alone. */
function replaceGroupTerms(
  terms: readonly CsgTerm[],
  index: number,
  updateTerms: (groupTerms: readonly CsgTerm[]) => readonly CsgTerm[]
): readonly CsgTerm[] {
  const { operand } = terms[index];

  if (!isShapeGroup(operand)) {
    return terms;
  }

  return replaceAt(terms, index, term => ({
    ...term,
    operand: { ...operand, terms: updateTerms(operand.terms) },
  }));
}

function replaceAt(
  terms: readonly CsgTerm[],
  index: number,
  updateTerm: (term: CsgTerm) => CsgTerm
): readonly CsgTerm[] {
  const next = [...terms];

  next[index] = updateTerm(next[index]);

  return next;
}

function replaceById<TItem extends { readonly id: string }>(
  items: readonly TItem[],
  id: string,
  updateItem: (item: TItem) => TItem
): readonly TItem[] {
  const index = items.findIndex(item => item.id === id);

  if (index < 0) {
    return items;
  }

  const next = [...items];
  next[index] = updateItem(next[index]);

  return next;
}

function removeById<TItem extends { readonly id: string }>(
  items: readonly TItem[],
  id: string
): readonly TItem[] {
  const next = items.filter(item => item.id !== id);

  return next.length === items.length ? items : next;
}
