import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import type { Meters } from '../units';
import { DEGREES_TO_RADIANS, normalizeTurnDegrees } from '../units';
import { removeById, replaceById } from './edit-collections';
import type { Foundation, UtilityEntry, UtilityEntryId } from './foundation';
import type { RoomLabel } from './rooms';
import type { CsgTerm, Shape, ShapeComposition } from './shapes';
import { isShapeGroup, translateComposition } from './shapes';
import type { Building, BuildingId, PadElevationMode } from './site-plan';
import { entriesOf, foundationOf } from './site-plan';
import type { Wall } from './walls';

/** Everything about a building except the shapes its footprint is folded from. */
export interface BuildingChanges {
  readonly name?: string;
  readonly composition?: ShapeComposition;
  readonly padElevationMode?: PadElevationMode;
  readonly manualPadElevation?: Meters;
  readonly padDropMeters?: Meters;
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

  const shiftPlaced = <TItem extends { readonly position: Vector2 }>(
    items: readonly TItem[]
  ): readonly TItem[] => items.map(item => ({ ...item, position: shift(item.position) }));

  return {
    ...building,
    composition: translateComposition(building.composition, offset),
    ...(isNil(building.walls) ? {} : { walls: shiftWalls(building.walls) }),
    ...(isNil(building.roomLabels) ? {} : { roomLabels: shiftRoomLabels(building.roomLabels) }),
    ...(isNil(building.entries)
      ? {}
      : {
          entries: building.entries.map(entry =>
            isNil(entry.floorPosition)
              ? entry
              : { ...entry, floorPosition: shift(entry.floorPosition) }
          ),
        }),
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
            ...(isNil(storey.stairs) ? {} : { stairs: shiftPlaced(storey.stairs) }),
            ...(isNil(storey.supports) ? {} : { supports: shiftPlaced(storey.supports) }),
            ...(isNil(storey.fireplaces) ? {} : { fireplaces: shiftPlaced(storey.fireplaces) }),
            ...(isNil(storey.ducts) ? {} : { ducts: shiftPlaced(storey.ducts) }),
            ...(isNil(storey.slabs)
              ? {}
              : {
                  slabs: storey.slabs.map(slab => ({ ...slab, center: shift(slab.center) })),
                }),
          })),
        }),
  };
}

/**
 * The whole building turned about `pivot` — footprint, walls, every storey's
 * furnishings AND the roof's ridge heading, so the house rotates as one thing
 * the way dragging it moves it as one thing. Wall-hosted pieces (openings,
 * sockets) ride their walls by offset and need no touching; outline-offset
 * entries ride the outline the same way.
 */
export function rotateBuilding(building: Building, byDegrees: number, pivot: Vector2): Building {
  const radians = byDegrees * DEGREES_TO_RADIANS;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const spin = (point: Vector2): Vector2 => ({
    x: pivot.x + (point.x - pivot.x) * cos - (point.y - pivot.y) * sin,
    y: pivot.y + (point.x - pivot.x) * sin + (point.y - pivot.y) * cos,
  });
  const turn = (degrees: number): number => normalizeTurnDegrees(degrees + byDegrees);
  const spinShape = (shape: Shape): Shape =>
    shape.kind === 'circle'
      ? { ...shape, center: spin(shape.center) }
      : { ...shape, center: spin(shape.center), rotationDegrees: turn(shape.rotationDegrees) };
  const spinTerms = (terms: readonly CsgTerm[]): readonly CsgTerm[] =>
    terms.map(term => ({
      ...term,
      operand: isShapeGroup(term.operand)
        ? { ...term.operand, terms: spinTerms(term.operand.terms) }
        : spinShape(term.operand),
    }));
  const spinWalls = (walls: readonly Wall[]): readonly Wall[] =>
    walls.map(wall => ({ ...wall, points: wall.points.map(spin) }));
  const spinRoomLabels = (labels: readonly RoomLabel[]): readonly RoomLabel[] =>
    labels.map(label => ({ ...label, position: spin(label.position) }));
  const spinPlaced = <
    TItem extends { readonly position: Vector2; readonly rotationDegrees: number },
  >(
    items: readonly TItem[]
  ): readonly TItem[] =>
    items.map(item => ({
      ...item,
      position: spin(item.position),
      rotationDegrees: turn(item.rotationDegrees),
    }));

  return {
    ...building,
    composition: { terms: spinTerms(building.composition.terms) },
    ...(isNil(building.walls) ? {} : { walls: spinWalls(building.walls) }),
    ...(isNil(building.roomLabels) ? {} : { roomLabels: spinRoomLabels(building.roomLabels) }),
    ...(isNil(building.entries)
      ? {}
      : {
          entries: building.entries.map(entry =>
            isNil(entry.floorPosition)
              ? entry
              : { ...entry, floorPosition: spin(entry.floorPosition) }
          ),
        }),
    ...(isNil(building.pitchedRoof)
      ? {}
      : {
          pitchedRoof: {
            ...building.pitchedRoof,
            ridgeDegrees: turn(building.pitchedRoof.ridgeDegrees),
          },
        }),
    ...(isNil(building.storeys)
      ? {}
      : {
          storeys: building.storeys.map(storey => ({
            ...storey,
            walls: spinWalls(storey.walls),
            roomLabels: spinRoomLabels(storey.roomLabels),
            roofZoneLabels: storey.roofZoneLabels.map(label => ({
              ...label,
              position: spin(label.position),
            })),
            ...(isNil(storey.furniture) ? {} : { furniture: spinPlaced(storey.furniture) }),
            ...(isNil(storey.devices)
              ? {}
              : {
                  devices: storey.devices.map(device =>
                    device.host.kind === 'ceiling'
                      ? {
                          ...device,
                          host: { kind: 'ceiling' as const, position: spin(device.host.position) },
                        }
                      : device
                  ),
                }),
            ...(isNil(storey.stairs) ? {} : { stairs: spinPlaced(storey.stairs) }),
            ...(isNil(storey.supports)
              ? {}
              : {
                  supports: storey.supports.map(post => ({
                    ...post,
                    position: spin(post.position),
                  })),
                }),
            ...(isNil(storey.fireplaces) ? {} : { fireplaces: spinPlaced(storey.fireplaces) }),
            ...(isNil(storey.ducts) ? {} : { ducts: spinPlaced(storey.ducts) }),
            ...(isNil(storey.slabs) ? {} : { slabs: storey.slabs.map(spinShape) }),
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
