/** Four ASCII bytes that open every pack: `NVPK`. */
export const PACK_MAGIC = 0x4b50564e;

/**
 * Bumped on every incompatible layout change. A client refuses packs with a
 * newer version than it understands and offers an update for older ones.
 */
export const PACK_FORMAT_VERSION = 1;

/** Coordinates are stored as integer microdegrees (1e-6°, ≈ 11 cm at the equator). */
export const MICRODEGREES = 1_000_000;

export type Profile = 'car' | 'foot' | 'bike';

export const PROFILES: readonly Profile[] = ['car', 'foot', 'bike'];

/**
 * One bit per profile and travel direction in an edge's access byte.
 * "Forward" follows the edge's stored geometry, "backward" runs against it.
 */
export const ACCESS_BIT = {
  carForward: 1 << 0,
  carBackward: 1 << 1,
  footForward: 1 << 2,
  footBackward: 1 << 3,
  bikeForward: 1 << 4,
  bikeBackward: 1 << 5,
} as const;

export const EDGE_FLAG = {
  roundabout: 1 << 0,
  ferry: 1 << 1,
  /** `oneway` applied to motor traffic; kept for instruction wording. */
  oneway: 1 << 2,
} as const;

export const ROAD_CLASS = {
  motorway: 0,
  trunk: 1,
  primary: 2,
  secondary: 3,
  tertiary: 4,
  unclassified: 5,
  residential: 6,
  livingStreet: 7,
  service: 8,
  track: 9,
  pedestrian: 10,
  footway: 11,
  path: 12,
  cycleway: 13,
  steps: 14,
} as const;

export type RoadClass = (typeof ROAD_CLASS)[keyof typeof ROAD_CLASS];

export const ROAD_CLASS_COUNT = 15;

export const RESTRICTION_KIND = {
  no: 0,
  only: 1,
} as const;

export type RestrictionKind = (typeof RESTRICTION_KIND)[keyof typeof RESTRICTION_KIND];
