import { isNil } from 'lodash-es';

import type { PositionFailure } from '../application/ports/position-source';
import { GEOLOCATION_MAX_AGE_MS, GEOLOCATION_TIMEOUT_MS } from '../domain/constants';
import type { LonLat } from '../domain/mercator';

const FAILURE_BY_CODE: Readonly<Record<number, PositionFailure>> = {
  1: 'denied',
  2: 'unavailable',
  3: 'timeout',
};

/**
 * Asks the browser where the user is, once, coarsely. Denial, absence and
 * timeouts report a failure and nothing else — the map simply stays where
 * it is. The returned function drops an answer that arrives after the
 * caller is gone.
 */
export function requestCurrentPosition(
  onPosition: (position: LonLat) => void,
  onFailure: (reason: PositionFailure) => void = () => undefined
): VoidFunction {
  let cancelled = false;
  if (isNil(navigator.geolocation)) {
    onFailure('unsupported');
    return () => undefined;
  }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      if (!cancelled) {
        onPosition({ lat: coords.latitude, lon: coords.longitude });
      }
    },
    error => {
      if (!cancelled) {
        onFailure(FAILURE_BY_CODE[error.code] ?? 'unavailable');
      }
    },
    {
      enableHighAccuracy: false,
      timeout: GEOLOCATION_TIMEOUT_MS,
      maximumAge: GEOLOCATION_MAX_AGE_MS,
    }
  );
  return () => {
    cancelled = true;
  };
}
