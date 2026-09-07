import { isNil } from 'lodash-es';

import type { Profile, RoadClass } from './format';
import { ACCESS_BIT, EDGE_FLAG, ROAD_CLASS } from './format';

const HIGHWAY_TO_CLASS: Readonly<Record<string, RoadClass>> = {
  motorway: ROAD_CLASS.motorway,
  motorway_link: ROAD_CLASS.motorway,
  trunk: ROAD_CLASS.trunk,
  trunk_link: ROAD_CLASS.trunk,
  primary: ROAD_CLASS.primary,
  primary_link: ROAD_CLASS.primary,
  secondary: ROAD_CLASS.secondary,
  secondary_link: ROAD_CLASS.secondary,
  tertiary: ROAD_CLASS.tertiary,
  tertiary_link: ROAD_CLASS.tertiary,
  unclassified: ROAD_CLASS.unclassified,
  road: ROAD_CLASS.unclassified,
  residential: ROAD_CLASS.residential,
  living_street: ROAD_CLASS.livingStreet,
  service: ROAD_CLASS.service,
  track: ROAD_CLASS.track,
  pedestrian: ROAD_CLASS.pedestrian,
  footway: ROAD_CLASS.footway,
  path: ROAD_CLASS.path,
  cycleway: ROAD_CLASS.cycleway,
  steps: ROAD_CLASS.steps,
};

/** The road class of an OSM `highway` value, or `undefined` for ways routing ignores. */
export function classifyHighway(highway: string | undefined): RoadClass | undefined {
  return isNil(highway) ? undefined : HIGHWAY_TO_CLASS[highway];
}

/** km/h by road class, indexed by `RoadClass`; 0 means the profile never uses the class. */
export const PROFILE_SPEED_KMH: Readonly<Record<Profile, readonly number[]>> = {
  car: [100, 80, 60, 50, 45, 40, 30, 10, 20, 15, 0, 0, 0, 0, 0],
  foot: [0, 5, 5, 5, 5, 5, 5, 5, 5, 4, 5, 5, 4, 5, 3],
  bike: [0, 18, 18, 18, 18, 16, 15, 8, 12, 12, 6, 6, 12, 18, 0],
};

export const PROFILE_MAX_SPEED_KMH: Readonly<Record<Profile, number>> = {
  car: Math.max(...PROFILE_SPEED_KMH.car),
  foot: Math.max(...PROFILE_SPEED_KMH.foot),
  bike: Math.max(...PROFILE_SPEED_KMH.bike),
};

const ALLOW_VALUES = new Set(['yes', 'designated', 'permissive', 'destination', 'official']);
const DENY_VALUES = new Set(['no', 'private', 'agricultural', 'forestry', 'delivery', 'military']);

function tagVerdict(value: string | undefined): boolean | undefined {
  if (isNil(value)) {
    return undefined;
  }
  if (ALLOW_VALUES.has(value)) {
    return true;
  }
  if (DENY_VALUES.has(value)) {
    return false;
  }
  return undefined;
}

/**
 * The most specific access tag wins, following the OSM hierarchy
 * `access` → `vehicle` → `motor_vehicle` → `motorcar` (car),
 * `access` → `vehicle` → `bicycle` (bike), `access` → `foot` (foot).
 */
function resolveAccess(
  tags: ReadonlyMap<string, string>,
  chain: readonly string[],
  fallback: boolean
): boolean {
  let verdict = fallback;
  for (const key of chain) {
    const tagged = tagVerdict(tags.get(key));
    if (!isNil(tagged)) {
      verdict = tagged;
    }
  }
  return verdict;
}

const CAR_CHAIN = ['access', 'vehicle', 'motor_vehicle', 'motorcar'];
const BIKE_CHAIN = ['access', 'vehicle', 'bicycle'];
const FOOT_CHAIN = ['access', 'foot'];

function defaultAccess(profile: Profile, roadClass: RoadClass): boolean {
  return PROFILE_SPEED_KMH[profile][roadClass] > 0;
}

function isOnewayValue(value: string | undefined): 'forward' | 'backward' | undefined {
  switch (value) {
    case 'yes':
    case 'true':
    case '1':
      return 'forward';
    case '-1':
    case 'reverse':
      return 'backward';
    default:
      return undefined;
  }
}

export interface WayAccess {
  readonly access: number;
  readonly flags: number;
}

/** Access bits and flags of a way from its tags; `undefined` when no profile may use it. */
export function computeWayAccess(
  tags: ReadonlyMap<string, string>,
  roadClass: RoadClass
): WayAccess | undefined {
  const car = resolveAccess(tags, CAR_CHAIN, defaultAccess('car', roadClass));
  const bike = resolveAccess(tags, BIKE_CHAIN, defaultAccess('bike', roadClass));
  const foot = resolveAccess(tags, FOOT_CHAIN, defaultAccess('foot', roadClass));

  const isRoundabout = tags.get('junction') === 'roundabout' || tags.get('junction') === 'circular';
  const oneway = isOnewayValue(tags.get('oneway')) ?? (isRoundabout ? 'forward' : undefined);
  const bikeOneway =
    tags.get('oneway:bicycle') === 'no' || tags.get('cycleway') === 'opposite'
      ? undefined
      : (isOnewayValue(tags.get('oneway:bicycle')) ?? oneway);

  let access = 0;
  if (car) {
    access |= oneway === 'backward' ? 0 : ACCESS_BIT.carForward;
    access |= oneway === 'forward' ? 0 : ACCESS_BIT.carBackward;
  }
  if (bike) {
    access |= bikeOneway === 'backward' ? 0 : ACCESS_BIT.bikeForward;
    access |= bikeOneway === 'forward' ? 0 : ACCESS_BIT.bikeBackward;
  }
  if (foot) {
    access |= ACCESS_BIT.footForward | ACCESS_BIT.footBackward;
  }
  if (access === 0) {
    return undefined;
  }

  let flags = 0;
  if (isRoundabout) {
    flags |= EDGE_FLAG.roundabout;
  }
  if (!isNil(oneway)) {
    flags |= EDGE_FLAG.oneway;
  }
  if (tags.get('route') === 'ferry') {
    flags |= EDGE_FLAG.ferry;
  }
  return { access, flags };
}

export function forwardBit(profile: Profile): number {
  switch (profile) {
    case 'car':
      return ACCESS_BIT.carForward;
    case 'foot':
      return ACCESS_BIT.footForward;
    case 'bike':
      return ACCESS_BIT.bikeForward;
  }
}

export function backwardBit(profile: Profile): number {
  switch (profile) {
    case 'car':
      return ACCESS_BIT.carBackward;
    case 'foot':
      return ACCESS_BIT.footBackward;
    case 'bike':
      return ACCESS_BIT.bikeBackward;
  }
}

/** Seconds to travel `lengthMetres` of a road class, or `Infinity` when the profile never uses it. */
export function travelSeconds(
  profile: Profile,
  roadClass: RoadClass,
  lengthMetres: number
): number {
  const speed = PROFILE_SPEED_KMH[profile][roadClass];
  if (speed <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return (lengthMetres / speed) * 3.6;
}
