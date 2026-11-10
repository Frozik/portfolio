import type { Brand } from '@frozik/utils/types/base';

export type TPlaceId = Brand<string, 'PlaceId'>;

/** How far around the point counts as there, in metres; below ~100 m Android's geofences are unreliable. */
export const PLACE_RADII = [50, 100, 500, 1_000, 5_000, 10_000] as const;
export type TPlaceRadius = (typeof PLACE_RADII)[number];

export const isPlaceRadius = (metres: number): metres is TPlaceRadius =>
  (PLACE_RADII as readonly number[]).includes(metres);

/** «Only at the office» or «except at home»: where the phone is narrows when a group is in force. */
export interface IPlaceRule {
  readonly id: TPlaceId;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly radius: TPlaceRadius;
  readonly mode: 'only-at' | 'except-at';
}

export interface IPoint {
  readonly latitude: number;
  readonly longitude: number;
}

const EARTH_RADIUS_METERS = 6_371_000;
const DEGREES_PER_HALF_TURN = 180;
const toRadians = (degrees: number) => (degrees * Math.PI) / DEGREES_PER_HALF_TURN;

/** Great-circle distance in metres (haversine): plenty for radii from 50 m to 10 km. */
export function distanceMeters(from: IPoint, to: IPoint): number {
  const latitudeStep = toRadians(to.latitude - from.latitude);
  const longitudeStep = toRadians(to.longitude - from.longitude);
  const chord =
    Math.sin(latitudeStep / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(longitudeStep / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(chord));
}

/** Whether the phone is at a place: `null` when nobody knows (location off, no fix yet). */
export type TPlaceFacts = (place: TPlaceId) => boolean | null;

export const NOWHERE_KNOWN: TPlaceFacts = () => null;

/**
 * Whether the places let a group be in force. A place whose state is unknown does not
 * count at all — the schedule and the calendars decide alone (the user's decision).
 */
export function placesAllow(rules: readonly IPlaceRule[], atPlace: TPlaceFacts): boolean {
  return rules.every(rule => {
    const here = atPlace(rule.id);
    if (here === null) {
      return true;
    }
    return rule.mode === 'only-at' ? here : !here;
  });
}
