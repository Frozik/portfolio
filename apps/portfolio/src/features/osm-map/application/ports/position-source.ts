import type { LonLat } from '../../domain/mercator';

/** Why the browser gave no position, in the Geolocation API's own terms. */
export type PositionFailure = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

/** Asks where the user is; the returned function withdraws the request. */
export type PositionSource = (
  onPosition: (position: LonLat) => void,
  onFailure: (reason: PositionFailure) => void
) => VoidFunction;
