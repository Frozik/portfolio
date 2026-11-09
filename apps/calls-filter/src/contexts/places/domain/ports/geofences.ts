import type { IPlaceRule, IPoint, TPlaceId } from '../../../policy/domain/place-rule';

/** Android's geofences for the places the groups use; their verdicts reach the screening service. */
export interface IGeofences {
  /** Watches exactly these places from now on; places no longer listed are forgotten. */
  watch(places: readonly IPlaceRule[]): Promise<void>;
  /** Measures where the phone is and sets every place's state from it, crossing or not. */
  settle(places: readonly IPlaceRule[]): Promise<void>;
  /** What the geofence last said about a place; `null` when unknown. */
  atPlace(place: TPlaceId): boolean | null;
}

export interface IFoundAddress {
  readonly label: string;
  readonly point: IPoint;
}

/** An address typed by the user, turned into points on the map. */
export type TSearchAddress = (query: string) => Promise<readonly IFoundAddress[]>;

/** Where the phone is now, if it can say. */
export type TCurrentPoint = () => Promise<IPoint | null>;
