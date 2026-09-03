import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Opaque } from '@frozik/utils/types/base';

import type { Meters } from '../units';

/** See `building-editor.md` §3 — slab, stem walls on footings, or piers. */
export type FoundationKind = 'slab' | 'stem-wall' | 'pier';

/** Every foundation kind, in the order the panel offers them. */
export const FOUNDATION_KINDS: readonly FoundationKind[] = ['slab', 'stem-wall', 'pier'];

/** Narrows the string a dropdown reports back to the kind it stands for. */
export function parseFoundationKind(value: string): FoundationKind | undefined {
  return FOUNDATION_KINDS.find(kind => kind === value);
}

/**
 * A building's foundation, chosen rather than drawn: the geometry derives from
 * the footprint and the terrain (`building-editor.md` §3, the Chief Architect
 * generate-then-tweak model minus the tweak).
 */
export interface Foundation {
  readonly kind: FoundationKind;
  /** How far below the pad the foundation reaches. */
  readonly depthMeters: Meters;
  /** The цоколь — how far the foundation stands above the pad. */
  readonly heightAboveGroundMeters: Meters;
}

/** A shallow slab with a standard цоколь — the default every building starts on. */
export const DEFAULT_FOUNDATION: Foundation = {
  kind: 'slab',
  depthMeters: 0.3,
  heightAboveGroundMeters: 0.3,
};

/**
 * Every system a route can belong to. The routing machinery is
 * system-agnostic by requirement (R18): nothing anywhere may special-case a
 * system beyond what its profile or the entry rules below declare.
 */
export type UtilitySystem =
  | 'power'
  | 'network'
  | 'water'
  | 'sewer'
  | 'heating'
  | 'ventilation'
  | 'gas';

/** The systems that enter a building from the site; the rest stay internal. */
export const ENTRY_SYSTEMS: readonly UtilitySystem[] = [
  'power',
  'network',
  'water',
  'sewer',
  'gas',
];

/** Fresh entries walk along the outline this far apart, so badges never stack. */
export const ENTRY_SPACING_METERS: Meters = 3;

export type UtilityEntryId = Opaque<'UtilityEntryId', string>;

export type UtilityEntryKind = 'sleeve' | 'facade';

/**
 * Where one system enters the building — the seam a site trench and an indoor
 * route meet at. A sleeve is cast into the foundation at pour time; a facade
 * entry rides above ground on the wall.
 */
export interface UtilityEntry {
  readonly id: UtilityEntryId;
  readonly system: UtilitySystem;
  /** Position along the footprint's outer outline, from its start. */
  readonly outlineOffsetMeters: Meters;
  /**
   * Present when the entry comes up THROUGH the slab instead of through the
   * outline — the sleeve cast into the foundation floor. The outline offset
   * stays behind as the anchor the entry returns to when dragged back to the
   * edge; a reader resolves the position as `floorPosition ?? on-outline`.
   */
  readonly floorPosition?: Vector2;
  readonly kind: UtilityEntryKind;
  /** Below grade for a sleeve; above ground for a facade entry. */
  readonly depthMeters: Meters;
  readonly sleeveDiameterMeters: Meters | undefined;
}

/**
 * Until the frost-depth site setting ships with the routing stage
 * (`building-editor.md` §8, R17), entry depths default against this — the
 * user-decided default the setting itself will start at.
 */
export const DEFAULT_FROST_DEPTH_METERS: Meters = 1.5;

/** СП 31.13330: the water service line sits half a metre below the frost line. */
const WATER_BELOW_FROST_METERS: Meters = 0.5;
/** СП: sewer may sit closer to the frost line — 0.3 m below it. */
const SEWER_BELOW_FROST_METERS: Meters = 0.3;
/** Underground cable entries (power, network) — the standard 0.7 m cover. */
const CABLE_DEPTH_METERS: Meters = 0.7;
/** A facade entry (gas) sits above ground at цокольный-ввод height. */
const FACADE_ENTRY_HEIGHT_METERS: Meters = 0.5;

/** Sleeves are the pipe one size up: ≥50 mm, 160 mm around a Ø110 sewer run. */
const CABLE_SLEEVE_DIAMETER_METERS: Meters = 0.05;
const WATER_SLEEVE_DIAMETER_METERS: Meters = 0.05;
const SEWER_SLEEVE_DIAMETER_METERS: Meters = 0.16;

/**
 * Gas is never concealed (СП 62.13330): its entry may only ride the facade —
 * the цокольный ввод. Every other entering system comes through a sleeve.
 */
export function entryKindFor(system: UtilitySystem): UtilityEntryKind {
  return system === 'gas' ? 'facade' : 'sleeve';
}

/** Gas may only ride the facade (СП 62) — every other system may come up through the slab. */
export function canEnterThroughFloor(system: UtilitySystem): boolean {
  return system !== 'gas';
}

/** The norm-derived starting depth for a system's entry; always editable after. */
export function defaultEntryDepth(system: UtilitySystem, frostDepthMeters: Meters): Meters {
  switch (system) {
    case 'water':
      return frostDepthMeters + WATER_BELOW_FROST_METERS;
    case 'sewer':
      return frostDepthMeters + SEWER_BELOW_FROST_METERS;
    case 'power':
    case 'network':
      return CABLE_DEPTH_METERS;
    case 'gas':
      return FACADE_ENTRY_HEIGHT_METERS;
    case 'heating':
    case 'ventilation':
      return 0;
    default:
      return assertNever(system);
  }
}

function defaultSleeveDiameter(system: UtilitySystem): Meters | undefined {
  switch (system) {
    case 'water':
      return WATER_SLEEVE_DIAMETER_METERS;
    case 'sewer':
      return SEWER_SLEEVE_DIAMETER_METERS;
    case 'power':
    case 'network':
      return CABLE_SLEEVE_DIAMETER_METERS;
    case 'gas':
    case 'heating':
    case 'ventilation':
      return undefined;
    default:
      return assertNever(system);
  }
}

/** Mints an entry with the system's norm defaults; everything stays editable. */
export function createUtilityEntry({
  system,
  outlineOffsetMeters,
  frostDepthMeters = DEFAULT_FROST_DEPTH_METERS,
}: {
  readonly system: UtilitySystem;
  readonly outlineOffsetMeters: Meters;
  readonly frostDepthMeters?: Meters;
}): UtilityEntry {
  return {
    id: crypto.randomUUID() as UtilityEntryId,
    system,
    outlineOffsetMeters,
    kind: entryKindFor(system),
    depthMeters: defaultEntryDepth(system, frostDepthMeters),
    sleeveDiameterMeters: defaultSleeveDiameter(system),
  };
}
