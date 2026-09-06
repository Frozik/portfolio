import { PAD_ELEVATION_MODES } from './building';
import type { Building } from './building';
import type { VerticalDuct } from './ducts';
import { DUCT_KINDS } from './ducts';
import type { CircuitGroup, ElectricalDevice, SwitchLink } from './electrical';
import { DEVICE_KINDS } from './electrical';
import type { Fireplace } from './fireplaces';
import { FIREPLACE_KINDS } from './fireplaces';
import type { Foundation, UtilityEntry } from './foundation';
import { ENTRY_SYSTEMS, FOUNDATION_KINDS } from './foundation';
import type { FurnitureInstance } from './furniture';
import { FURNITURE_CATALOG } from './furniture';
import type { Opening } from './openings';
import type { PitchedRoof } from './roofs';
import { PITCHED_ROOF_KINDS } from './roofs';
import type { RoomLabel } from './rooms';
import { ROOM_TYPES } from './rooms';

import {
  isRecord,
  isArrayOf,
  isOneOf,
  isFiniteNumber,
  isPositiveNumber,
  isNonEmptyString,
  isVector2,
  isShape,
  isShapeComposition,
} from './snapshot-guards';
import type { StairInstance } from './stairs';
import { STAIR_KINDS } from './stairs';
import type { RoofZoneLabel, Storey } from './storeys';
import { ROOF_COVERS } from './storeys';
import type { SupportPost } from './supports';
import { SUPPORT_PROFILES } from './supports';
import type { Wall } from './walls';
import { MIN_WALL_POINTS, WALL_MATERIALS, WALL_REFERENCE_LINES } from './walls';

/** The type guards of a stored building and everything on its storeys. */
export function isBuilding(value: unknown): value is Building {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    typeof value.name === 'string' &&
    isShapeComposition(value.composition) &&
    isOneOf(value.padElevationMode, PAD_ELEVATION_MODES) &&
    (value.manualPadElevation === undefined || isFiniteNumber(value.manualPadElevation)) &&
    (value.padDropMeters === undefined || isFiniteNumber(value.padDropMeters)) &&
    isPositiveNumber(value.wallHeight) &&
    // Foundation and entries arrived after v5; absent means the defaults
    // (the underlay/anchorFactors precedent — optional field, no version bump).
    (value.foundation === undefined || isFoundation(value.foundation)) &&
    (value.entries === undefined || isArrayOf(value.entries, isUtilityEntry)) &&
    (value.walls === undefined || isArrayOf(value.walls, isWall)) &&
    (value.openings === undefined || isArrayOf(value.openings, isOpening)) &&
    (value.roomLabels === undefined || isArrayOf(value.roomLabels, isRoomLabel)) &&
    (value.storeys === undefined || isArrayOf(value.storeys, isStorey)) &&
    (value.pitchedRoof === undefined || isPitchedRoof(value.pitchedRoof))
  );
}

function isPitchedRoof(value: unknown): value is PitchedRoof {
  return (
    isRecord(value) &&
    isOneOf(value.kind, PITCHED_ROOF_KINDS) &&
    isFiniteNumber(value.pitchDegrees) &&
    isFiniteNumber(value.overhangMeters) &&
    isFiniteNumber(value.ridgeDegrees)
  );
}

function isStorey(value: unknown): value is Storey {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isPositiveNumber(value.heightMeters) &&
    isArrayOf(value.walls, isWall) &&
    isArrayOf(value.openings, isOpening) &&
    isArrayOf(value.roomLabels, isRoomLabel) &&
    isArrayOf(value.roofZoneLabels, isRoofZoneLabel) &&
    (value.furniture === undefined || isArrayOf(value.furniture, isFurnitureInstance)) &&
    (value.devices === undefined || isArrayOf(value.devices, isElectricalDevice)) &&
    (value.groups === undefined || isArrayOf(value.groups, isCircuitGroup)) &&
    (value.switchLinks === undefined || isArrayOf(value.switchLinks, isSwitchLink)) &&
    // Absent in storeys saved before stairs and posts existed; read back as
    // empty by `stairsOf` / `supportsOf`, so no version bump is owed.
    (value.stairs === undefined || isArrayOf(value.stairs, isStairInstance)) &&
    (value.supports === undefined || isArrayOf(value.supports, isSupportPost)) &&
    (value.slabs === undefined || isArrayOf(value.slabs, isShape)) &&
    (value.fireplaces === undefined || isArrayOf(value.fireplaces, isFireplace)) &&
    (value.ducts === undefined || isArrayOf(value.ducts, isVerticalDuct))
  );
}

function isStairInstance(value: unknown): value is StairInstance {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isOneOf(value.kind, STAIR_KINDS) &&
    isVector2(value.position) &&
    isFiniteNumber(value.rotationDegrees) &&
    isPositiveNumber(value.widthMeters) &&
    (value.isMirrored === undefined || typeof value.isMirrored === 'boolean')
  );
}

function isFireplace(value: unknown): value is Fireplace {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isOneOf(value.kind, FIREPLACE_KINDS) &&
    isVector2(value.position) &&
    isFiniteNumber(value.rotationDegrees)
  );
}

function isVerticalDuct(value: unknown): value is VerticalDuct {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isOneOf(value.kind, DUCT_KINDS) &&
    isVector2(value.position) &&
    isPositiveNumber(value.widthMeters) &&
    isPositiveNumber(value.depthMeters) &&
    isFiniteNumber(value.rotationDegrees)
  );
}

function isSupportPost(value: unknown): value is SupportPost {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isVector2(value.position) &&
    isOneOf(value.profile, SUPPORT_PROFILES) &&
    isPositiveNumber(value.sizeMeters)
  );
}

function isElectricalDevice(value: unknown): value is ElectricalDevice {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isOneOf(value.kind, DEVICE_KINDS)) {
    return false;
  }

  const host = value.host;

  if (!isRecord(host)) {
    return false;
  }

  if (host.kind === 'wall') {
    return (
      isNonEmptyString(host.wallId) &&
      isFiniteNumber(host.offsetMeters) &&
      isFiniteNumber(host.heightMeters) &&
      host.heightMeters >= 0
    );
  }

  return host.kind === 'ceiling' && isVector2(host.position);
}

function isCircuitGroup(value: unknown): value is CircuitGroup {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.panelId) &&
    isArrayOf(value.deviceIds, isNonEmptyString)
  );
}

function isSwitchLink(value: unknown): value is SwitchLink {
  return isRecord(value) && isNonEmptyString(value.switchId) && isNonEmptyString(value.lightId);
}

function isFurnitureInstance(value: unknown): value is FurnitureInstance {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isOneOf(
      value.catalogId,
      FURNITURE_CATALOG.map(entry => entry.id)
    ) &&
    isVector2(value.position) &&
    isFiniteNumber(value.rotationDegrees) &&
    isFiniteNumber(value.elevationMeters) &&
    value.elevationMeters >= 0
  );
}

function isRoofZoneLabel(value: unknown): value is RoofZoneLabel {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isVector2(value.position) &&
    isOneOf(value.cover, ROOF_COVERS)
  );
}

function isOpening(value: unknown): value is Opening {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.wallId) &&
    (value.kind === 'door' || value.kind === 'window') &&
    isFiniteNumber(value.offsetMeters) &&
    isPositiveNumber(value.widthMeters) &&
    isFiniteNumber(value.sillMeters) &&
    value.sillMeters >= 0 &&
    isFiniteNumber(value.headMeters) &&
    value.headMeters > value.sillMeters
  );
}

function isRoomLabel(value: unknown): value is RoomLabel {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isVector2(value.position) &&
    isOneOf(
      value.roomTypeId,
      ROOM_TYPES.map(type => type.id)
    )
  );
}

function isWall(value: unknown): value is Wall {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isArrayOf(value.points, isVector2) &&
    Array.isArray(value.points) &&
    value.points.length >= MIN_WALL_POINTS &&
    isOneOf(value.material, WALL_MATERIALS) &&
    isPositiveNumber(value.thicknessMeters) &&
    isOneOf(value.referenceLine, WALL_REFERENCE_LINES) &&
    // Rings joined the format later; their absence stays a valid document.
    (value.isClosed === undefined || typeof value.isClosed === 'boolean')
  );
}

function isFoundation(value: unknown): value is Foundation {
  return (
    isRecord(value) &&
    isOneOf(value.kind, FOUNDATION_KINDS) &&
    isFiniteNumber(value.depthMeters) &&
    value.depthMeters >= 0 &&
    isFiniteNumber(value.heightAboveGroundMeters) &&
    value.heightAboveGroundMeters >= 0
  );
}

function isUtilityEntry(value: unknown): value is UtilityEntry {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isOneOf(value.system, ENTRY_SYSTEMS) &&
    isFiniteNumber(value.outlineOffsetMeters) &&
    (value.floorPosition === undefined || isVector2(value.floorPosition)) &&
    (value.kind === 'sleeve' || value.kind === 'facade') &&
    isFiniteNumber(value.depthMeters) &&
    (value.sleeveDiameterMeters === undefined || isPositiveNumber(value.sleeveDiameterMeters))
  );
}
