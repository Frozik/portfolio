import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Opaque } from '@frozik/utils/types/base';
import {
  DEFAULT_CAR_ROTATION_DEGREES,
  DEFAULT_CONTOUR_INTERVAL_METERS,
  DEFAULT_GRID_STEP_METERS,
  DEFAULT_HEIGHTFIELD_TARGET_RESOLUTION,
  DEFAULT_IS_SNAP_ENABLED,
  DEFAULT_LATITUDE_DEGREES,
  DEFAULT_LONGITUDE_DEGREES,
  DEFAULT_NORTH_OFFSET_DEGREES,
  DEFAULT_PAD_ELEVATION_MODE,
  DEFAULT_SETBACK_METERS,
  DEFAULT_SITE_LENGTH_METERS,
  DEFAULT_SITE_WIDTH_METERS,
  DEFAULT_TIME_ZONE_ID,
  DEFAULT_WALL_HEIGHT_METERS,
} from '../constants';
import type { Meters } from '../units';
import { normalizeTurnDegrees } from '../units';
import type { Foundation, UtilityEntry } from './foundation';
import { DEFAULT_FOUNDATION, DEFAULT_FROST_DEPTH_METERS } from './foundation';
import type { Opening } from './openings';
import type { PitchedRoof } from './roofs';
import type { RoomLabel } from './rooms';
import type { UtilityRoute } from './routing';
import type { ShapeComposition } from './shapes';
import { createRectangle } from './shapes';
import type { RoofZoneLabel, Storey, StoreyId } from './storeys';
import type { Wall } from './walls';

export type MarkId = Opaque<'MarkId', string>;
export type BuildingId = Opaque<'BuildingId', string>;
export type TreeId = Opaque<'TreeId', string>;
export type PathId = Opaque<'PathId', string>;
export type CarId = Opaque<'CarId', string>;

export interface ElevationMark {
  readonly id: MarkId;
  readonly position: Vector2;
  /** Relative to the site datum ("construction zero"), not sea level. */
  readonly elevation: Meters;
}

export type PadElevationMode = 'terrain-center' | 'terrain-mean' | 'terrain-min' | 'manual';

/** Every pad mode, in the order the panel offers them. */
export const PAD_ELEVATION_MODES: readonly PadElevationMode[] = [
  'terrain-center',
  'terrain-mean',
  'terrain-min',
  'manual',
];

/** Narrows the string a radio group reports back to the mode it stands for. */
export function parsePadElevationMode(value: string): PadElevationMode | undefined {
  return PAD_ELEVATION_MODES.find(mode => mode === value);
}

/**
 * One structure on the plot — a house, a shed, a carport — named by the user
 * and carrying its own footprint geometry and its own pad. The plan holds a
 * list of them; there is nothing special about the first one.
 */
export interface Building {
  readonly id: BuildingId;
  readonly name: string;
  readonly composition: ShapeComposition;
  readonly padElevationMode: PadElevationMode;
  /** Only meaningful in the `manual` mode. */
  readonly manualPadElevation: Meters | undefined;
  /**
   * Посадка: how far below the terrain datum its mode names the pad sinks.
   * Defaults to the цоколь height, so a fresh house buries its plinth and the
   * floor lands a slab above the ground instead of perching 40 cm over it.
   * Absent in plans saved before посадка existed — read via {@link padDropOf};
   * absent means 0, which keeps every old plan exactly as it stood.
   */
  readonly padDropMeters?: Meters;
  readonly wallHeight: Meters;
  /** Absent in plans saved before foundations existed — read via {@link foundationOf}. */
  readonly foundation?: Foundation;
  /** Absent in plans saved before entries existed — read via {@link entriesOf}. */
  readonly entries?: readonly UtilityEntry[];
  /** Absent in plans saved before walls existed — read via {@link wallsOf}. */
  readonly walls?: readonly Wall[];
  /** Absent in plans saved before openings existed — read via {@link openingsOf}. */
  readonly openings?: readonly Opening[];
  /** Absent in plans saved before room types existed — read via {@link roomLabelsOf}. */
  readonly roomLabels?: readonly RoomLabel[];
  /**
   * The storeys, ground first. Absent in plans saved before storeys existed —
   * read via {@link storeysOf}, which synthesizes the ground storey from the
   * legacy per-building fields above; the first storey edit materializes it
   * (`materializeStoreys`) and the legacy fields stop being read.
   */
  readonly storeys?: readonly Storey[];
  /**
   * The pitched roof crowning the top storey. Absent means the flat model the
   * building had before — a ceiling slab with roof zones over it — which is
   * still what a garage or a carport wants.
   */
  readonly pitchedRoof?: PitchedRoof;
}

/** The building's pitched roof, or nothing while its top is flat. */
export function pitchedRoofOf(building: Building): PitchedRoof | undefined {
  return building.pitchedRoof;
}

/** The building's foundation, defaulted for plans that predate the field. */
export function foundationOf(building: Building): Foundation {
  return building.foundation ?? DEFAULT_FOUNDATION;
}

/** The building's utility entries, empty for plans that predate the field. */
export function entriesOf(building: Building): readonly UtilityEntry[] {
  return building.entries ?? NO_ENTRIES;
}

/**
 * The synthesized ground storey's identity for a building whose storeys have
 * not been materialized yet: stable across calls, derived from the building.
 */
export function groundStoreyId(buildingId: BuildingId): StoreyId {
  return `${buildingId}:ground` as StoreyId;
}

/**
 * The building's storeys, ground first. A building saved (or edited) before
 * storeys existed reads as ONE ground storey carrying its legacy wall,
 * opening and room fields, its height the building's `wallHeight`.
 */
export function storeysOf(building: Building): readonly Storey[] {
  if (building.storeys !== undefined && building.storeys.length > 0) {
    return building.storeys;
  }

  return [
    {
      id: groundStoreyId(building.id),
      heightMeters: building.wallHeight,
      walls: building.walls ?? NO_WALLS,
      openings: building.openings ?? NO_OPENINGS,
      roomLabels: building.roomLabels ?? NO_ROOM_LABELS,
      roofZoneLabels: NO_ROOF_ZONE_LABELS,
    },
  ];
}

/** The ground storey's walls — what view mode and the site plan show. */
export function wallsOf(building: Building): readonly Wall[] {
  return storeysOf(building)[0].walls;
}

/** The ground storey's openings. */
export function openingsOf(building: Building): readonly Opening[] {
  return storeysOf(building)[0].openings;
}

/** The ground storey's room labels. */
export function roomLabelsOf(building: Building): readonly RoomLabel[] {
  return storeysOf(building)[0].roomLabels;
}

const NO_ENTRIES: readonly UtilityEntry[] = [];
const NO_WALLS: readonly Wall[] = [];
const NO_OPENINGS: readonly Opening[] = [];
const NO_ROOM_LABELS: readonly RoomLabel[] = [];
const NO_ROOF_ZONE_LABELS: readonly RoofZoneLabel[] = [];

/**
 * The kinds of tree the catalogue plants. Named species rather than families —
 * a spruce, a pine and a thuja are three silhouettes on a garden plan, and a
 * plan that only knew "conifer" could not tell a column of thujas along a fence
 * from the spruce standing over the house.
 */
export type TreeSpecies = 'spruce' | 'pine' | 'thuja' | 'deciduous';

/** Every species, in the order the catalogue offers them. */
export const TREE_SPECIES: readonly TreeSpecies[] = ['spruce', 'pine', 'thuja', 'deciduous'];

/** Narrows the string a radio group reports back to the species it stands for. */
export function parseTreeSpecies(value: string): TreeSpecies | undefined {
  return TREE_SPECIES.find(species => species === value);
}

export interface TreeInstance {
  readonly id: TreeId;
  readonly species: TreeSpecies;
  readonly position: Vector2;
  readonly crownRadius: Meters;
  readonly height: Meters;
}

export interface TreeSize {
  readonly crownRadius: Meters;
  readonly height: Meters;
}

/**
 * What a freshly planted tree of each species measures: a typical garden
 * specimen rather than a forest record. Spruces and pines carry the plot's
 * vertical scale, a broadleaf spreads wider than it is regular, and a thuja is
 * a hedge column — man-high and narrow — which is exactly why it must not
 * inherit a spruce's six metres.
 */
export const TREE_SPECIES_DEFAULT_SIZES: Readonly<Record<TreeSpecies, TreeSize>> = {
  spruce: { crownRadius: 2, height: 10 },
  pine: { crownRadius: 2.5, height: 12 },
  thuja: { crownRadius: 0.75, height: 3 },
  deciduous: { crownRadius: 2.5, height: 8 },
};

/**
 * Re-labels a tree with another species. A size the user never touched — one
 * still equal to the old species' default — follows the new species, so a
 * spruce turned into a thuja becomes thuja-sized; a size typed by hand is the
 * user's own measurement and stays.
 */
export function changeTreeSpecies(tree: TreeInstance, species: TreeSpecies): TreeInstance {
  const oldDefault = TREE_SPECIES_DEFAULT_SIZES[tree.species];
  const isUntouched =
    tree.crownRadius === oldDefault.crownRadius && tree.height === oldDefault.height;

  return { ...tree, species, ...(isUntouched ? TREE_SPECIES_DEFAULT_SIZES[species] : {}) };
}

/**
 * A parked car. It carries no dimensions of its own: a car is a typical object
 * on a garden plan the way a door is on a floor plan, so its size lives in
 * `domain/constants.ts` and only where it stands and which way it faces are
 * part of the document.
 */
export interface CarInstance {
  readonly id: CarId;
  readonly position: Vector2;
  /** Counter-clockwise turn of the car's nose off plan east, in degrees. */
  readonly rotationDegrees: number;
}

/** What a stretch of path is paved with; the colour on the plan and in 3D. */
export type PathSurface = 'dirt' | 'asphalt';

/** Every surface, in the order the segment panel offers them. */
export const PATH_SURFACES: readonly PathSurface[] = ['dirt', 'asphalt'];

/** Narrows the string a dropdown reports back to the surface it stands for. */
export function parsePathSurface(value: string): PathSurface | undefined {
  return PATH_SURFACES.find(surface => surface === value);
}

/**
 * Paths predate the surface, so its absence stays a valid document and reads
 * as the asphalt every existing ribbon was drawn as.
 */
export const DEFAULT_PATH_SURFACE: PathSurface = 'asphalt';

/**
 * One bend of a path, carrying the ribbon's full width where it passes through
 * and the surface of the segment that STARTS here (the last point's surface
 * goes unread). Keeping the surface on the point is what lets inserts and
 * removals of points carry the paving along with no bookkeeping at all.
 */
export interface PathPoint {
  readonly position: Vector2;
  readonly width: Meters;
  readonly surface?: PathSurface;
}

export function pathSurfaceAt(point: PathPoint): PathSurface {
  return point.surface ?? DEFAULT_PATH_SURFACE;
}

/**
 * A polyline whose width belongs to its points: the ribbon interpolates
 * between them, so a drive can widen towards the gate along one drawn line.
 */
export interface SitePath {
  readonly id: PathId;
  readonly points: readonly PathPoint[];
}

/** The one width every point shares, or nothing when the ribbon varies. */
export function uniformPathWidth(path: SitePath): Meters | undefined {
  const [first] = path.points;

  return path.points.every(point => point.width === first.width) ? first.width : undefined;
}

export interface SiteLocation {
  readonly latitudeDegrees: number;
  readonly longitudeDegrees: number;
  readonly timeZoneId: string;
  /**
   * How far the plan's own north is turned clockwise off the geographic one, in
   * degrees — the convention is stated once, in `view/north-offset.ts`.
   */
  readonly northOffsetDegrees: number;
}

/**
 * The one reading of a location the plan keeps. The north offset is a bearing,
 * so the same plot answers to infinitely many of them; folding it into a single
 * turn is what lets the compass dial, the typed azimuth and the stored plan all
 * show the same figure. A location already canonical is handed back untouched,
 * so an edit to a neighbouring field leaves the sun study's dependency alone.
 */
export function normalizeSiteLocation(location: SiteLocation): SiteLocation {
  const northOffsetDegrees = normalizeTurnDegrees(location.northOffsetDegrees);

  return northOffsetDegrees === location.northOffsetDegrees
    ? location
    : { ...location, northOffsetDegrees };
}

export interface SiteSettings {
  readonly location: SiteLocation;
  readonly gridStepMeters: Meters;
  readonly isSnapEnabled: boolean;
  readonly setbackMeters: Meters;
  readonly heightfieldTargetResolution: number;
  readonly contourIntervalMeters: Meters;
  /**
   * How deep the ground freezes — what every burial norm measures from (R17).
   * Absent in plans saved before the routing stage — read via
   * {@link frostDepthOf}.
   */
  readonly frostDepthMeters?: Meters;
}

/** The plot's frost depth, defaulted for plans that predate the setting. */
export function frostDepthOf(settings: SiteSettings): Meters {
  return settings.frostDepthMeters ?? DEFAULT_FROST_DEPTH_METERS;
}

/**
 * The whole parametric document: immutable and JSON-serialisable, so a plan
 * value doubles as the persistence record and as the undo snapshot.
 */
export interface SitePlan {
  readonly boundary: ShapeComposition;
  readonly elevationMarks: readonly ElevationMark[];
  readonly buildings: readonly Building[];
  readonly trees: readonly TreeInstance[];
  readonly cars: readonly CarInstance[];
  readonly paths: readonly SitePath[];
  /**
   * The site utility trenches. Absent in plans saved before routes existed —
   * read via {@link utilityRoutesOf}.
   */
  readonly utilityRoutes?: readonly UtilityRoute[];
  readonly settings: SiteSettings;
}

/** The plan's trenches, empty for plans that predate the field. */
export function utilityRoutesOf(plan: SitePlan): readonly UtilityRoute[] {
  return plan.utilityRoutes ?? NO_UTILITY_ROUTES;
}

const NO_UTILITY_ROUTES: readonly UtilityRoute[] = [];

export function createMarkId(): MarkId {
  return crypto.randomUUID() as MarkId;
}

export function createTreeId(): TreeId {
  return crypto.randomUUID() as TreeId;
}

export function createPathId(): PathId {
  return crypto.randomUUID() as PathId;
}

export function createCarId(): CarId {
  return crypto.randomUUID() as CarId;
}

/** Mints an identity for a mark the user has just placed or pasted. */
export function createElevationMark({
  position,
  elevation,
}: {
  readonly position: Vector2;
  readonly elevation: Meters;
}): ElevationMark {
  return { id: createMarkId(), position, elevation };
}

/** Mints an identity for a tree the user has just planted. */
export function createTree({
  species,
  position,
  crownRadius,
  height,
}: {
  readonly species: TreeSpecies;
  readonly position: Vector2;
  readonly crownRadius: Meters;
  readonly height: Meters;
}): TreeInstance {
  return { id: createTreeId(), species, position, crownRadius, height };
}

/** Mints an identity for a car the user has just parked. */
export function createCar({
  position,
  rotationDegrees = DEFAULT_CAR_ROTATION_DEGREES,
}: {
  readonly position: Vector2;
  readonly rotationDegrees?: number;
}): CarInstance {
  return {
    id: createCarId(),
    position,
    rotationDegrees: normalizeTurnDegrees(rotationDegrees),
  };
}

/** Mints an identity for a path the user has just finished drawing. */
export function createSitePath({
  points,
  width,
}: {
  readonly points: readonly Vector2[];
  readonly width: Meters;
}): SitePath {
  return { id: createPathId(), points: points.map(position => ({ position, width })) };
}

export function createBuildingId(): BuildingId {
  return crypto.randomUUID() as BuildingId;
}

/** Mints a named structure with an empty footprint and the default pad settings. */
export function createBuilding({
  name,
  composition = { terms: [] },
}: {
  readonly name: string;
  readonly composition?: ShapeComposition;
}): Building {
  return {
    id: createBuildingId(),
    name,
    composition,
    padElevationMode: DEFAULT_PAD_ELEVATION_MODE,
    manualPadElevation: undefined,
    padDropMeters: DEFAULT_FOUNDATION.heightAboveGroundMeters,
    wallHeight: DEFAULT_WALL_HEIGHT_METERS,
    foundation: DEFAULT_FOUNDATION,
    entries: [],
  };
}

/** The посадка of the building; absent (pre-посадка plans) reads as 0. */
export function padDropOf(building: Building): Meters {
  return building.padDropMeters ?? 0;
}

export function createDefaultSitePlan(): SitePlan {
  return {
    boundary: {
      terms: [
        {
          operand: createRectangle({
            center: { x: DEFAULT_SITE_WIDTH_METERS / 2, y: DEFAULT_SITE_LENGTH_METERS / 2 },
            width: DEFAULT_SITE_WIDTH_METERS,
            length: DEFAULT_SITE_LENGTH_METERS,
            rotationDegrees: 0,
          }),
          operation: 'union',
        },
      ],
    },
    elevationMarks: [],
    buildings: [],
    trees: [],
    cars: [],
    paths: [],
    utilityRoutes: [],
    settings: {
      location: {
        latitudeDegrees: DEFAULT_LATITUDE_DEGREES,
        longitudeDegrees: DEFAULT_LONGITUDE_DEGREES,
        timeZoneId: DEFAULT_TIME_ZONE_ID,
        northOffsetDegrees: DEFAULT_NORTH_OFFSET_DEGREES,
      },
      gridStepMeters: DEFAULT_GRID_STEP_METERS,
      isSnapEnabled: DEFAULT_IS_SNAP_ENABLED,
      setbackMeters: DEFAULT_SETBACK_METERS,
      heightfieldTargetResolution: DEFAULT_HEIGHTFIELD_TARGET_RESOLUTION,
      contourIntervalMeters: DEFAULT_CONTOUR_INTERVAL_METERS,
      frostDepthMeters: DEFAULT_FROST_DEPTH_METERS,
    },
  };
}
