import { isValidTimeZoneId } from '../sun/time-zone';
import type { Building } from './building';
import type { CarInstance, PathPoint, SitePath, TreeInstance } from './plot-objects';
import { PATH_SURFACES, TREE_SPECIES } from './plot-objects';
import type { UtilityRoute } from './routing';
import { TRENCH_SYSTEMS } from './routing';
import type { ElevationMark, SiteLocation, SitePlan, SiteSettings } from './site-plan';

import { isBuilding } from './building-snapshot-guards';
import {
  isRecord,
  isArrayOf,
  isOneOf,
  isFiniteNumber,
  isPositiveNumber,
  isNonNegativeNumber,
  isNonEmptyString,
  isVector2,
  isShapeComposition,
} from './snapshot-guards';
import { CURRENT_SNAPSHOT_VERSION, migratePlan } from './snapshot-migrations';

const MAX_LATITUDE_DEGREES = 90;

const MAX_LONGITUDE_DEGREES = 180;

const MIN_HEIGHTFIELD_RESOLUTION = 2;

interface SitePlanSnapshot {
  readonly version: number;
  readonly plan: SitePlan;
}

export function serializeSitePlan(plan: SitePlan): string {
  const snapshot: SitePlanSnapshot = { version: CURRENT_SNAPSHOT_VERSION, plan };

  return JSON.stringify(snapshot);
}

/**
 * Reads a persisted snapshot back into a plan, migrating a payload written by an
 * older format on the way. Anything unreadable — broken JSON, a version this
 * build does not know, a field of the wrong shape — yields `undefined` so the
 * caller can fall back to a default plan instead of loading a half-valid
 * document.
 */
export function parseSnapshot(raw: string): SitePlan | undefined {
  const snapshot = parseJson(raw);

  if (!isRecord(snapshot)) {
    return undefined;
  }

  const plan = migratePlan(snapshot.plan, snapshot.version);

  return isSitePlan(plan) ? plan : undefined;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function isElevationMark(value: unknown): value is ElevationMark {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isVector2(value.position) &&
    isFiniteNumber(value.elevation)
  );
}

/**
 * One building brought in from a file — the «Готовый дом → Из файла» path.
 * The same validator the whole-plan snapshot uses; ids are reminted at
 * placement, so a file exported twice cannot collide with itself.
 */
export function parseStockBuilding(raw: string): Building | undefined {
  const value = parseJson(raw);

  return isBuilding(value) ? value : undefined;
}

function isTreeInstance(value: unknown): value is TreeInstance {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isOneOf(value.species, TREE_SPECIES) &&
    isVector2(value.position) &&
    isPositiveNumber(value.crownRadius) &&
    isPositiveNumber(value.height)
  );
}

function isCarInstance(value: unknown): value is CarInstance {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isVector2(value.position) &&
    isFiniteNumber(value.rotationDegrees)
  );
}

function isPathPoint(value: unknown): value is PathPoint {
  return (
    isRecord(value) &&
    isVector2(value.position) &&
    isPositiveNumber(value.width) &&
    // Paths predate the paving; an absent surface stays a valid document.
    (value.surface === undefined || isOneOf(value.surface, PATH_SURFACES))
  );
}

function isSitePath(value: unknown): value is SitePath {
  return isRecord(value) && isNonEmptyString(value.id) && isArrayOf(value.points, isPathPoint);
}

function isUtilityRoute(value: unknown): value is UtilityRoute {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isOneOf(value.system, TRENCH_SYSTEMS) &&
    isArrayOf(value.points, isVector2) &&
    (value.diameterMeters === undefined || isPositiveNumber(value.diameterMeters))
  );
}

/**
 * The time zone is checked against the runtime's own IANA database rather than
 * only for being a string: every sun computation resolves the plan's moment
 * through it, and a name this build cannot resolve would throw out of the 3D
 * view instead of being refused at the door.
 */
function isSiteLocation(value: unknown): value is SiteLocation {
  return (
    isRecord(value) &&
    isFiniteNumber(value.latitudeDegrees) &&
    Math.abs(value.latitudeDegrees) <= MAX_LATITUDE_DEGREES &&
    isFiniteNumber(value.longitudeDegrees) &&
    Math.abs(value.longitudeDegrees) <= MAX_LONGITUDE_DEGREES &&
    isNonEmptyString(value.timeZoneId) &&
    isValidTimeZoneId(value.timeZoneId) &&
    isFiniteNumber(value.northOffsetDegrees)
  );
}

function isSiteSettings(value: unknown): value is SiteSettings {
  return (
    isRecord(value) &&
    isSiteLocation(value.location) &&
    isPositiveNumber(value.gridStepMeters) &&
    typeof value.isSnapEnabled === 'boolean' &&
    isNonNegativeNumber(value.setbackMeters) &&
    isFiniteNumber(value.heightfieldTargetResolution) &&
    Number.isInteger(value.heightfieldTargetResolution) &&
    value.heightfieldTargetResolution >= MIN_HEIGHTFIELD_RESOLUTION &&
    isPositiveNumber(value.contourIntervalMeters) &&
    (value.frostDepthMeters === undefined || isPositiveNumber(value.frostDepthMeters))
  );
}

function isSitePlan(value: unknown): value is SitePlan {
  return (
    isRecord(value) &&
    isShapeComposition(value.boundary) &&
    isArrayOf(value.elevationMarks, isElevationMark) &&
    isArrayOf(value.buildings, isBuilding) &&
    isArrayOf(value.trees, isTreeInstance) &&
    isArrayOf(value.cars, isCarInstance) &&
    isArrayOf(value.paths, isSitePath) &&
    // Routes joined the plan with the routing stage; their absence stays a
    // valid document (the underlay/foundation precedent — no version bump).
    (value.utilityRoutes === undefined || isArrayOf(value.utilityRoutes, isUtilityRoute)) &&
    isSiteSettings(value.settings)
  );
}
