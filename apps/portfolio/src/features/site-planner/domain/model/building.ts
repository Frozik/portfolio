import type { Opaque } from '@frozik/utils/types/base';
import { DEFAULT_PAD_ELEVATION_MODE, DEFAULT_WALL_HEIGHT_METERS } from '../constants';
import type { Meters } from '../units';
import type { Foundation, UtilityEntry } from './foundation';
import { DEFAULT_FOUNDATION } from './foundation';
import type { Opening } from './openings';
import type { PitchedRoof } from './roofs';
import type { RoomLabel } from './rooms';
import type { ShapeComposition } from './shapes';
import type { RoofZoneLabel, Storey, StoreyId } from './storeys';
import type { Wall } from './walls';

/** A building of the plan: its footprint composition, pad and foundation, storeys, roof and utility entries — with the readers that fill in what an older document left out. */
export type BuildingId = Opaque<'BuildingId', string>;

export type PadElevationMode = 'terrain-center' | 'terrain-mean' | 'terrain-min' | 'manual';

/** Every pad mode, in the order the panel offers them. */
export const PAD_ELEVATION_MODES: readonly PadElevationMode[] = [
  'terrain-center',
  'terrain-mean',
  'terrain-min',
  'manual',
];

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
function groundStoreyId(buildingId: BuildingId): StoreyId {
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

const NO_ENTRIES: readonly UtilityEntry[] = [];

const NO_WALLS: readonly Wall[] = [];

const NO_OPENINGS: readonly Opening[] = [];

const NO_ROOM_LABELS: readonly RoomLabel[] = [];

const NO_ROOF_ZONE_LABELS: readonly RoofZoneLabel[] = [];

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
