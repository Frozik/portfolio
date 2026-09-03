import type { Vector2 } from '@frozik/utils/math/vector2';
import { isValidTimeZoneId } from '../sun/time-zone';
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
import type { UtilityRoute } from './routing';
import { TRENCH_SYSTEMS } from './routing';
import type { CsgOperand, CsgOperation, CsgTerm, Shape, ShapeComposition } from './shapes';
import type {
  Building,
  CarInstance,
  ElevationMark,
  PathPoint,
  SiteLocation,
  SitePath,
  SitePlan,
  SiteSettings,
  TreeInstance,
  TreeSpecies,
} from './site-plan';
import { createBuildingId, PAD_ELEVATION_MODES, PATH_SURFACES, TREE_SPECIES } from './site-plan';

import type { StairInstance } from './stairs';
import { STAIR_KINDS } from './stairs';
import type { RoofZoneLabel, Storey } from './storeys';
import { ROOF_COVERS } from './storeys';
import type { SupportPost } from './supports';
import { SUPPORT_PROFILES } from './supports';
import type { Wall } from './walls';
import { MIN_WALL_POINTS, WALL_MATERIALS, WALL_REFERENCE_LINES } from './walls';

export const CURRENT_SNAPSHOT_VERSION = 5;

/**
 * Snapshots written while a term could only hold a primitive. They name that
 * primitive `shape` where later versions name it `operand`, and they can hold no
 * groups at all, so migrating one is a rename over two flat term lists.
 */
const FLAT_TERM_SNAPSHOT_VERSION = 1;

/**
 * Snapshots written before the catalogue: they carry no cars, and their trees
 * name a family — `conifer` — where version 3 names the species standing for it.
 */
const PRE_CATALOG_SNAPSHOT_VERSION = 2;

/** How versions 1 and 2 named every tree drawn as a cone. */
const LEGACY_CONIFER_FAMILY = 'conifer';
/** The species that family becomes: the cone template is the spruce's. */
const LEGACY_CONIFER_SPECIES: TreeSpecies = 'spruce';

/**
 * Snapshots whose paths carry one width for the whole polyline. Version 4
 * moves the width into every point so a ribbon can vary along its run.
 */
const UNIFORM_PATH_WIDTH_SNAPSHOT_VERSION = 3;

/**
 * Snapshots with a single optional `house` where version 5 keeps a list of
 * named buildings. The migrated house becomes the list's only entry.
 */
const SINGLE_HOUSE_SNAPSHOT_VERSION = 4;

/** The name the migrated house wears; new buildings are named by the user. */
const MIGRATED_HOUSE_NAME = 'Дом';

const MAX_LATITUDE_DEGREES = 90;
const MAX_LONGITUDE_DEGREES = 180;
const MIN_HEIGHTFIELD_RESOLUTION = 2;

/**
 * How deep the term tree may nest. The editor never builds anything remotely
 * this deep; the ceiling is there so a hand-written file cannot drive the
 * recursive validator — or the recursive fold behind it — off the stack.
 */
const MAX_TERM_DEPTH = 16;

const CSG_OPERATIONS: readonly CsgOperation[] = ['union', 'subtract'];

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

/**
 * Brings a payload of any version this build knows up to the current one. The
 * older formats are migrated in a chain rather than each to the present: a
 * version 1 document is a version 2 one once its terms are renamed, so the step
 * that adds the catalogue only ever has to be written against version 2.
 */
function migratePlan(plan: unknown, version: unknown): unknown {
  switch (version) {
    case CURRENT_SNAPSHOT_VERSION:
      return plan;
    case SINGLE_HOUSE_SNAPSHOT_VERSION:
      return migrateSingleHousePlan(plan);
    case UNIFORM_PATH_WIDTH_SNAPSHOT_VERSION:
      return migrateSingleHousePlan(migrateUniformPathWidthPlan(plan));
    case PRE_CATALOG_SNAPSHOT_VERSION:
      return migrateSingleHousePlan(migrateUniformPathWidthPlan(migratePreCatalogPlan(plan)));
    case FLAT_TERM_SNAPSHOT_VERSION:
      return migrateSingleHousePlan(
        migrateUniformPathWidthPlan(migratePreCatalogPlan(migrateFlatTermPlan(plan)))
      );
    default:
      return undefined;
  }
}

/**
 * Moves a version 4 plan's single optional house into the buildings list. It
 * runs before validation, so a plan that was never one is passed through
 * untouched for the validator to refuse.
 */
function migrateSingleHousePlan(plan: unknown): unknown {
  if (!isRecord(plan)) {
    return undefined;
  }

  const { house, ...rest } = plan;

  return {
    ...rest,
    buildings: isRecord(house)
      ? [{ ...house, id: createBuildingId(), name: MIGRATED_HOUSE_NAME }]
      : [],
  };
}

/**
 * Moves a version 3 path's single width into each of its points. It runs
 * before validation, so a path that was never one is passed through untouched
 * for the validator to refuse.
 */
function migrateUniformPathWidthPlan(plan: unknown): unknown {
  if (!isRecord(plan)) {
    return undefined;
  }

  const { paths } = plan;

  return { ...plan, paths: Array.isArray(paths) ? paths.map(migrateUniformPathWidthPath) : paths };
}

function migrateUniformPathWidthPath(path: unknown): unknown {
  if (!isRecord(path) || !Array.isArray(path.points) || !isPositiveNumber(path.width)) {
    return path;
  }

  const { width, points, ...rest } = path;

  return { ...rest, points: points.map(position => ({ position, width })) };
}

/**
 * Gives a pre-catalogue plan the sections and the species names version 3
 * expects: an empty car park, and the spruce that every tree drawn as a cone
 * used to be. It runs before validation, so a plan that was never one is passed
 * through untouched for the validator to refuse.
 */
function migratePreCatalogPlan(plan: unknown): unknown {
  if (!isRecord(plan)) {
    return undefined;
  }

  const { trees } = plan;

  return {
    ...plan,
    cars: [],
    trees: Array.isArray(trees) ? trees.map(migratePreCatalogTree) : trees,
  };
}

function migratePreCatalogTree(tree: unknown): unknown {
  if (!isRecord(tree) || tree.species !== LEGACY_CONIFER_FAMILY) {
    return tree;
  }

  return { ...tree, species: LEGACY_CONIFER_SPECIES };
}

/**
 * Renames `shape` to `operand` in both compositions of a version 1 plan. It runs
 * before validation, so every field it does not recognise is passed through
 * untouched for the validator to refuse.
 */
function migrateFlatTermPlan(plan: unknown): unknown {
  if (!isRecord(plan)) {
    return undefined;
  }

  const { house } = plan;

  return {
    ...plan,
    boundary: migrateFlatTermComposition(plan.boundary),
    house: isRecord(house)
      ? { ...house, composition: migrateFlatTermComposition(house.composition) }
      : house,
  };
}

function migrateFlatTermComposition(composition: unknown): unknown {
  if (!isRecord(composition) || !Array.isArray(composition.terms)) {
    return composition;
  }

  return { ...composition, terms: composition.terms.map(migrateFlatTerm) };
}

function migrateFlatTerm(term: unknown): unknown {
  if (!isRecord(term)) {
    return term;
  }

  const { shape, ...rest } = term;

  return { ...rest, operand: shape };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArrayOf<TItem>(
  value: unknown,
  isItem: (item: unknown) => item is TItem
): value is readonly TItem[] {
  return Array.isArray(value) && value.every(isItem);
}

function isOneOf<TOption extends string>(
  value: unknown,
  options: readonly TOption[]
): value is TOption {
  return typeof value === 'string' && options.some(option => option === value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isVector2(value: unknown): value is Vector2 {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isShape(value: unknown): value is Shape {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isVector2(value.center)) {
    return false;
  }

  // The anchor joined after version 5 shipped; its absence is a valid document,
  // which is why the version is not bumped (the underlay set the precedent).
  if (value.anchorFactors !== undefined && !isVector2(value.anchorFactors)) {
    return false;
  }

  switch (value.kind) {
    case 'rectangle':
    case 'ellipse':
      return (
        isPositiveNumber(value.width) &&
        isPositiveNumber(value.length) &&
        isFiniteNumber(value.rotationDegrees)
      );
    case 'circle':
      return isPositiveNumber(value.radius);
    default:
      return false;
  }
}

function isCsgOperand(value: unknown, depth: number): value is CsgOperand {
  if (isRecord(value) && value.kind === 'group') {
    return (
      depth < MAX_TERM_DEPTH && isNonEmptyString(value.id) && areCsgTerms(value.terms, depth + 1)
    );
  }

  return isShape(value);
}

function isCsgTerm(value: unknown, depth: number): value is CsgTerm {
  return (
    isRecord(value) &&
    isCsgOperand(value.operand, depth) &&
    isOneOf(value.operation, CSG_OPERATIONS)
  );
}

function areCsgTerms(value: unknown, depth: number): value is readonly CsgTerm[] {
  return Array.isArray(value) && value.every(term => isCsgTerm(term, depth));
}

function isShapeComposition(value: unknown): value is ShapeComposition {
  return isRecord(value) && areCsgTerms(value.terms, 0);
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

function isBuilding(value: unknown): value is Building {
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
